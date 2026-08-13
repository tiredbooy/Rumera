package middleware

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/pkg/metrics"
	"go.uber.org/zap"
)

// DefaultIdempotencyStaleAfter is how long a pending (response_code=0) claim may
// sit before a retry is allowed to reclaim it. Covers process crashes between
// Claim and Complete/Release without waiting for the 30-day retention job.
const DefaultIdempotencyStaleAfter = 2 * time.Minute

// Client-supplied Idempotency-Key constraints (align with admin wallet credit).
const (
	idempotencyClientKeyMin = 8
	idempotencyClientKeyMax = 128
)

// IdempotencyRecord is a stored request outcome. ResponseCode == 0 means the
// request was claimed but is still being processed (no response yet).
type IdempotencyRecord struct {
	RequestHash  string
	ResponseCode int
	ResponseBody []byte
	CreatedAt    time.Time // set by store reads; zero if unknown
}

// IdempotencyStore persists request claims and their responses so a replayed
// request returns the original outcome instead of re-running the side effect.
type IdempotencyStore interface {
	// Claim atomically inserts a pending row for key. It returns claimed=true if
	// this caller won the claim (including after reclaiming a stale pending row);
	// otherwise claimed=false and the existing record.
	Claim(ctx context.Context, key, requestHash string) (claimed bool, existing *IdempotencyRecord, err error)
	// Complete records the final response for a previously claimed key.
	Complete(ctx context.Context, key string, code int, body []byte) error
	// Release removes a claim so a legitimate retry can re-process. Used when the
	// first attempt did not complete successfully.
	Release(ctx context.Context, key string) error
}

// IdempotencyConfig tunes key policy for a mounted route group.
//
// Zero value is safe for payment webhooks: auto body-hash keys allowed, key not
// required, scoped storage keys always applied.
type IdempotencyConfig struct {
	// AllowAutoKey, when true (default for Idempotency()), derives a client key
	// from the body hash when the Idempotency-Key header is absent. Webhooks that
	// cannot send custom headers rely on this. Authenticated money routes should
	// set AllowAutoKey=false so two intentional creates with the same body do not
	// collapse (see architecture/idempotency.md D2).
	AllowAutoKey bool

	// RequireKey, when true, rejects requests missing Idempotency-Key with 400.
	// Used once FE/BFF always send keys (PH-011c). Ignored when a key is present.
	RequireKey bool
}

// Idempotency makes the wrapped routes safe to call more than once with the same
// request intent. Storage keys are always scoped:
//
//	{tier}:{principal}:{METHOD}:{routeTemplate}:{clientKey}
//
// Client key comes from the Idempotency-Key header when present; otherwise (if
// AllowAutoKey) from auto:{bodyHash}. First call claims the key, runs the
// handler, and stores 2xx responses. Replay of a completed key returns the
// stored response without running the handler. Same key with a different body,
// or an in-flight claim that is not yet stale → 409. Store I/O errors fail-open
// (handler runs) so a broken idempotency table cannot brick money paths when
// the same DB would reject the side effect anyway.
func Idempotency(store IdempotencyStore, log *zap.Logger) gin.HandlerFunc {
	return IdempotencyWithConfig(store, log, IdempotencyConfig{AllowAutoKey: true})
}

// IdempotencyWithConfig is Idempotency with explicit key policy (PH-011c money
// routes use AllowAutoKey=false; optionally RequireKey=true).
func IdempotencyWithConfig(store IdempotencyStore, log *zap.Logger, cfg IdempotencyConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		body, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "cannot read request body"})
			return
		}
		// Restore the body so downstream handlers (e.g. webhook signature check)
		// can read it again.
		c.Request.Body = io.NopCloser(bytes.NewReader(body))

		hash := hashBody(body)
		route := routeTemplate(c)
		clientKey, ok, reason := resolveClientKey(c, cfg, hash, route)
		if !ok {
			switch reason {
			case "missing":
				metrics.IncIdempotencyMissingKey(route)
				if cfg.RequireKey {
					c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Idempotency-Key header is required"})
					return
				}
				// Optional key, no auto: process without platform cache.
				c.Next()
				return
			case "invalid":
				c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid Idempotency-Key header"})
				return
			default:
				c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid Idempotency-Key header"})
				return
			}
		}

		key := scopeIdempotencyKey(
			resolveTier(c, route),
			resolvePrincipal(c),
			c.Request.Method,
			route,
			clientKey,
		)

		claimed, existing, err := store.Claim(c.Request.Context(), key, hash)
		if err != nil {
			metrics.IncIdempotencyClaim("error")
			idemWarn(log, "claim", key, err)
			c.Next() // fail-open
			return
		}

		if !claimed {
			metrics.IncIdempotencyClaim("lost")
			switch {
			case existing != nil && existing.ResponseCode == 0:
				metrics.IncIdempotencyConflict("inflight")
				c.AbortWithStatusJSON(http.StatusConflict, gin.H{"error": "request already in progress"})
			case existing != nil && existing.RequestHash != hash:
				metrics.IncIdempotencyConflict("body")
				c.AbortWithStatusJSON(http.StatusConflict, gin.H{"error": "idempotency key reused with a different payload"})
			case existing != nil:
				metrics.IncIdempotencyReplay()
				c.Data(existing.ResponseCode, "application/json; charset=utf-8", existing.ResponseBody)
				c.Abort()
			default:
				// Defensive: lost claim without a row — fail-open.
				idemWarn(log, "claim-lost-no-row", key, fmt.Errorf("nil existing record"))
				c.Next()
			}
			return
		}

		metrics.IncIdempotencyClaim("won")

		// We own the claim. Buffer the response so we can persist it.
		rec := &recordingWriter{ResponseWriter: c.Writer, buf: &bytes.Buffer{}}
		c.Writer = rec

		c.Next()

		status := rec.status()
		if status >= http.StatusOK && status < http.StatusMultipleChoices {
			if err := store.Complete(c.Request.Context(), key, status, rec.buf.Bytes()); err != nil {
				metrics.IncIdempotencyCompleteError()
				idemWarn(log, "complete", key, err)
			}
			return
		}
		// Handler did not succeed: drop the claim so the caller can retry later.
		if err := store.Release(c.Request.Context(), key); err != nil {
			idemWarn(log, "release", key, err)
		}
	}
}

// scopeIdempotencyKey builds the durable primary key (PH-011a D2).
func scopeIdempotencyKey(tier, principal, method, route, clientKey string) string {
	if tier == "" {
		tier = "pub"
	}
	if principal == "" {
		principal = "0"
	}
	method = strings.ToUpper(method)
	if route == "" {
		route = "/"
	}
	return tier + ":" + principal + ":" + method + ":" + route + ":" + clientKey
}

func resolveClientKey(c *gin.Context, cfg IdempotencyConfig, bodyHash, _ string) (key string, ok bool, reason string) {
	raw := strings.TrimSpace(c.GetHeader("Idempotency-Key"))
	if raw == "" {
		if cfg.AllowAutoKey {
			return "auto:" + bodyHash, true, ""
		}
		return "", false, "missing"
	}
	if !validClientIdempotencyKey(raw) {
		return "", false, "invalid"
	}
	return raw, true, ""
}

func validClientIdempotencyKey(key string) bool {
	n := utf8.RuneCountInString(key)
	if n < idempotencyClientKeyMin || n > idempotencyClientKeyMax {
		return false
	}
	for _, r := range key {
		if r == '|' || unicode.IsSpace(r) {
			return false
		}
		// Printable ASCII only (UUIDs, ULIDs, ops tokens).
		if r < 33 || r > 126 {
			return false
		}
	}
	return true
}

func resolveTier(c *gin.Context, route string) string {
	path := route
	if path == "" || path == "unmatched" {
		path = c.Request.URL.Path
	}
	if strings.Contains(path, "/webhooks/") {
		return "wh"
	}
	if strings.Contains(path, "/admin") {
		return "admin"
	}
	if _, ok := c.Get("uid"); ok {
		return "cust"
	}
	return "pub"
}

func resolvePrincipal(c *gin.Context) string {
	v, ok := c.Get("uid")
	if !ok || v == nil {
		return "0"
	}
	switch n := v.(type) {
	case int64:
		return strconv.FormatInt(n, 10)
	case int:
		return strconv.Itoa(n)
	case int32:
		return strconv.FormatInt(int64(n), 10)
	case string:
		if n != "" {
			return n
		}
	}
	return "0"
}

func routeTemplate(c *gin.Context) string {
	if p := c.FullPath(); p != "" {
		return p
	}
	return "unmatched"
}

func hashBody(body []byte) string {
	sum := sha256.Sum256(body)
	return hex.EncodeToString(sum[:])
}

func idemWarn(log *zap.Logger, op, key string, err error) {
	if log != nil {
		log.Warn("idempotency "+op+" failed", zap.String("key", key), zap.Error(err))
	}
}

// recordingWriter tees the response into a buffer while still writing it to the
// client, so a successful response can be stored for future replays.
type recordingWriter struct {
	gin.ResponseWriter
	buf *bytes.Buffer
}

func (w *recordingWriter) status() int {
	if s := w.ResponseWriter.Status(); s != 0 {
		return s
	}
	return http.StatusOK // gin defaults to 200 when the handler writes a body without an explicit code
}

func (w *recordingWriter) Write(b []byte) (int, error) {
	w.buf.Write(b)
	return w.ResponseWriter.Write(b)
}

func (w *recordingWriter) WriteString(s string) (int, error) {
	w.buf.WriteString(s)
	return w.ResponseWriter.WriteString(s)
}

// ── Postgres-backed store ────────────────────────────────────────────────────

type pgIdempotencyStore struct {
	db         *pgxpool.Pool
	staleAfter time.Duration
}

// NewIdempotencyStore returns an IdempotencyStore backed by the main pool with
// DefaultIdempotencyStaleAfter for pending-claim reclaim.
func NewIdempotencyStore(db *pgxpool.Pool) IdempotencyStore {
	return NewIdempotencyStoreWithStale(db, DefaultIdempotencyStaleAfter)
}

// NewIdempotencyStoreWithStale is like NewIdempotencyStore but sets how long a
// pending claim may live before Claim may delete and re-insert it. Pass 0 to
// disable stale reclaim (strict in-flight 409 until Release/retention).
func NewIdempotencyStoreWithStale(db *pgxpool.Pool, staleAfter time.Duration) IdempotencyStore {
	return &pgIdempotencyStore{db: db, staleAfter: staleAfter}
}

func (s *pgIdempotencyStore) Claim(ctx context.Context, key, requestHash string) (bool, *IdempotencyRecord, error) {
	claimed, rec, err := s.tryInsert(ctx, key, requestHash)
	if err != nil || claimed {
		return claimed, rec, err
	}

	// Pending and past the lease: reclaim so a crashed worker cannot block retries
	// until the 30-day retention job runs.
	if rec != nil && rec.ResponseCode == 0 && s.staleAfter > 0 {
		cutoff := time.Now().Add(-s.staleAfter)
		if rec.CreatedAt.IsZero() || rec.CreatedAt.Before(cutoff) {
			reclaimed, err := s.reclaimStale(ctx, key, requestHash, cutoff)
			if err != nil {
				return false, nil, err
			}
			if reclaimed {
				return true, nil, nil
			}
			// Lost the reclaim race — re-read current row.
			rec, err = s.get(ctx, key)
			if err != nil {
				return false, nil, err
			}
		}
	}
	return false, rec, nil
}

func (s *pgIdempotencyStore) tryInsert(ctx context.Context, key, requestHash string) (bool, *IdempotencyRecord, error) {
	tag, err := s.db.Exec(ctx,
		`INSERT INTO idempotency_keys (key, request_hash) VALUES ($1, $2)
		 ON CONFLICT (key) DO NOTHING`, key, requestHash)
	if err != nil {
		return false, nil, err
	}
	if tag.RowsAffected() == 1 {
		return true, nil, nil
	}
	rec, err := s.get(ctx, key)
	if err != nil {
		return false, nil, err
	}
	return false, rec, nil
}

func (s *pgIdempotencyStore) reclaimStale(ctx context.Context, key, requestHash string, cutoff time.Time) (bool, error) {
	tag, err := s.db.Exec(ctx,
		`DELETE FROM idempotency_keys
		 WHERE key = $1 AND response_code = 0 AND created_at < $2`,
		key, cutoff)
	if err != nil {
		return false, err
	}
	if tag.RowsAffected() == 0 {
		return false, nil
	}
	// Re-insert; another reclaimer may race — ON CONFLICT handles it.
	tag, err = s.db.Exec(ctx,
		`INSERT INTO idempotency_keys (key, request_hash) VALUES ($1, $2)
		 ON CONFLICT (key) DO NOTHING`, key, requestHash)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}

func (s *pgIdempotencyStore) get(ctx context.Context, key string) (*IdempotencyRecord, error) {
	var rec IdempotencyRecord
	err := s.db.QueryRow(ctx,
		`SELECT request_hash, response_code, response_body, created_at FROM idempotency_keys WHERE key = $1`, key).
		Scan(&rec.RequestHash, &rec.ResponseCode, &rec.ResponseBody, &rec.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

func (s *pgIdempotencyStore) Complete(ctx context.Context, key string, code int, body []byte) error {
	_, err := s.db.Exec(ctx,
		`UPDATE idempotency_keys SET response_code = $2, response_body = $3 WHERE key = $1`,
		key, code, body)
	return err
}

func (s *pgIdempotencyStore) Release(ctx context.Context, key string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM idempotency_keys WHERE key = $1`, key)
	return err
}

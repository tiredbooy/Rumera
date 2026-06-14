package middleware

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
)

// IdempotencyRecord is a stored request outcome. ResponseCode == 0 means the
// request was claimed but is still being processed (no response yet).
type IdempotencyRecord struct {
	RequestHash  string
	ResponseCode int
	ResponseBody []byte
}

// IdempotencyStore persists request claims and their responses so a replayed
// request returns the original outcome instead of re-running the side effect.
type IdempotencyStore interface {
	// Claim atomically inserts a pending row for key. It returns claimed=true if
	// this caller won the claim; otherwise claimed=false and the existing record.
	Claim(ctx context.Context, key, requestHash string) (claimed bool, existing *IdempotencyRecord, err error)
	// Complete records the final response for a previously claimed key.
	Complete(ctx context.Context, key string, code int, body []byte) error
	// Release removes a claim so a legitimate retry can re-process. Used when the
	// first attempt did not complete successfully.
	Release(ctx context.Context, key string) error
}

// Idempotency makes the wrapped routes safe to call more than once with the same
// request. It keys on the Idempotency-Key header when present, otherwise on a
// hash of method+path+body — so a payment gateway resending an identical webhook
// callback is deduplicated automatically.
//
// First call: claim the key, run the handler, store the response. Replay of a
// completed key: return the stored response without running the handler. Replay
// while the first is still in flight, or the same key with a different body:
// 409 Conflict. If the store itself errors the request proceeds (fail-open):
// the side effect lives in the same database, so it can't double-commit while
// that database is unavailable.
func Idempotency(store IdempotencyStore, log *zap.Logger) gin.HandlerFunc {
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
		key := c.GetHeader("Idempotency-Key")
		if key == "" {
			key = deriveKey(c.Request.Method, c.FullPath(), hash)
		}

		claimed, existing, err := store.Claim(c.Request.Context(), key, hash)
		if err != nil {
			idemWarn(log, "claim", key, err)
			c.Next() // fail-open
			return
		}

		if !claimed {
			switch {
			case existing.ResponseCode == 0:
				// Another identical request is still being processed.
				c.AbortWithStatusJSON(http.StatusConflict, gin.H{"error": "request already in progress"})
			case existing.RequestHash != hash:
				c.AbortWithStatusJSON(http.StatusConflict, gin.H{"error": "idempotency key reused with a different payload"})
			default:
				// Genuine replay: return the original response, handler not run.
				c.Data(existing.ResponseCode, "application/json; charset=utf-8", existing.ResponseBody)
				c.Abort()
			}
			return
		}

		// We own the claim. Buffer the response so we can persist it.
		rec := &recordingWriter{ResponseWriter: c.Writer, buf: &bytes.Buffer{}}
		c.Writer = rec

		c.Next()

		status := rec.status()
		if status >= http.StatusOK && status < http.StatusMultipleChoices {
			if err := store.Complete(c.Request.Context(), key, status, rec.buf.Bytes()); err != nil {
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

func hashBody(body []byte) string {
	sum := sha256.Sum256(body)
	return hex.EncodeToString(sum[:])
}

func deriveKey(method, path, bodyHash string) string {
	sum := sha256.Sum256([]byte(method + "\n" + path + "\n" + bodyHash))
	return "auto:" + hex.EncodeToString(sum[:])
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
	db *pgxpool.Pool
}

// NewIdempotencyStore returns an IdempotencyStore backed by the main pool.
func NewIdempotencyStore(db *pgxpool.Pool) IdempotencyStore {
	return &pgIdempotencyStore{db: db}
}

func (s *pgIdempotencyStore) Claim(ctx context.Context, key, requestHash string) (bool, *IdempotencyRecord, error) {
	// One atomic claim: insert wins the race, ON CONFLICT DO NOTHING loses it.
	tag, err := s.db.Exec(ctx,
		`INSERT INTO idempotency_keys (key, request_hash) VALUES ($1, $2)
		 ON CONFLICT (key) DO NOTHING`, key, requestHash)
	if err != nil {
		return false, nil, err
	}
	if tag.RowsAffected() == 1 {
		return true, nil, nil
	}

	var rec IdempotencyRecord
	err = s.db.QueryRow(ctx,
		`SELECT request_hash, response_code, response_body FROM idempotency_keys WHERE key = $1`, key).
		Scan(&rec.RequestHash, &rec.ResponseCode, &rec.ResponseBody)
	if err != nil {
		return false, nil, err
	}
	return false, &rec, nil
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

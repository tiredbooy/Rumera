package middlewares

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/tiredbooy/internal/features/users"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/response"
	"github.com/tiredbooy/pkg/token"
)

// Context keys. The public UUID is stored under ctxKeyUserID so the analytics
// middleware (which type-asserts uuid.UUID) keeps working untouched, while the
// internal numeric id lives under ctxKeyUID for the user-scoped services.
const (
	ctxKeyUserID = "userID" // uuid.UUID — public identifier
	ctxKeyUID    = "uid"    // int64    — internal users.id
	ctxKeyRole   = "role"   // string
)

// AuthUserReader is the live account projection required after JWT validation.
// The token proves possession; users.role and users.is_active remain the source
// of authorization truth for every protected request.
type AuthUserReader interface {
	GetAuthUserByUID(ctx context.Context, uid int64) (*users.AuthUser, error)
}

// Auth validates the bearer access token, rehydrates the account from the live
// database, and injects that live identity into the request context. A stale
// token cannot preserve access after role demotion or account deactivation.
func Auth(jwt token.Manager, accounts AuthUserReader) gin.HandlerFunc {
	return func(c *gin.Context) {
		raw, ok := bearerToken(c)
		if !ok {
			abort(c, response.ErrMissingToken)
			return
		}

		claims, err := jwt.ValidateAccessToken(raw)
		if err != nil {
			abort(c, response.ErrInvalidToken)
			return
		}

		claimUserID, err := uuid.Parse(claims.UserID)
		if err != nil || claims.UID <= 0 {
			abort(c, response.ErrInvalidToken)
			return
		}
		if accounts == nil {
			abort(c, response.ErrInternalError)
			return
		}
		live, err := accounts.GetAuthUserByUID(c.Request.Context(), claims.UID)
		if err != nil {
			if errors.Is(err, models.ErrNotFound) {
				abort(c, response.ErrInvalidToken)
			} else {
				abort(c, response.ErrInternalError)
			}
			return
		}
		if live == nil || !live.IsActive || live.IsBanned || live.ID != claims.UID ||
			live.UserID != claimUserID || !users.IsAssignableUserRole(live.Role) {
			abort(c, response.ErrInvalidToken)
			return
		}
		if sessionInvalidated(live, claims) {
			abort(c, response.ErrInvalidToken)
			return
		}

		c.Set(ctxKeyUserID, live.UserID)
		c.Set(ctxKeyUID, live.ID)
		c.Set(ctxKeyRole, live.Role)

		c.Next()
	}
}

// OptionalAuth populates identity when a valid token is present but never
// rejects the request. Valid token claims are still rehydrated before they are
// trusted; stale or inactive identities simply proceed as anonymous.
func OptionalAuth(jwt token.Manager, accounts AuthUserReader) gin.HandlerFunc {
	return func(c *gin.Context) {
		raw, ok := bearerToken(c)
		if !ok {
			c.Next()
			return
		}
		claims, err := jwt.ValidateAccessToken(raw)
		if err != nil || accounts == nil || claims.UID <= 0 {
			c.Next()
			return
		}
		claimUserID, err := uuid.Parse(claims.UserID)
		if err != nil {
			c.Next()
			return
		}
		live, err := accounts.GetAuthUserByUID(c.Request.Context(), claims.UID)
		if err == nil && live != nil && live.IsActive && !live.IsBanned && live.ID == claims.UID &&
			live.UserID == claimUserID && users.IsAssignableUserRole(live.Role) &&
			!sessionInvalidated(live, claims) {
			c.Set(ctxKeyUserID, live.UserID)
			c.Set(ctxKeyUID, live.ID)
			c.Set(ctxKeyRole, live.Role)
		}
		c.Next()
	}
}

// sessionInvalidated reports whether the token was issued strictly before a
// hard logout (password reset). Tokens without IssuedAt are treated as invalid
// when a cutover timestamp exists — fail closed. Equal timestamps are allowed
// so a login in the same second as the cutover still works.
func sessionInvalidated(live *users.AuthUser, claims *token.Claims) bool {
	if live == nil || live.SessionsInvalidatedAt == nil {
		return false
	}
	cutover := live.SessionsInvalidatedAt.UTC()
	if claims.IssuedAt == nil {
		return true
	}
	return claims.IssuedAt.Time.UTC().Before(cutover)
}

// SessionStillValid is exported for the refresh path, which reloads the user
// outside middleware and must apply the same cutover rule.
func SessionStillValid(invalidatedAt *time.Time, issuedAt time.Time) bool {
	if invalidatedAt == nil {
		return true
	}
	return !issuedAt.UTC().Before(invalidatedAt.UTC())
}

// RequireRole guards a route group, allowing only callers whose role matches one
// of the supplied roles. It must run after Auth.
func RequireRole(roles ...string) gin.HandlerFunc {
	allowed := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		allowed[r] = struct{}{}
	}
	return func(c *gin.Context) {
		role, _ := c.Get(ctxKeyRole)
		current, _ := role.(string)
		if _, ok := allowed[current]; !ok {
			abort(c, response.ErrInsufficientPermissions)
			return
		}
		c.Next()
	}
}

// ── Context accessors ──────────────────────────────────────────────────────

// UID returns the internal numeric user id set by Auth.
func UID(c *gin.Context) (int64, bool) {
	v, ok := c.Get(ctxKeyUID)
	if !ok {
		return 0, false
	}
	id, ok := v.(int64)
	return id, ok && id > 0
}

// UserUUID returns the public uuid identifier set by Auth.
func UserUUID(c *gin.Context) (uuid.UUID, bool) {
	v, ok := c.Get(ctxKeyUserID)
	if !ok {
		return uuid.UUID{}, false
	}
	id, ok := v.(uuid.UUID)
	return id, ok
}

// Role returns the caller's role, or "" when unauthenticated.
func Role(c *gin.Context) string {
	v, _ := c.Get(ctxKeyRole)
	r, _ := v.(string)
	return r
}

// ── helpers ────────────────────────────────────────────────────────────────

func bearerToken(c *gin.Context) (string, bool) {
	h := c.GetHeader("Authorization")
	if h == "" {
		return "", false
	}
	const prefix = "Bearer "
	if len(h) <= len(prefix) || !strings.EqualFold(h[:len(prefix)], prefix) {
		return "", false
	}
	tok := strings.TrimSpace(h[len(prefix):])
	return tok, tok != ""
}

func abort(c *gin.Context, code response.AppCode) {
	response.Error(c, code)
	c.Abort()
}

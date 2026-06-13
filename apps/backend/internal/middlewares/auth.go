package middlewares

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
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

// Auth validates the bearer access token and injects the caller's identity into
// the request context. Requests without a valid token are rejected with 401.
func Auth(jwt token.Manager) gin.HandlerFunc {
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

		if uid, err := uuid.Parse(claims.UserID); err == nil {
			c.Set(ctxKeyUserID, uid)
		}
		c.Set(ctxKeyUID, claims.UID)
		c.Set(ctxKeyRole, claims.Role)

		c.Next()
	}
}

// OptionalAuth populates identity when a valid token is present but never
// rejects the request. Useful for endpoints that personalise output for logged
// in users yet stay public (e.g. product listings).
func OptionalAuth(jwt token.Manager) gin.HandlerFunc {
	return func(c *gin.Context) {
		raw, ok := bearerToken(c)
		if !ok {
			c.Next()
			return
		}
		if claims, err := jwt.ValidateAccessToken(raw); err == nil {
			if uid, err := uuid.Parse(claims.UserID); err == nil {
				c.Set(ctxKeyUserID, uid)
			}
			c.Set(ctxKeyUID, claims.UID)
			c.Set(ctxKeyRole, claims.Role)
		}
		c.Next()
	}
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

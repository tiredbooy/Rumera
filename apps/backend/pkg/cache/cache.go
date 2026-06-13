package cache

import (
	"context"
	"strconv"
	"time"
)

type Store interface {
	// Set stores a string value with a TTL. Pass 0 for no expiry.
	Set(ctx context.Context, key, value string, ttl time.Duration) error

	// Get retrieves a value. Returns ErrNotFound if the key doesn't exist.
	Get(ctx context.Context, key string) (string, error)

	// Incr atomically increments the integer value of a key and returns the new
	// value. On the first increment (value goes from absent to 1) the given TTL
	// is applied, giving a fixed-window counter. Pass 0 to leave TTL untouched.
	Incr(ctx context.Context, key string, ttl time.Duration) (int64, error)

	// Delete removes one or more keys. Does not error if keys don't exist.
	Delete(ctx context.Context, keys ...string) error

	// Exists reports whether a key is present.
	Exists(ctx context.Context, key string) (bool, error)

	// TTL returns the remaining lifetime of a key.
	TTL(ctx context.Context, key string) (time.Duration, error)

	// Ping verifies connectivity to the backing store. Used by readiness checks.
	Ping(ctx context.Context) error

	// Close shuts down the client cleanly.
	Close() error
}

// ======= HELPERS =======
func KeyRefreshToken(jti string) string  { return "refresh:" + jti }
func KeyCSRF(userID string) string       { return "csrf:" + userID }
func KeySession(sessionID string) string { return "session:" + sessionID }
func KeyRateLimit(ip string) string      { return "rl:" + ip }
func KeyCart(userID string) string       { return "cart:" + userID }
func KeyBlacklist(jti string) string     { return "blacklist:" + jti }

// KeyLoginAttempts is the fixed-window counter for failed/attempted logins,
// scoped by client identifier (IP or email).
func KeyLoginAttempts(scope string) string { return "rl:login:" + scope }

// KeyProduct / KeyCategoryTree are read-through cache keys for hot catalogue
// reads. Bump the version prefix to invalidate the whole namespace at once.
func KeyProduct(id int64) string { return "product:v1:" + strconv.FormatInt(id, 10) }
func KeyCategoryTree() string    { return "category:v1:tree" }

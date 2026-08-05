package cache

import (
	"context"
	"strconv"
	"time"
)

// Rotation describes an atomic single-use credential handoff. The current key
// is consumed only when its value matches, then both the replacement key and a
// short-lived replay result are written in the same Redis script.
type Rotation struct {
	CurrentKey       string
	ExpectedValue    string
	ReplacementKey   string
	ReplacementValue string
	ReplacementTTL   time.Duration
	ReplayKey        string
	ReplayValue      string
	ReplayTTL        time.Duration
}

type Store interface {
	// Set stores a string value with a TTL. Pass 0 for no expiry.
	Set(ctx context.Context, key, value string, ttl time.Duration) error

	// Get retrieves a value. Returns ErrNotFound if the key doesn't exist.
	Get(ctx context.Context, key string) (string, error)

	// Rotate atomically consumes a current value and installs its replacement.
	// It returns false without mutation when the current key is absent or differs.
	Rotate(ctx context.Context, rotation Rotation) (bool, error)

	// RevokeRotation atomically removes a current credential and reads its replay
	// record. The replay remains until its TTL expires so an interrupted
	// revocation can safely retry the chain. It returns ErrNotFound when no replay
	// record was present; the current credential is still removed in that case.
	RevokeRotation(ctx context.Context, currentKey, replayKey string) (string, error)

	// Incr atomically increments the integer value of a key and returns the new
	// value. On the first increment (value goes from absent to 1) the given TTL
	// is applied, giving a fixed-window counter. Pass 0 to leave TTL untouched.
	Incr(ctx context.Context, key string, ttl time.Duration) (int64, error)

	// Delete removes one or more keys. Does not error if keys don't exist.
	Delete(ctx context.Context, keys ...string) error

	// KeysByPrefix returns every key matching prefix* (Redis SCAN). Used for
	// bulk session revocation; implementations may return empty on unsupported
	// stores.
	KeysByPrefix(ctx context.Context, prefix string) ([]string, error)

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
func KeyRefreshReplay(jti string) string { return "refresh:replay:" + jti }

// KeyRefreshUserIndex tracks a refresh jti under a per-user prefix so password
// reset can revoke every active refresh without scanning the whole keyspace.
// Format: refresh:user:{userUUID}:{jti}
func KeyRefreshUserIndex(userUUID, jti string) string {
	return "refresh:user:" + userUUID + ":" + jti
}

// KeyRefreshUserIndexPrefix is the SCAN prefix for all refresh indexes of a user.
func KeyRefreshUserIndexPrefix(userUUID string) string {
	return "refresh:user:" + userUUID + ":"
}

// RefreshJTIFromUserIndex extracts the jti from a KeyRefreshUserIndex key.
func RefreshJTIFromUserIndex(key, userUUID string) string {
	prefix := KeyRefreshUserIndexPrefix(userUUID)
	if len(key) <= len(prefix) || key[:len(prefix)] != prefix {
		return ""
	}
	return key[len(prefix):]
}
func KeyCSRF(userID string) string       { return "csrf:" + userID }
func KeySession(sessionID string) string { return "session:" + sessionID }
func KeyRateLimit(ip string) string      { return "rl:" + ip }
func KeyCart(userID string) string       { return "cart:" + userID }
func KeyBlacklist(jti string) string     { return "blacklist:" + jti }

// KeyLoginAttempts is the fixed-window counter for failed/attempted logins,
// scoped by client identifier (IP or email).
func KeyLoginAttempts(scope string) string { return "rl:login:" + scope }

// OTP login keys, all scoped by canonical phone number:
//
//	KeyOTP        — the active code (short TTL).
//	KeyOTPSend    — fixed-window counter capping codes requested per phone.
//	KeyOTPVerify  — fixed-window counter capping verify attempts per code.
func KeyOTP(phone string) string       { return "otp:code:" + phone }
func KeyOTPSend(phone string) string   { return "otp:send:" + phone }
func KeyOTPVerify(phone string) string { return "otp:try:" + phone }

// KeyProduct / KeyCategoryTree are read-through cache keys for hot catalogue
// reads. Bump the version prefix to invalidate the whole namespace at once.
func KeyProduct(id int64) string { return "product:v1:" + strconv.FormatInt(id, 10) }
func KeyCategoryTree() string    { return "category:v1:tree" }

// KeyRecipe caches a hydrated public recipe detail by slug. Bump the version
// prefix to invalidate the whole recipe namespace at once.
func KeyRecipe(slug string) string { return "recipe:v1:" + slug }

// KeySiteSettings caches the public storefront settings document. There is one
// settings row, so the key is a constant; admin writes invalidate it.
func KeySiteSettings() string { return "site_settings:v1:public" }

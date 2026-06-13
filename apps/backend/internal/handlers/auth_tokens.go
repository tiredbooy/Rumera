package handlers

import (
	"context"

	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/token"
)

// Refresh-token strategy
// ──────────────────────
// Access tokens are stateless and short-lived. Refresh tokens are long-lived,
// so we back them with a Redis **whitelist**: a refresh token is only accepted
// if its jti is still present in the store. This gives us three properties for
// free:
//
//   - rotation — every refresh deletes the old jti and stores a new one, so a
//     refresh token can be used at most once.
//   - revocation — logout deletes the jti, immediately invalidating the token.
//   - expiry — the Redis entry carries the same TTL as the token itself.
//
// When no cache is configured the system degrades gracefully to plain stateless
// refresh tokens (no rotation/revocation), so local development without Redis
// still works.

// issueTokens generates a fresh access/refresh pair and, when a cache is
// present, registers the refresh token's jti in the whitelist.
func (h *Handler) issueTokens(ctx context.Context, uid int64, userUUID, role string) (token.TokenPair, error) {
	pair, err := h.JWT.Generate(uid, userUUID, role)
	if err != nil {
		return token.TokenPair{}, err
	}
	if h.Cache != nil {
		if claims, err := h.JWT.ValidateRefreshToken(pair.Refresh); err == nil {
			// Best-effort: a Redis hiccup must not block login. The token is still
			// cryptographically valid; worst case it simply isn't rotatable.
			_ = h.Cache.Set(ctx, cache.KeyRefreshToken(claims.ID), userUUID, h.RefreshTTL)
		}
	}
	return pair, nil
}

// consumeRefresh validates a refresh token and, when a cache is present,
// verifies its jti is still whitelisted and then deletes it (single-use
// rotation). Returns the parsed claims on success.
func (h *Handler) consumeRefresh(ctx context.Context, refreshToken string) (*token.Claims, bool) {
	claims, err := h.JWT.ValidateRefreshToken(refreshToken)
	if err != nil {
		return nil, false
	}
	if h.Cache != nil {
		exists, err := h.Cache.Exists(ctx, cache.KeyRefreshToken(claims.ID))
		if err != nil || !exists {
			// Unknown jti → revoked, already rotated, or issued before Redis came
			// up. Reject.
			return nil, false
		}
		_ = h.Cache.Delete(ctx, cache.KeyRefreshToken(claims.ID))
	}
	return claims, true
}

// revokeRefresh removes a refresh token's jti from the whitelist, if valid.
// Used by logout. Silently ignores invalid tokens — logout is idempotent.
func (h *Handler) revokeRefresh(ctx context.Context, refreshToken string) {
	if h.Cache == nil || refreshToken == "" {
		return
	}
	if claims, err := h.JWT.ValidateRefreshToken(refreshToken); err == nil {
		_ = h.Cache.Delete(ctx, cache.KeyRefreshToken(claims.ID))
	}
}

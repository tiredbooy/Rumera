package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/token"
)

const refreshReplayTTL = 10 * time.Second

var (
	errInvalidRefreshToken  = errors.New("invalid refresh token")
	errInvalidRefreshReplay = errors.New("invalid refresh replay")
)

type refreshReplay struct {
	Access  string `json:"access_token"`
	Refresh string `json:"refresh_token"`
	UserID  string `json:"user_id"`
}

// Refresh-token strategy
// ──────────────────────
// Access tokens are stateless and short-lived. Refresh tokens are long-lived,
// so we back them with a Redis **whitelist**: a refresh token is only accepted
// if its jti is still present in the store. This gives us three properties for
// free:
//
//   - rotation — every refresh atomically replaces the old jti with a new one;
//     concurrent retries receive the same short-lived replay result.
//   - revocation — logout deletes the jti, immediately invalidating the token.
//   - expiry — the Redis entry carries the same TTL as the token itself.
//
// When no cache is configured the system degrades gracefully to plain stateless
// refresh tokens (no rotation/revocation), so local development without Redis
// still works.

// issueTokens generates a fresh access/refresh pair and registers the refresh
// token's jti in the Redis whitelist. Without a working whitelist we still
// return a short-lived access token (callers may strip Refresh on error) but
// never a long-lived refresh credential that cannot be revoked.
func (h *Handler) issueTokens(ctx context.Context, uid int64, userUUID, role string) (token.TokenPair, error) {
	pair, err := h.JWT.Generate(uid, userUUID, role)
	if err != nil {
		return token.TokenPair{}, err
	}
	if h.Cache == nil {
		// Refuse to hand out an unrevocable refresh token.
		pair.Refresh = ""
		return pair, fmt.Errorf("refresh whitelist unavailable")
	}
	claims, err := h.JWT.ValidateRefreshToken(pair.Refresh)
	if err != nil {
		pair.Refresh = ""
		return pair, fmt.Errorf("validate issued refresh token: %w", err)
	}
	if err := h.Cache.Set(ctx, cache.KeyRefreshToken(claims.ID), userUUID, h.RefreshTTL); err != nil {
		pair.Refresh = ""
		return pair, fmt.Errorf("whitelist refresh token: %w", err)
	}
	// Secondary index so password-reset can wipe every refresh for this user.
	_ = h.Cache.Set(ctx, cache.KeyRefreshUserIndex(userUUID, claims.ID), "1", h.RefreshTTL)
	return pair, nil
}

// InvalidateUserSessions removes every refresh-token whitelist entry tracked
// for the given public user UUID. Implements services.SessionKiller.
func (h *Handler) InvalidateUserSessions(ctx context.Context, userUUID string) error {
	if h.Cache == nil || userUUID == "" {
		return nil
	}
	// Index keys use a known prefix; ScanByPrefix is best-effort. Access tokens
	// are already dead via sessions_invalidated_at even if this no-ops.
	keys, err := h.Cache.KeysByPrefix(ctx, cache.KeyRefreshUserIndexPrefix(userUUID))
	if err != nil {
		return err
	}
	toDelete := make([]string, 0, len(keys)*2)
	for _, k := range keys {
		jti := cache.RefreshJTIFromUserIndex(k, userUUID)
		if jti == "" {
			continue
		}
		toDelete = append(toDelete,
			cache.KeyRefreshToken(jti),
			cache.KeyRefreshReplay(jti),
			k,
		)
	}
	if len(toDelete) == 0 {
		return nil
	}
	return h.Cache.Delete(ctx, toDelete...)
}

func (h *Handler) validateRefresh(refreshToken string) (*token.Claims, bool) {
	claims, err := h.JWT.ValidateRefreshToken(refreshToken)
	if err != nil {
		return nil, false
	}
	return claims, true
}

// rotateTokens atomically replaces the old whitelist entry with the new one.
// A short replay record makes concurrent requests for the same old token return
// the identical pair, so response ordering cannot overwrite a successful
// Auth.js cookie with a losing refresh result.
func (h *Handler) rotateTokens(
	ctx context.Context,
	current *token.Claims,
	uid int64,
	userUUID, role string,
) (token.TokenPair, bool, error) {
	if h.Cache == nil {
		return token.TokenPair{}, false, fmt.Errorf("refresh whitelist unavailable")
	}

	if pair, ok, err := h.getRefreshReplay(ctx, current); err != nil || ok {
		return pair, ok, err
	}

	pair, err := h.JWT.Generate(uid, userUUID, role)
	if err != nil {
		return token.TokenPair{}, false, err
	}
	replacement, err := h.JWT.ValidateRefreshToken(pair.Refresh)
	if err != nil {
		return token.TokenPair{}, false, fmt.Errorf("validate replacement refresh token: %w", err)
	}
	replayJSON, err := json.Marshal(refreshReplay{
		Access: pair.Access, Refresh: pair.Refresh, UserID: userUUID,
	})
	if err != nil {
		return token.TokenPair{}, false, fmt.Errorf("marshal refresh replay: %w", err)
	}

	rotated, err := h.Cache.Rotate(ctx, cache.Rotation{
		CurrentKey:       cache.KeyRefreshToken(current.ID),
		ExpectedValue:    userUUID,
		ReplacementKey:   cache.KeyRefreshToken(replacement.ID),
		ReplacementValue: userUUID,
		ReplacementTTL:   h.RefreshTTL,
		ReplayKey:        cache.KeyRefreshReplay(current.ID),
		ReplayValue:      string(replayJSON),
		ReplayTTL:        refreshReplayTTL,
	})
	if err != nil {
		return token.TokenPair{}, false, fmt.Errorf("rotate refresh token: %w", err)
	}
	if rotated {
		// Track the new jti; drop the old index entry (best-effort).
		_ = h.Cache.Set(ctx, cache.KeyRefreshUserIndex(userUUID, replacement.ID), "1", h.RefreshTTL)
		_ = h.Cache.Delete(ctx, cache.KeyRefreshUserIndex(userUUID, current.ID))
		return pair, true, nil
	}

	// Another request may have completed the same rotation between our first
	// replay read and the atomic compare. Return its exact pair if so.
	return h.getRefreshReplay(ctx, current)
}

func (h *Handler) getRefreshReplay(
	ctx context.Context,
	current *token.Claims,
) (token.TokenPair, bool, error) {
	raw, err := h.Cache.Get(ctx, cache.KeyRefreshReplay(current.ID))
	if errors.Is(err, cache.ErrNotFound) {
		return token.TokenPair{}, false, nil
	}
	if err != nil {
		return token.TokenPair{}, false, fmt.Errorf("read refresh replay: %w", err)
	}
	replay, replacement, valid, err := h.parseRefreshReplay(raw, current)
	if err != nil {
		return token.TokenPair{}, false, err
	}
	if !valid {
		return token.TokenPair{}, false, nil
	}
	whitelistedUserID, err := h.Cache.Get(ctx, cache.KeyRefreshToken(replacement.ID))
	if errors.Is(err, cache.ErrNotFound) {
		return token.TokenPair{}, false, nil
	}
	if err != nil {
		return token.TokenPair{}, false, fmt.Errorf("verify refresh replay replacement: %w", err)
	}
	if whitelistedUserID != current.UserID {
		return token.TokenPair{}, false, nil
	}
	return token.TokenPair{Access: replay.Access, Refresh: replay.Refresh}, true, nil
}

func (h *Handler) parseRefreshReplay(
	raw string,
	current *token.Claims,
) (refreshReplay, *token.Claims, bool, error) {
	var replay refreshReplay
	if err := json.Unmarshal([]byte(raw), &replay); err != nil {
		return refreshReplay{}, nil, false, fmt.Errorf("decode refresh replay: %w", err)
	}
	replacement, err := h.JWT.ValidateRefreshToken(replay.Refresh)
	if err != nil {
		return refreshReplay{}, nil, false, nil
	}
	access, err := h.JWT.ValidateAccessToken(replay.Access)
	if err != nil || replay.UserID != current.UserID || replacement.UserID != current.UserID ||
		access.UserID != current.UserID || access.UID != current.UID ||
		replacement.UID != current.UID {
		return refreshReplay{}, nil, false, nil
	}
	return replay, replacement, true, nil
}

// revokeRefresh consumes the supplied token and follows any short-lived replay
// chain to revoke the currently active replacement. Whitelist entries are
// removed atomically while replay links remain until their short TTL expires,
// making a partially completed traversal safe to retry.
func (h *Handler) revokeRefresh(ctx context.Context, refreshToken string) error {
	if refreshToken == "" {
		return errInvalidRefreshToken
	}
	claims, err := h.JWT.ValidateRefreshToken(refreshToken)
	if err != nil {
		return errInvalidRefreshToken
	}
	if h.Cache == nil {
		return nil
	}

	current := claims
	seen := make(map[string]struct{})
	for {
		if _, exists := seen[current.ID]; exists {
			return errors.New("refresh replay chain contains a cycle")
		}
		seen[current.ID] = struct{}{}

		raw, err := h.Cache.RevokeRotation(
			ctx,
			cache.KeyRefreshToken(current.ID),
			cache.KeyRefreshReplay(current.ID),
		)
		if errors.Is(err, cache.ErrNotFound) {
			return nil
		}
		if err != nil {
			return fmt.Errorf("revoke refresh rotation: %w", err)
		}
		_, replacement, valid, err := h.parseRefreshReplay(raw, current)
		if err != nil {
			return err
		}
		if !valid {
			return errInvalidRefreshReplay
		}
		current = replacement
	}
}

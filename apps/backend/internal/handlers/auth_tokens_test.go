package handlers

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	config "github.com/tiredbooy/configs"
	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/token"
	"go.uber.org/zap"
)

func newAuthTokenTestHandler(store cache.Store) *Handler {
	manager := token.NewManager(&config.Config{
		JWTSecret:          "auth-token-test-secret",
		JWTAccessTokenTTL:  15,
		JWTRefreshTokenTTL: 60,
	}, zap.NewNop())
	return New(Deps{JWT: manager, Cache: store, RefreshTTL: time.Hour})
}

func TestConcurrentRefreshRotationReturnsOneIdempotentPair(t *testing.T) {
	store := newFakeCache()
	h := newAuthTokenTestHandler(store)
	userID := uuid.New().String()
	pair, err := h.issueTokens(context.Background(), 42, userID, "admin")
	if err != nil {
		t.Fatalf("issue tokens: %v", err)
	}
	claims, ok := h.validateRefresh(pair.Refresh)
	if !ok {
		t.Fatal("issued refresh token did not validate")
	}

	const attempts = 32
	results := make(chan token.TokenPair, attempts)
	errs := make(chan error, attempts)
	var wg sync.WaitGroup
	wg.Add(attempts)
	for range attempts {
		go func() {
			defer wg.Done()
			rotated, valid, err := h.rotateTokens(context.Background(), claims, 42, userID, "admin")
			if err != nil {
				errs <- err
				return
			}
			if !valid {
				errs <- errors.New("rotation rejected")
				return
			}
			results <- rotated
		}()
	}
	wg.Wait()
	close(results)
	close(errs)

	for err := range errs {
		t.Fatalf("concurrent rotation: %v", err)
	}
	var expected token.TokenPair
	count := 0
	for result := range results {
		if count == 0 {
			expected = result
		} else if result != expected {
			t.Fatalf("rotation %d returned a different pair", count+1)
		}
		count++
	}
	if count != attempts {
		t.Fatalf("successful rotations = %d; want %d", count, attempts)
	}
	if err := h.revokeRefresh(context.Background(), expected.Refresh); err != nil {
		t.Fatalf("revoke replacement: %v", err)
	}
	if _, valid, err := h.rotateTokens(context.Background(), claims, 42, userID, "admin"); err != nil || valid {
		t.Fatalf("old-token replay after replacement logout = valid %v, err %v", valid, err)
	}
}

func TestRevokeRotatedRefreshFollowsReplayChain(t *testing.T) {
	store := newFakeCache()
	h := newAuthTokenTestHandler(store)
	userID := uuid.New().String()
	original, err := h.issueTokens(context.Background(), 42, userID, "admin")
	if err != nil {
		t.Fatalf("issue tokens: %v", err)
	}
	originalClaims, ok := h.validateRefresh(original.Refresh)
	if !ok {
		t.Fatal("issued refresh token did not validate")
	}

	first, ok, err := h.rotateTokens(context.Background(), originalClaims, 42, userID, "admin")
	if err != nil || !ok {
		t.Fatalf("first rotation = valid %v, err %v", ok, err)
	}
	firstClaims, ok := h.validateRefresh(first.Refresh)
	if !ok {
		t.Fatal("first replacement did not validate")
	}
	second, ok, err := h.rotateTokens(context.Background(), firstClaims, 42, userID, "admin")
	if err != nil || !ok {
		t.Fatalf("second rotation = valid %v, err %v", ok, err)
	}
	secondClaims, ok := h.validateRefresh(second.Refresh)
	if !ok {
		t.Fatal("second replacement did not validate")
	}

	if err := h.revokeRefresh(context.Background(), original.Refresh); err != nil {
		t.Fatalf("revoke original refresh: %v", err)
	}
	for _, key := range []string{
		cache.KeyRefreshToken(originalClaims.ID),
		cache.KeyRefreshToken(firstClaims.ID),
		cache.KeyRefreshToken(secondClaims.ID),
	} {
		if _, err := store.Get(context.Background(), key); !errors.Is(err, cache.ErrNotFound) {
			t.Fatalf("revoked chain key %q lookup = %v; want ErrNotFound", key, err)
		}
	}
	for _, key := range []string{
		cache.KeyRefreshReplay(originalClaims.ID),
		cache.KeyRefreshReplay(firstClaims.ID),
	} {
		if _, err := store.Get(context.Background(), key); err != nil {
			t.Fatalf("retryable replay key %q lookup = %v; want retained replay", key, err)
		}
	}
	if err := h.revokeRefresh(context.Background(), original.Refresh); err != nil {
		t.Fatalf("retry revoke original refresh: %v", err)
	}
	if _, valid, err := h.rotateTokens(context.Background(), secondClaims, 42, userID, "admin"); err != nil || valid {
		t.Fatalf("active descendant after original logout = valid %v, err %v", valid, err)
	}
}

func TestRevokeRefreshRetryAfterAmbiguousCacheWriteRevokesReplacement(t *testing.T) {
	store := newFakeCache()
	h := newAuthTokenTestHandler(store)
	userID := uuid.New().String()
	original, err := h.issueTokens(context.Background(), 42, userID, "admin")
	if err != nil {
		t.Fatalf("issue tokens: %v", err)
	}
	originalClaims, ok := h.validateRefresh(original.Refresh)
	if !ok {
		t.Fatal("issued refresh token did not validate")
	}
	replacement, ok, err := h.rotateTokens(context.Background(), originalClaims, 42, userID, "admin")
	if err != nil || !ok {
		t.Fatalf("rotate tokens = valid %v, err %v", ok, err)
	}
	replacementClaims, ok := h.validateRefresh(replacement.Refresh)
	if !ok {
		t.Fatal("replacement refresh token did not validate")
	}

	store.revokeAfterMutationErr = errors.New("redis response lost")
	if err := h.revokeRefresh(context.Background(), original.Refresh); err == nil {
		t.Fatal("revokeRefresh hid an ambiguous cache write")
	}
	if err := h.revokeRefresh(context.Background(), original.Refresh); err != nil {
		t.Fatalf("retry revoke refresh: %v", err)
	}
	if _, err := store.Get(context.Background(), cache.KeyRefreshToken(replacementClaims.ID)); !errors.Is(err, cache.ErrNotFound) {
		t.Fatalf("replacement remained whitelisted after retry: %v", err)
	}
}

func TestRefreshRotationAfterLogoutIsRejected(t *testing.T) {
	store := newFakeCache()
	h := newAuthTokenTestHandler(store)
	userID := uuid.New().String()
	pair, err := h.issueTokens(context.Background(), 42, userID, "admin")
	if err != nil {
		t.Fatalf("issue tokens: %v", err)
	}
	claims, ok := h.validateRefresh(pair.Refresh)
	if !ok {
		t.Fatal("issued refresh token did not validate")
	}
	if err := h.revokeRefresh(context.Background(), pair.Refresh); err != nil {
		t.Fatalf("revoke refresh: %v", err)
	}
	if _, valid, err := h.rotateTokens(context.Background(), claims, 42, userID, "admin"); err != nil || valid {
		t.Fatalf("rotation after logout = valid %v, err %v", valid, err)
	}
}

func TestConcurrentRefreshRotationAndLogoutLeavesNoActiveReplacement(t *testing.T) {
	type rotateResult struct {
		pair  token.TokenPair
		valid bool
		err   error
	}

	for attempt := 0; attempt < 64; attempt++ {
		store := newFakeCache()
		h := newAuthTokenTestHandler(store)
		userID := uuid.New().String()
		original, err := h.issueTokens(context.Background(), 42, userID, "admin")
		if err != nil {
			t.Fatalf("attempt %d issue tokens: %v", attempt, err)
		}
		claims, ok := h.validateRefresh(original.Refresh)
		if !ok {
			t.Fatalf("attempt %d issued refresh token did not validate", attempt)
		}

		start := make(chan struct{})
		rotationResult := make(chan rotateResult, 1)
		revokeResult := make(chan error, 1)
		go func() {
			<-start
			pair, valid, err := h.rotateTokens(context.Background(), claims, 42, userID, "admin")
			rotationResult <- rotateResult{pair: pair, valid: valid, err: err}
		}()
		go func() {
			<-start
			revokeResult <- h.revokeRefresh(context.Background(), original.Refresh)
		}()
		close(start)

		rotation := <-rotationResult
		if rotation.err != nil {
			t.Fatalf("attempt %d concurrent rotation: %v", attempt, rotation.err)
		}
		if err := <-revokeResult; err != nil {
			t.Fatalf("attempt %d concurrent revoke: %v", attempt, err)
		}
		if rotation.valid {
			replacement, ok := h.validateRefresh(rotation.pair.Refresh)
			if !ok {
				t.Fatalf("attempt %d replacement did not validate", attempt)
			}
			if _, err := store.Get(context.Background(), cache.KeyRefreshToken(replacement.ID)); !errors.Is(err, cache.ErrNotFound) {
				t.Fatalf("attempt %d replacement remained whitelisted: %v", attempt, err)
			}
		}
		if _, valid, err := h.rotateTokens(context.Background(), claims, 42, userID, "admin"); err != nil || valid {
			t.Fatalf("attempt %d original after logout = valid %v, err %v", attempt, valid, err)
		}
	}
}

func TestIssueAndRevokeRefreshFailClosedOnCacheErrors(t *testing.T) {
	store := newFakeCache()
	store.setErr = errors.New("redis down")
	h := newAuthTokenTestHandler(store)
	userID := uuid.New().String()

	if _, err := h.issueTokens(context.Background(), 42, userID, "admin"); err == nil {
		t.Fatal("issueTokens succeeded without persisting the refresh whitelist")
	}

	store.setErr = nil
	pair, err := h.issueTokens(context.Background(), 42, userID, "admin")
	if err != nil {
		t.Fatalf("issue tokens: %v", err)
	}
	store.deleteErr = errors.New("redis down")
	if err := h.revokeRefresh(context.Background(), pair.Refresh); err == nil {
		t.Fatal("revokeRefresh hid a cache deletion failure")
	}
	if err := h.revokeRefresh(context.Background(), "not-a-token"); !errors.Is(err, errInvalidRefreshToken) {
		t.Fatalf("invalid revoke error = %v; want errInvalidRefreshToken", err)
	}
}

func TestRotateRefreshRejectsWhitelistIdentityMismatch(t *testing.T) {
	store := newFakeCache()
	h := newAuthTokenTestHandler(store)
	userID := uuid.New().String()
	pair, err := h.issueTokens(context.Background(), 42, userID, "admin")
	if err != nil {
		t.Fatalf("issue tokens: %v", err)
	}
	claims, err := h.JWT.ValidateRefreshToken(pair.Refresh)
	if err != nil {
		t.Fatalf("validate refresh token: %v", err)
	}
	if err := store.Set(context.Background(), cache.KeyRefreshToken(claims.ID), uuid.New().String(), time.Hour); err != nil {
		t.Fatalf("replace whitelist identity: %v", err)
	}

	rotated, ok, err := h.rotateTokens(context.Background(), claims, 42, userID, "admin")
	if err != nil {
		t.Fatalf("rotate refresh: %v", err)
	}
	if ok || rotated != (token.TokenPair{}) {
		t.Fatal("refresh token rotated under a different whitelisted identity")
	}
}

//go:build integration

package integration

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	config "github.com/tiredbooy/configs"
	"github.com/tiredbooy/pkg/cache"
	"go.uber.org/zap"
)

func TestRefreshRotationScriptIsAtomic(t *testing.T) {
	addr := os.Getenv("TEST_REDIS_ADDR")
	if addr == "" {
		t.Skip("TEST_REDIS_ADDR not set")
	}
	store, err := cache.NewRedis(&config.Config{RedisAddr: addr}, zap.NewNop())
	if err != nil {
		t.Fatalf("connect redis: %v", err)
	}
	t.Cleanup(func() { _ = store.Close() })

	ctx := context.Background()
	rotation := cache.Rotation{
		CurrentKey:       "test:refresh:old",
		ExpectedValue:    "user-1",
		ReplacementKey:   "test:refresh:new",
		ReplacementValue: "user-1",
		ReplacementTTL:   time.Minute,
		ReplayKey:        "test:refresh:replay",
		ReplayValue:      `{"access_token":"access","refresh_token":"refresh"}`,
		ReplayTTL:        10 * time.Second,
	}
	t.Cleanup(func() {
		_ = store.Delete(ctx, rotation.CurrentKey, rotation.ReplacementKey, rotation.ReplayKey)
	})
	if err := store.Set(ctx, rotation.CurrentKey, rotation.ExpectedValue, time.Minute); err != nil {
		t.Fatalf("seed current refresh: %v", err)
	}

	rotated, err := store.Rotate(ctx, rotation)
	if err != nil || !rotated {
		t.Fatalf("rotate = %v, %v; want true, nil", rotated, err)
	}
	if _, err := store.Get(ctx, rotation.CurrentKey); !errors.Is(err, cache.ErrNotFound) {
		t.Fatalf("old refresh lookup = %v; want ErrNotFound", err)
	}
	if got, err := store.Get(ctx, rotation.ReplacementKey); err != nil || got != "user-1" {
		t.Fatalf("replacement = %q, %v", got, err)
	}
	if got, err := store.Get(ctx, rotation.ReplayKey); err != nil || got != rotation.ReplayValue {
		t.Fatalf("replay = %q, %v", got, err)
	}
	if rotated, err := store.Rotate(ctx, rotation); err != nil || rotated {
		t.Fatalf("second rotation = %v, %v; want false, nil", rotated, err)
	}
	replay, err := store.RevokeRotation(ctx, rotation.CurrentKey, rotation.ReplayKey)
	if err != nil || replay != rotation.ReplayValue {
		t.Fatalf("revoke rotation replay = %q, %v", replay, err)
	}
	if got, err := store.Get(ctx, rotation.ReplayKey); err != nil || got != rotation.ReplayValue {
		t.Fatalf("retained replay = %q, %v; want retryable replay", got, err)
	}
	if replay, err := store.RevokeRotation(ctx, rotation.CurrentKey, rotation.ReplayKey); err != nil || replay != rotation.ReplayValue {
		t.Fatalf("retry revoke rotation replay = %q, %v", replay, err)
	}
	if _, err := store.RevokeRotation(ctx, rotation.ReplacementKey, "test:refresh:new-replay"); !errors.Is(err, cache.ErrNotFound) {
		t.Fatalf("revoke replacement = %v; want ErrNotFound after deleting active key", err)
	}
	if _, err := store.Get(ctx, rotation.ReplacementKey); !errors.Is(err, cache.ErrNotFound) {
		t.Fatalf("revoked replacement lookup = %v; want ErrNotFound", err)
	}

	logoutFirst := cache.Rotation{
		CurrentKey:       "test:refresh:logout-first",
		ExpectedValue:    "user-2",
		ReplacementKey:   "test:refresh:logout-first-new",
		ReplacementValue: "user-2",
		ReplacementTTL:   time.Minute,
		ReplayKey:        "test:refresh:logout-first-replay",
		ReplayValue:      `{"access_token":"access","refresh_token":"refresh"}`,
		ReplayTTL:        10 * time.Second,
	}
	t.Cleanup(func() {
		_ = store.Delete(ctx, logoutFirst.CurrentKey, logoutFirst.ReplacementKey, logoutFirst.ReplayKey)
	})
	if err := store.Set(ctx, logoutFirst.CurrentKey, logoutFirst.ExpectedValue, time.Minute); err != nil {
		t.Fatalf("seed logout-first refresh: %v", err)
	}
	if _, err := store.RevokeRotation(ctx, logoutFirst.CurrentKey, logoutFirst.ReplayKey); !errors.Is(err, cache.ErrNotFound) {
		t.Fatalf("logout-first revoke = %v; want ErrNotFound after deleting active key", err)
	}
	if rotated, err := store.Rotate(ctx, logoutFirst); err != nil || rotated {
		t.Fatalf("rotation after logout = %v, %v; want false, nil", rotated, err)
	}
}

package auth

import (
	"context"
	"sync"
	"time"

	"github.com/tiredbooy/pkg/cache"
)

// fakeCache is a minimal in-memory cache.Store for handler tests.
type fakeCache struct {
	mu                     sync.Mutex
	data                   map[string]string
	setErr                 error
	deleteErr              error
	revokeAfterMutationErr error
}

func newFakeCache() *fakeCache { return &fakeCache{data: map[string]string{}} }

func (f *fakeCache) Get(ctx context.Context, key string) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	v, ok := f.data[key]
	if !ok {
		return "", cache.ErrNotFound
	}
	return v, nil
}

func (f *fakeCache) Rotate(_ context.Context, rotation cache.Rotation) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	current, ok := f.data[rotation.CurrentKey]
	if !ok || current != rotation.ExpectedValue {
		return false, nil
	}
	delete(f.data, rotation.CurrentKey)
	f.data[rotation.ReplacementKey] = rotation.ReplacementValue
	f.data[rotation.ReplayKey] = rotation.ReplayValue
	return true, nil
}

func (f *fakeCache) RevokeRotation(_ context.Context, currentKey, replayKey string) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.deleteErr != nil {
		return "", f.deleteErr
	}
	replay, ok := f.data[replayKey]
	delete(f.data, currentKey)
	if f.revokeAfterMutationErr != nil {
		err := f.revokeAfterMutationErr
		f.revokeAfterMutationErr = nil
		return "", err
	}
	if !ok {
		return "", cache.ErrNotFound
	}
	return replay, nil
}

func (f *fakeCache) Set(ctx context.Context, key, value string, ttl time.Duration) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.setErr != nil {
		return f.setErr
	}
	f.data[key] = value
	return nil
}

func (f *fakeCache) Incr(ctx context.Context, key string, ttl time.Duration) (int64, error) {
	return 0, nil
}
func (f *fakeCache) KeysByPrefix(_ context.Context, prefix string) ([]string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var out []string
	for k := range f.data {
		if len(k) >= len(prefix) && k[:len(prefix)] == prefix {
			out = append(out, k)
		}
	}
	return out, nil
}

func (f *fakeCache) Delete(ctx context.Context, keys ...string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.deleteErr != nil {
		return f.deleteErr
	}
	for _, key := range keys {
		delete(f.data, key)
	}
	return nil
}
func (f *fakeCache) Exists(ctx context.Context, key string) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	_, ok := f.data[key]
	return ok, nil
}
func (f *fakeCache) TTL(ctx context.Context, key string) (time.Duration, error) {
	return 0, nil
}
func (f *fakeCache) Ping(ctx context.Context) error { return nil }
func (f *fakeCache) Close() error                   { return nil }

// TestCachedJSONStampede verifies that concurrent cache misses for the same key
// collapse into a single build() — the cache-stampede protection.

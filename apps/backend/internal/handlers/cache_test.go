package handlers

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/tiredbooy/pkg/cache"
)

// fakeCache is a minimal in-memory cache.Store for tests. Only Get/Set carry
// behaviour; the rest satisfy the interface.
type fakeCache struct {
	mu   sync.Mutex
	data map[string]string
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

func (f *fakeCache) Set(ctx context.Context, key, value string, ttl time.Duration) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.data[key] = value
	return nil
}

func (f *fakeCache) Incr(ctx context.Context, key string, ttl time.Duration) (int64, error) {
	return 0, nil
}
func (f *fakeCache) Delete(ctx context.Context, keys ...string) error { return nil }
func (f *fakeCache) Exists(ctx context.Context, key string) (bool, error) {
	return false, nil
}
func (f *fakeCache) TTL(ctx context.Context, key string) (time.Duration, error) {
	return 0, nil
}
func (f *fakeCache) Ping(ctx context.Context) error { return nil }
func (f *fakeCache) Close() error                   { return nil }

// TestCachedJSONStampede verifies that concurrent cache misses for the same key
// collapse into a single build() — the cache-stampede protection.
func TestCachedJSONStampede(t *testing.T) {
	h := New(Deps{Cache: newFakeCache()})

	var builds int32
	build := func() (any, error) {
		atomic.AddInt32(&builds, 1)
		// Hold the in-flight window open so every goroutine piles onto the same
		// singleflight call rather than each racing to its own miss.
		time.Sleep(50 * time.Millisecond)
		return map[string]string{"hello": "world"}, nil
	}

	const goroutines = 50
	var wg sync.WaitGroup
	wg.Add(goroutines)
	for range goroutines {
		go func() {
			defer wg.Done()
			raw, err := h.cachedJSON(context.Background(), "hot-key", time.Minute, build)
			if err != nil {
				t.Errorf("cachedJSON: %v", err)
				return
			}
			if string(raw) != `{"hello":"world"}` {
				t.Errorf("unexpected payload: %s", raw)
			}
		}()
	}
	wg.Wait()

	if got := atomic.LoadInt32(&builds); got != 1 {
		t.Fatalf("build() ran %d times, want exactly 1 (stampede not collapsed)", got)
	}
}

// TestCachedJSONServesFromCache verifies a warm key skips build() entirely.
func TestCachedJSONServesFromCache(t *testing.T) {
	fc := newFakeCache()
	_ = fc.Set(context.Background(), "warm", `{"cached":true}`, time.Minute)
	h := New(Deps{Cache: fc})

	called := false
	raw, err := h.cachedJSON(context.Background(), "warm", time.Minute, func() (any, error) {
		called = true
		return nil, nil
	})
	if err != nil {
		t.Fatalf("cachedJSON: %v", err)
	}
	if called {
		t.Fatal("build() ran on a cache hit")
	}
	if string(raw) != `{"cached":true}` {
		t.Fatalf("unexpected payload: %s", raw)
	}
}

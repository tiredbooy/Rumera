package cache

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"go.uber.org/zap"
)

// fakeStore is a controllable Store: flip failing to make every op error, and
// count how many calls actually reached it (to prove short-circuiting).
type fakeStore struct {
	mu      sync.Mutex
	failing bool
	calls   int
	missGet bool // when true, Get returns ErrNotFound instead of a value
}

func (f *fakeStore) hit() error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls++
	if f.failing {
		return errors.New("redis down")
	}
	return nil
}

func (f *fakeStore) callCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.calls
}

func (f *fakeStore) Get(_ context.Context, _ string) (string, error) {
	if err := f.hit(); err != nil {
		return "", err
	}
	if f.missGet {
		return "", ErrNotFound
	}
	return "v", nil
}
func (f *fakeStore) Rotate(_ context.Context, _ Rotation) (bool, error) {
	return true, f.hit()
}
func (f *fakeStore) RevokeRotation(_ context.Context, _, _ string) (string, error) {
	return "replay", f.hit()
}
func (f *fakeStore) Set(_ context.Context, _, _ string, _ time.Duration) error { return f.hit() }
func (f *fakeStore) Incr(_ context.Context, _ string, _ time.Duration) (int64, error) {
	return 1, f.hit()
}
func (f *fakeStore) Delete(_ context.Context, _ ...string) error      { return f.hit() }
func (f *fakeStore) Exists(_ context.Context, _ string) (bool, error) { return true, f.hit() }
func (f *fakeStore) TTL(_ context.Context, _ string) (time.Duration, error) {
	return time.Second, f.hit()
}
func (f *fakeStore) Ping(_ context.Context) error { return f.hit() }
func (f *fakeStore) Close() error                 { return nil }

// clock is a manually-advanced time source for deterministic cooldown tests.
type clock struct{ t time.Time }

func (c *clock) now() time.Time          { return c.t }
func (c *clock) advance(d time.Duration) { c.t = c.t.Add(d) }

func newTestBreaker(store Store, threshold int, cooldown time.Duration, clk *clock) *breaker {
	b := NewBreaker(store, threshold, cooldown, zap.NewNop()).(*breaker)
	b.now = clk.now
	return b
}

func TestBreaker_OpensAfterThreshold(t *testing.T) {
	fs := &fakeStore{failing: true}
	clk := &clock{t: time.Unix(0, 0)}
	b := newTestBreaker(fs, 3, 10*time.Second, clk)

	// Three failing Sets should reach the store and trip the breaker on the 3rd.
	for i := 0; i < 3; i++ {
		if err := b.Set(context.Background(), "k", "v", 0); err == nil {
			t.Fatalf("call %d: expected error from failing store", i)
		}
	}
	if got := fs.callCount(); got != 3 {
		t.Fatalf("store calls before open = %d; want 3", got)
	}
	if b.state != stateOpen {
		t.Fatalf("state = %s; want open", b.state)
	}

	// While open, a Get short-circuits to a miss WITHOUT touching the store.
	if _, err := b.Get(context.Background(), "k"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("open Get err = %v; want ErrNotFound", err)
	}
	// Mutations and security-sensitive reads report unavailable while open, also
	// without a store call.
	if err := b.Set(context.Background(), "k", "v", 0); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("open Set err = %v; want ErrUnavailable", err)
	}
	if _, err := b.Rotate(context.Background(), Rotation{}); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("open Rotate err = %v; want ErrUnavailable", err)
	}
	if _, err := b.RevokeRotation(context.Background(), "current", "replay"); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("open RevokeRotation err = %v; want ErrUnavailable", err)
	}
	if err := b.Delete(context.Background(), "k"); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("open Delete err = %v; want ErrUnavailable", err)
	}
	if _, err := b.Incr(context.Background(), "k", 0); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("open Incr err = %v; want ErrUnavailable", err)
	}
	if got := fs.callCount(); got != 3 {
		t.Fatalf("store calls during open = %d; want 3 (short-circuited)", got)
	}
}

func TestBreaker_HalfOpenProbeRecovers(t *testing.T) {
	fs := &fakeStore{failing: true}
	clk := &clock{t: time.Unix(0, 0)}
	b := newTestBreaker(fs, 2, 10*time.Second, clk)

	// Trip it.
	_ = b.Set(context.Background(), "k", "v", 0)
	_ = b.Set(context.Background(), "k", "v", 0)
	if b.state != stateOpen {
		t.Fatalf("state = %s; want open", b.state)
	}

	// Before cooldown: still short-circuited.
	clk.advance(5 * time.Second)
	if err := b.Ping(context.Background()); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("pre-cooldown Ping err = %v; want ErrUnavailable", err)
	}

	// Redis recovers; after cooldown a single probe is let through and succeeds,
	// closing the breaker.
	fs.failing = false
	clk.advance(6 * time.Second) // total 11s > 10s cooldown
	callsBefore := fs.callCount()
	if err := b.Ping(context.Background()); err != nil {
		t.Fatalf("probe Ping err = %v; want nil", err)
	}
	if fs.callCount() != callsBefore+1 {
		t.Fatal("probe did not reach the store")
	}
	if b.state != stateClosed {
		t.Fatalf("state after successful probe = %s; want closed", b.state)
	}
}

func TestBreaker_HalfOpenProbeFailsReopens(t *testing.T) {
	fs := &fakeStore{failing: true}
	clk := &clock{t: time.Unix(0, 0)}
	b := newTestBreaker(fs, 1, 10*time.Second, clk)

	_ = b.Ping(context.Background()) // 1 failure → open
	if b.state != stateOpen {
		t.Fatalf("state = %s; want open", b.state)
	}

	// Cooldown elapses but Redis is still down: the probe fails and re-opens.
	clk.advance(11 * time.Second)
	if err := b.Ping(context.Background()); err == nil {
		t.Fatal("probe should have failed")
	}
	if b.state != stateOpen {
		t.Fatalf("state after failed probe = %s; want open", b.state)
	}
}

func TestBreaker_MissDoesNotTrip(t *testing.T) {
	fs := &fakeStore{failing: false, missGet: true}
	clk := &clock{t: time.Unix(0, 0)}
	b := newTestBreaker(fs, 2, 10*time.Second, clk)

	// Many misses must never trip the breaker — a miss is normal, not a failure.
	for i := 0; i < 10; i++ {
		if _, err := b.Get(context.Background(), "k"); !errors.Is(err, ErrNotFound) {
			t.Fatalf("call %d: err = %v; want ErrNotFound", i, err)
		}
	}
	if b.state != stateClosed {
		t.Fatalf("state = %s; want closed (misses must not trip)", b.state)
	}
}

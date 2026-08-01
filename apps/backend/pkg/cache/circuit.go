package cache

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/tiredbooy/pkg/metrics"
	"go.uber.org/zap"
)

// ErrUnavailable is returned by a tripped breaker for operations that cannot
// degrade to a sensible zero value (Incr, Exists, TTL, Ping). Reads (Get) instead
// short-circuit to ErrNotFound so the read-through cache simply rebuilds, and
// writes (Set, Delete) become silent no-ops — matching how callers already treat
// a best-effort cache.
var ErrUnavailable = errors.New("cache: circuit open")

type breakerState int

const (
	stateClosed breakerState = iota
	stateOpen
	stateHalfOpen
)

func (s breakerState) String() string {
	switch s {
	case stateOpen:
		return "open"
	case stateHalfOpen:
		return "half-open"
	default:
		return "closed"
	}
}

// breaker wraps a Store with a circuit breaker. After `threshold` consecutive
// failures it opens and short-circuits every call for `cooldown`, sparing both
// the caller (no per-call timeout waits on a dead Redis) and the backend (no
// connection storms). After the cooldown a single probe is allowed through:
// success closes the breaker, failure re-opens it.
//
// A failure is any non-nil error from the underlying store EXCEPT ErrNotFound,
// which is a normal cache miss and must not trip the breaker.
type breaker struct {
	store     Store
	threshold int
	cooldown  time.Duration
	log       *zap.Logger
	now       func() time.Time // injectable clock for tests

	mu            sync.Mutex
	state         breakerState
	failures      int
	openedAt      time.Time
	probeInFlight bool
}

// NewBreaker wraps store with a circuit breaker. threshold<=0 disables tripping
// (the wrapper just passes through). The returned value is a Store, so it drops
// in transparently wherever the raw store was used.
func NewBreaker(store Store, threshold int, cooldown time.Duration, log *zap.Logger) Store {
	return &breaker{
		store:     store,
		threshold: threshold,
		cooldown:  cooldown,
		log:       log,
		now:       time.Now,
	}
}

// allow reports whether a call may reach the underlying store, advancing the
// state machine (open→half-open after cooldown, reserving the single probe).
func (b *breaker) allow() bool {
	b.mu.Lock()
	defer b.mu.Unlock()

	switch b.state {
	case stateOpen:
		if b.now().Sub(b.openedAt) < b.cooldown {
			return false
		}
		// Cooldown elapsed: move to half-open and let exactly one probe through.
		b.state = stateHalfOpen
		b.probeInFlight = true
		metrics.SetCacheCircuitState(metrics.CircuitHalfOpen)
		return true
	case stateHalfOpen:
		// A probe is already in flight; keep short-circuiting until it resolves.
		if b.probeInFlight {
			return false
		}
		b.probeInFlight = true
		return true
	default: // stateClosed
		return true
	}
}

// record folds a call's outcome back into the state machine.
func (b *breaker) record(failed bool) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if b.state == stateHalfOpen {
		b.probeInFlight = false
		if failed {
			b.trip()
		} else {
			b.reset()
		}
		return
	}

	if !failed {
		b.failures = 0
		return
	}
	b.failures++
	if b.threshold > 0 && b.failures >= b.threshold && b.state == stateClosed {
		b.trip()
	}
}

// trip opens the breaker. Caller must hold the mutex.
func (b *breaker) trip() {
	was := b.state
	b.state = stateOpen
	b.openedAt = b.now()
	metrics.SetCacheCircuitState(metrics.CircuitOpen)
	if was != stateOpen && b.log != nil {
		b.log.Warn("cache circuit opened", zap.Int("threshold", b.threshold),
			zap.Duration("cooldown", b.cooldown))
	}
}

// reset closes the breaker. Caller must hold the mutex.
func (b *breaker) reset() {
	was := b.state
	b.state = stateClosed
	b.failures = 0
	metrics.SetCacheCircuitState(metrics.CircuitClosed)
	if was != stateClosed && b.log != nil {
		b.log.Info("cache circuit closed")
	}
}

// isFailure reports whether err should count against the breaker. A miss is not
// a failure.
func isFailure(err error) bool {
	return err != nil && !errors.Is(err, ErrNotFound)
}

// ── Store implementation ────────────────────────────────────────────────────

func (b *breaker) Get(ctx context.Context, key string) (string, error) {
	if !b.allow() {
		return "", ErrNotFound // degrade to a miss → caller rebuilds from source
	}
	v, err := b.store.Get(ctx, key)
	b.record(isFailure(err))
	return v, err
}

func (b *breaker) Rotate(ctx context.Context, rotation Rotation) (bool, error) {
	if !b.allow() {
		return false, ErrUnavailable
	}
	rotated, err := b.store.Rotate(ctx, rotation)
	b.record(err != nil)
	return rotated, err
}

func (b *breaker) RevokeRotation(ctx context.Context, currentKey, replayKey string) (string, error) {
	if !b.allow() {
		return "", ErrUnavailable
	}
	replay, err := b.store.RevokeRotation(ctx, currentKey, replayKey)
	b.record(isFailure(err))
	return replay, err
}

func (b *breaker) Set(ctx context.Context, key, value string, ttl time.Duration) error {
	if !b.allow() {
		return ErrUnavailable
	}
	err := b.store.Set(ctx, key, value, ttl)
	b.record(err != nil)
	return err
}

func (b *breaker) Incr(ctx context.Context, key string, ttl time.Duration) (int64, error) {
	if !b.allow() {
		return 0, ErrUnavailable
	}
	n, err := b.store.Incr(ctx, key, ttl)
	b.record(err != nil)
	return n, err
}

func (b *breaker) Delete(ctx context.Context, keys ...string) error {
	if !b.allow() {
		return ErrUnavailable
	}
	err := b.store.Delete(ctx, keys...)
	b.record(err != nil)
	return err
}

func (b *breaker) Exists(ctx context.Context, key string) (bool, error) {
	if !b.allow() {
		return false, ErrUnavailable
	}
	ok, err := b.store.Exists(ctx, key)
	b.record(err != nil)
	return ok, err
}

func (b *breaker) TTL(ctx context.Context, key string) (time.Duration, error) {
	if !b.allow() {
		return 0, ErrUnavailable
	}
	ttl, err := b.store.TTL(ctx, key)
	b.record(err != nil)
	return ttl, err
}

func (b *breaker) Ping(ctx context.Context) error {
	if !b.allow() {
		return ErrUnavailable
	}
	err := b.store.Ping(ctx)
	b.record(err != nil)
	return err
}

// Close tears down the underlying store; it is not gated by the breaker.
func (b *breaker) Close() error {
	return b.store.Close()
}

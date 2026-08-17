package events

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"sync"
)

// Handler reacts to a committed fact.
//
// Handlers must be idempotent: delivery is at-least-once, so the same envelope
// can arrive twice (a relay retry, a Kafka rebalance, an operator replay). The
// ledger makes the common case exactly-once, but a crash between "side effect
// done" and "row marked done" will re-run the handler. Lean on a domain unique
// constraint rather than on the ledger for anything that spends money.
type Handler interface {
	// Name identifies the consumer in the ledger, metrics and logs. Stable —
	// renaming one re-delivers every retained fact to the new name.
	Name() string
	// Types lists the fact types this consumer wants.
	Types() []string
	// Handle performs the side effect. Returning nil settles the row.
	Handle(ctx context.Context, env *Envelope) error
}

// ErrPermanent marks a failure that will never succeed on retry — a malformed
// payload, an unsupported type, a missing provider. Wrapping with it sends the
// row straight to the dead-letter state instead of burning the whole retry
// budget on something that cannot work.
var ErrPermanent = errors.New("events: permanent failure")

// Permanent wraps err as non-retryable.
func Permanent(err error) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("%w: %w", ErrPermanent, err)
}

// IsPermanent reports whether err should skip the retry budget.
func IsPermanent(err error) bool { return errors.Is(err, ErrPermanent) }

// HandlerFunc adapts a function to Handler.
type HandlerFunc struct {
	ConsumerName string
	EventTypes   []string
	Fn           func(ctx context.Context, env *Envelope) error
}

func (h HandlerFunc) Name() string                                  { return h.ConsumerName }
func (h HandlerFunc) Types() []string                               { return h.EventTypes }
func (h HandlerFunc) Handle(ctx context.Context, e *Envelope) error { return h.Fn(ctx, e) }

// Registry holds the consumers a worker will run. Safe for concurrent reads
// after wiring; Register is expected at construction time only.
type Registry struct {
	mu       sync.RWMutex
	handlers map[string]Handler
}

// NewRegistry returns an empty registry.
func NewRegistry() *Registry {
	return &Registry{handlers: map[string]Handler{}}
}

// Register adds a consumer. A duplicate name is a programming error and panics
// at wiring time rather than silently shadowing a consumer at 3am.
func (r *Registry) Register(h Handler) {
	if h == nil {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	name := h.Name()
	if name == "" {
		panic("events: consumer registered with an empty name")
	}
	if len(h.Types()) == 0 {
		panic(fmt.Sprintf("events: consumer %q registered with no types", name))
	}
	if _, dup := r.handlers[name]; dup {
		panic(fmt.Sprintf("events: duplicate consumer name %q", name))
	}
	r.handlers[name] = h
}

// Get returns the handler registered under name.
func (r *Registry) Get(name string) (Handler, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	h, ok := r.handlers[name]
	return h, ok
}

// Bindings lists every registered consumer and the types it wants, sorted by
// name so fan-out and tests are deterministic.
func (r *Registry) Bindings() []ConsumerBinding {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]ConsumerBinding, 0, len(r.handlers))
	for name, h := range r.handlers {
		out = append(out, ConsumerBinding{Name: name, Types: h.Types()})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

// Len reports how many consumers are registered.
func (r *Registry) Len() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.handlers)
}

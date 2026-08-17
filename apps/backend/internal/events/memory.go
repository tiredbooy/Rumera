package events

import (
	"context"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
)

// MemoryStore is an in-process Store for unit tests and local dry-runs.
//
// It mirrors the Postgres semantics that matter: unique idempotency key, claim
// increments attempts, only settled facts prune. It does NOT model transactions
// — EnqueueTx ignores the tx and writes immediately, so it cannot be used to
// test rollback behaviour. That needs the integration harness.
type MemoryStore struct {
	mu sync.Mutex

	seq      int64
	events   []*memEvent
	byKey    map[string]*memEvent
	consumed map[string]*memConsumption

	// FailEnqueue, when set, makes every enqueue return it.
	FailEnqueue error
}

type memEvent struct {
	pk              int64
	env             *Envelope
	publishedAt     *time.Time
	publishAttempts int
	publishAfter    time.Time
	dispatched      bool
	createdAt       time.Time
}

type memConsumption struct {
	eventID     string
	consumer    string
	eventPK     int64
	eventType   string
	status      string
	attempts    int
	availableAt time.Time
	lastError   string
	createdAt   time.Time
	processedAt *time.Time
}

// NewMemoryStore returns an empty store.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		byKey:    map[string]*memEvent{},
		consumed: map[string]*memConsumption{},
	}
}

var _ Store = (*MemoryStore)(nil)

func consumptionKey(eventID, consumer string) string { return eventID + "\x00" + consumer }

func (m *MemoryStore) EnqueueTx(ctx context.Context, _ pgx.Tx, env *Envelope) error {
	return m.Enqueue(ctx, env)
}

func (m *MemoryStore) Enqueue(_ context.Context, env *Envelope) error {
	if m.FailEnqueue != nil {
		return m.FailEnqueue
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, dup := m.byKey[env.Rumera.IdempotencyKey]; dup {
		return nil // ON CONFLICT DO NOTHING
	}
	m.seq++
	e := &memEvent{pk: m.seq, env: env, publishAfter: time.Now(), createdAt: time.Now()}
	m.events = append(m.events, e)
	m.byKey[env.Rumera.IdempotencyKey] = e
	return nil
}

func (m *MemoryStore) ClaimUnpublished(_ context.Context, limit int) ([]Row, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var out []Row
	now := time.Now()
	for _, e := range m.events {
		if e.publishedAt != nil || e.publishAfter.After(now) {
			continue
		}
		e.publishAttempts++
		out = append(out, Row{PK: e.pk, Envelope: e.env, PublishAttempts: e.publishAttempts})
		if len(out) >= limit {
			break
		}
	}
	return out, nil
}

func (m *MemoryStore) MarkPublished(_ context.Context, pk int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, e := range m.events {
		if e.pk == pk && e.publishedAt == nil {
			now := time.Now()
			e.publishedAt = &now
		}
	}
	return nil
}

func (m *MemoryStore) MarkPublishError(_ context.Context, pk int64, _ string, retryAfter time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, e := range m.events {
		if e.pk == pk {
			e.publishAfter = retryAfter
		}
	}
	return nil
}

func (m *MemoryStore) FanOut(_ context.Context, consumers []ConsumerBinding, limit int, minAge time.Duration) (int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	n := 0
	cutoff := time.Now().Add(-minAge)
	for _, e := range m.events {
		if e.dispatched {
			continue
		}
		if minAge > 0 && e.createdAt.After(cutoff) {
			continue
		}
		for _, c := range consumers {
			if !c.Wants(e.env.Type) {
				continue
			}
			k := consumptionKey(e.env.ID, c.Name)
			if _, exists := m.consumed[k]; exists {
				continue
			}
			m.consumed[k] = &memConsumption{
				eventID: e.env.ID, consumer: c.Name, eventPK: e.pk,
				eventType: e.env.Type, status: StatusPending,
				availableAt: time.Now(), createdAt: time.Now(),
			}
		}
		e.dispatched = true
		n++
		if n >= limit {
			break
		}
	}
	return n, nil
}

func (m *MemoryStore) FanOutEnvelope(_ context.Context, env *Envelope, consumers []ConsumerBinding) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	var pk int64
	if e, ok := m.byKey[env.Rumera.IdempotencyKey]; ok {
		pk = e.pk
		// Mirror the Postgres path, which sets dispatched_at on ingest (K-2). This
		// is what keeps the staleness-gated fallback from re-claiming a fact the
		// broker already delivered.
		e.dispatched = true
	}
	for _, c := range consumers {
		if !c.Wants(env.Type) {
			continue
		}
		k := consumptionKey(env.ID, c.Name)
		if _, exists := m.consumed[k]; exists {
			continue
		}
		m.consumed[k] = &memConsumption{
			eventID: env.ID, consumer: c.Name, eventPK: pk,
			eventType: env.Type, status: StatusPending,
			availableAt: time.Now(), createdAt: time.Now(),
		}
	}
	return nil
}

func (m *MemoryStore) ClaimDue(_ context.Context, limit int, lease time.Duration) ([]Due, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := time.Now()
	var out []Due
	for _, c := range m.consumed {
		if c.status != StatusPending && c.status != StatusRetry {
			continue
		}
		if c.availableAt.After(now) {
			continue
		}
		var env *Envelope
		for _, e := range m.events {
			if e.env.ID == c.eventID {
				env = e.env
				break
			}
		}
		if env == nil {
			continue
		}
		c.attempts++
		// Mirror the Postgres lease: a claimed row is invisible until it expires.
		if lease > 0 {
			c.availableAt = now.Add(lease)
		}
		out = append(out, Due{EventPK: c.eventPK, Consumer: c.consumer, Attempts: c.attempts, Envelope: env})
		if len(out) >= limit {
			break
		}
	}
	return out, nil
}

func (m *MemoryStore) MarkDone(_ context.Context, eventID, consumer string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if c, ok := m.consumed[consumptionKey(eventID, consumer)]; ok && settleable(c.status) {
		now := time.Now()
		c.status = StatusDone
		c.processedAt = &now
		c.lastError = ""
	}
	return nil
}

func (m *MemoryStore) MarkRetry(_ context.Context, eventID, consumer, errMsg string, availableAt time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if c, ok := m.consumed[consumptionKey(eventID, consumer)]; ok && settleable(c.status) {
		c.status = StatusRetry
		c.availableAt = availableAt
		c.lastError = errMsg
	}
	return nil
}

func (m *MemoryStore) MarkDLQ(_ context.Context, eventID, consumer, errMsg string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if c, ok := m.consumed[consumptionKey(eventID, consumer)]; ok && settleable(c.status) {
		now := time.Now()
		c.status = StatusDLQ
		c.processedAt = &now
		c.lastError = errMsg
	}
	return nil
}

func (m *MemoryStore) OldestUnpublishedAge(_ context.Context) (time.Duration, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var oldest time.Time
	for _, e := range m.events {
		if e.publishedAt != nil {
			continue
		}
		if oldest.IsZero() || e.createdAt.Before(oldest) {
			oldest = e.createdAt
		}
	}
	if oldest.IsZero() {
		return 0, nil
	}
	return time.Since(oldest), nil
}

func (m *MemoryStore) OldestPendingAge(_ context.Context) (time.Duration, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := time.Now()
	var oldest time.Time
	for _, c := range m.consumed {
		if c.status != StatusPending && c.status != StatusRetry {
			continue
		}
		if c.availableAt.After(now) {
			continue
		}
		if oldest.IsZero() || c.availableAt.Before(oldest) {
			oldest = c.availableAt
		}
	}
	if oldest.IsZero() {
		return 0, nil
	}
	return now.Sub(oldest), nil
}

func (m *MemoryStore) CountByStatus(_ context.Context) (map[string]int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := map[string]int64{}
	for _, c := range m.consumed {
		out[c.status]++
	}
	return out, nil
}

func (m *MemoryStore) Prune(_ context.Context, olderThan time.Time, limit int) (int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var kept []*memEvent
	var removed int64
	for _, e := range m.events {
		settled, seen := true, false
		for _, c := range m.consumed {
			if c.eventID != e.env.ID {
				continue
			}
			seen = true
			if c.status != StatusDone {
				settled = false
				break
			}
		}
		// `seen` is the guard against deleting a fact that was never fanned out:
		// zero consumption rows would otherwise pass the settled test vacuously.
		if seen && settled && e.env.Time.Before(olderThan) && removed < int64(limit) {
			for k, c := range m.consumed {
				if c.eventID == e.env.ID {
					delete(m.consumed, k)
				}
			}
			delete(m.byKey, e.env.Rumera.IdempotencyKey)
			removed++
			continue
		}
		kept = append(kept, e)
	}
	m.events = kept
	return removed, nil
}

func (m *MemoryStore) Replay(_ context.Context, consumer string, limit int) (int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var n int64
	for _, c := range m.consumed {
		if c.status != StatusDLQ {
			continue
		}
		if consumer != "" && c.consumer != consumer {
			continue
		}
		c.status = StatusPending
		c.attempts = 0
		c.availableAt = time.Now()
		c.processedAt = nil
		n++
		if n >= int64(limit) {
			break
		}
	}
	return n, nil
}

// ── test inspection helpers ──────────────────────────────────────────────────

// Status reports the consumption status for a consumer, or "" if absent.
func (m *MemoryStore) Status(eventID, consumer string) string {
	m.mu.Lock()
	defer m.mu.Unlock()
	if c, ok := m.consumed[consumptionKey(eventID, consumer)]; ok {
		return c.status
	}
	return ""
}

// Attempts reports how many times a consumption was claimed.
func (m *MemoryStore) Attempts(eventID, consumer string) int {
	m.mu.Lock()
	defer m.mu.Unlock()
	if c, ok := m.consumed[consumptionKey(eventID, consumer)]; ok {
		return c.attempts
	}
	return 0
}

// LastError reports the recorded failure for a consumption.
func (m *MemoryStore) LastError(eventID, consumer string) string {
	m.mu.Lock()
	defer m.mu.Unlock()
	if c, ok := m.consumed[consumptionKey(eventID, consumer)]; ok {
		return c.lastError
	}
	return ""
}

// EventCount reports how many facts are stored.
func (m *MemoryStore) EventCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.events)
}

// MakeDue clears the backoff on a consumption so a test can retry immediately.
func (m *MemoryStore) MakeDue(eventID, consumer string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if c, ok := m.consumed[consumptionKey(eventID, consumer)]; ok {
		c.availableAt = time.Now().Add(-time.Second)
	}
}

// settleable reports whether a consumption may still change state. done and dlq
// are terminal, so a straggler cannot move a settled row backwards.
func settleable(status string) bool {
	return status == StatusPending || status == StatusRetry
}

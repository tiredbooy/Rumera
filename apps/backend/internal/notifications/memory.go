package notifications

import (
	"context"
	"sync"
	"time"
)

// MemoryOutbox is an in-process outbox for unit tests and local dry-runs.
type MemoryOutbox struct {
	mu   sync.Mutex
	seq  int64
	rows []OutboxRow
	// byKey prevents duplicate idempotency keys.
	byKey map[string]struct{}
}

func NewMemoryOutbox() *MemoryOutbox {
	return &MemoryOutbox{byKey: map[string]struct{}{}}
}

func (m *MemoryOutbox) Enqueue(_ context.Context, topic, partitionKey, idempotencyKey string, payload []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.byKey[idempotencyKey]; ok {
		return nil
	}
	m.seq++
	m.byKey[idempotencyKey] = struct{}{}
	m.rows = append(m.rows, OutboxRow{
		ID:             m.seq,
		Topic:          topic,
		PartitionKey:   partitionKey,
		Payload:        append([]byte(nil), payload...),
		IdempotencyKey: idempotencyKey,
		CreatedAt:      time.Now().UTC(),
	})
	return nil
}

func (m *MemoryOutbox) ClaimUnpublished(_ context.Context, limit int) ([]OutboxRow, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var out []OutboxRow
	for i := range m.rows {
		if m.rows[i].PublishedAt != nil {
			continue
		}
		out = append(out, m.rows[i])
		if len(out) >= limit {
			break
		}
	}
	return out, nil
}

func (m *MemoryOutbox) MarkPublished(_ context.Context, id int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := time.Now().UTC()
	for i := range m.rows {
		if m.rows[i].ID == id {
			m.rows[i].PublishedAt = &now
			return nil
		}
	}
	return nil
}

func (m *MemoryOutbox) MarkPublishError(_ context.Context, id int64, errMsg string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.rows {
		if m.rows[i].ID == id {
			m.rows[i].PublishError = &errMsg
			return nil
		}
	}
	return nil
}

// MemoryDeliveries is a process-local idempotency ledger.
type MemoryDeliveries struct {
	mu   sync.Mutex
	seen map[string]struct{}
}

func NewMemoryDeliveries() *MemoryDeliveries {
	return &MemoryDeliveries{seen: map[string]struct{}{}}
}

func (m *MemoryDeliveries) TryBegin(_ context.Context, idempotencyKey, _, _, _ string) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.seen[idempotencyKey]; ok {
		return false, nil
	}
	m.seen[idempotencyKey] = struct{}{}
	return true, nil
}

// MemoryPublisher records published messages for tests.
type MemoryPublisher struct {
	mu       sync.Mutex
	Messages []PublishedMessage
	Fail     error
}

type PublishedMessage struct {
	Topic string
	Key   string
	Value []byte
}

func (m *MemoryPublisher) Publish(_ context.Context, topic, key string, value []byte) error {
	if m.Fail != nil {
		return m.Fail
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.Messages = append(m.Messages, PublishedMessage{
		Topic: topic,
		Key:   key,
		Value: append([]byte(nil), value...),
	})
	return nil
}

// Package postgres implements OutboxStore and DeliveryStore against the main
// application database (see migration notification_outbox).
package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/notifications"
)

// Store implements notifications.OutboxStore and notifications.DeliveryStore.
type Store struct {
	db *pgxpool.Pool
}

func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

func (s *Store) Enqueue(ctx context.Context, topic, partitionKey, idempotencyKey string, payload []byte) error {
	const q = `
		INSERT INTO notification_outbox (topic, partition_key, payload, idempotency_key)
		VALUES ($1, $2, $3::jsonb, $4)
		ON CONFLICT (idempotency_key) DO NOTHING`
	_, err := s.db.Exec(ctx, q, topic, partitionKey, payload, idempotencyKey)
	if err != nil {
		return fmt.Errorf("notification outbox enqueue: %w", err)
	}
	return nil
}

func (s *Store) ClaimUnpublished(ctx context.Context, limit int) ([]notifications.OutboxRow, error) {
	if limit <= 0 {
		limit = 50
	}
	// Peek unpublished rows. Publish is at-least-once; delivery ledger dedupes.
	const q = `
		SELECT id, topic, partition_key, payload, idempotency_key, created_at,
		       published_at, publish_error
		FROM notification_outbox
		WHERE published_at IS NULL
		ORDER BY created_at ASC
		LIMIT $1`
	rows, err := s.db.Query(ctx, q, limit)
	if err != nil {
		return nil, fmt.Errorf("notification outbox claim: %w", err)
	}
	defer rows.Close()

	var out []notifications.OutboxRow
	for rows.Next() {
		var row notifications.OutboxRow
		if err := rows.Scan(
			&row.ID, &row.Topic, &row.PartitionKey, &row.Payload, &row.IdempotencyKey,
			&row.CreatedAt, &row.PublishedAt, &row.PublishError,
		); err != nil {
			return nil, fmt.Errorf("notification outbox scan: %w", err)
		}
		out = append(out, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Store) MarkPublished(ctx context.Context, id int64) error {
	const q = `
		UPDATE notification_outbox
		SET published_at = NOW(), publish_error = NULL
		WHERE id = $1`
	_, err := s.db.Exec(ctx, q, id)
	if err != nil {
		return fmt.Errorf("notification outbox mark published: %w", err)
	}
	return nil
}

func (s *Store) MarkPublishError(ctx context.Context, id int64, errMsg string) error {
	const q = `
		UPDATE notification_outbox
		SET publish_error = $2
		WHERE id = $1`
	_, err := s.db.Exec(ctx, q, id, errMsg)
	if err != nil {
		return fmt.Errorf("notification outbox mark error: %w", err)
	}
	return nil
}

// TryBegin records a delivery attempt key. Returns true if this worker should
// perform the side effect (first insert won).
func (s *Store) TryBegin(ctx context.Context, idempotencyKey, topic, eventID, channel string) (bool, error) {
	const q = `
		INSERT INTO notification_deliveries (idempotency_key, topic, event_id, channel)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (idempotency_key) DO NOTHING
		RETURNING idempotency_key`
	var key string
	err := s.db.QueryRow(ctx, q, idempotencyKey, topic, eventID, channel).Scan(&key)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("notification delivery begin: %w", err)
	}
	return true, nil
}

// Ensure compile-time interface satisfaction.
var (
	_ notifications.OutboxStore   = (*Store)(nil)
	_ notifications.DeliveryStore = (*Store)(nil)
)

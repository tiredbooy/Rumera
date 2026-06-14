package cron

import (
	"context"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/pkg/database"
)

// IdempotencyCleanupJob prunes idempotency_keys rows past the retention window.
// Stored payment/webhook responses only need to outlive a gateway's retry
// window; without pruning the table grows forever (the created_at index added by
// the B4 migration serves this DELETE).
type IdempotencyCleanupJob struct {
	db        *pgxpool.Pool
	retention time.Duration
}

func NewIdempotencyCleanupJob(db *pgxpool.Pool, retention time.Duration) *IdempotencyCleanupJob {
	return &IdempotencyCleanupJob{db: db, retention: retention}
}

func (j *IdempotencyCleanupJob) Run(ctx context.Context) {
	cutoff := time.Now().Add(-j.retention)

	// Idempotent delete — safe to retry on a transient failure.
	var deleted int64
	err := database.WithRetry(ctx, func(ctx context.Context) error {
		tag, err := j.db.Exec(ctx,
			`DELETE FROM idempotency_keys WHERE created_at < $1`, cutoff)
		if err != nil {
			return err
		}
		deleted = tag.RowsAffected()
		return nil
	})
	if err != nil {
		slog.Error("idempotency cleanup job: deleting expired keys", "err", err)
		return
	}

	slog.Info("idempotency cleanup job: done",
		"deleted", deleted, "cutoff", cutoff.Format(time.RFC3339))
}

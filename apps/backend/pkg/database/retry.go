package database

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/sethvargo/go-retry"
	config "github.com/tiredbooy/configs"
	"github.com/tiredbooy/pkg/metrics"
)

// Postgres SQLSTATE codes that are safe to retry: the transaction was rolled
// back by the engine and re-running it may succeed. Everything else (constraint
// violations, syntax, etc.) is a deterministic business error and must not retry.
const (
	sqlStateSerializationFailure = "40001"
	sqlStateDeadlockDetected     = "40P01"
)

// Policy bounds a retry loop. The zero value (or MaxAttempts < 2) disables
// retrying — fn runs exactly once.
type Policy struct {
	// MaxAttempts is the total number of tries including the first.
	MaxAttempts uint64
	// BaseBackoff is the delay before the first retry; it doubles each retry.
	BaseBackoff time.Duration
}

// defaultPolicy is used by WithRetry. It is set once at startup by ConfigureRetry
// and read-only thereafter, so no synchronisation is needed.
var defaultPolicy = Policy{MaxAttempts: 3, BaseBackoff: 50 * time.Millisecond}

// ConfigureRetry sets the process-wide default retry policy from config. Call it
// once during startup (database.Connect does) before any retried work runs.
func ConfigureRetry(cfg *config.Config) {
	if cfg.DBRetryMaxAttempts >= 1 && cfg.DBRetryBaseBackoff > 0 {
		defaultPolicy = Policy{
			MaxAttempts: uint64(cfg.DBRetryMaxAttempts),
			BaseBackoff: cfg.DBRetryBaseBackoff,
		}
	}
}

// WithRetry runs fn under the process default policy, retrying only transient
// database failures with bounded exponential backoff. Use it for idempotent
// reads and rollups — never for non-idempotent writes.
func WithRetry(ctx context.Context, fn func(context.Context) error) error {
	return WithRetryPolicy(ctx, defaultPolicy, fn)
}

// WithRetryPolicy is WithRetry with an explicit policy (handy for tests). It
// retries fn only when it returns a transient error (see isTransient); business
// errors and context cancellation propagate immediately. Each retry attempt is
// counted on the db_retries_total metric.
func WithRetryPolicy(ctx context.Context, p Policy, fn func(context.Context) error) error {
	if p.MaxAttempts < 2 || p.BaseBackoff <= 0 {
		return fn(ctx) // retrying disabled
	}

	backoff := retry.WithMaxRetries(p.MaxAttempts-1, retry.NewExponential(p.BaseBackoff))

	first := true
	return retry.Do(ctx, backoff, func(ctx context.Context) error {
		if !first {
			metrics.IncDBRetry()
		}
		first = false

		err := fn(ctx)
		if err != nil && isTransient(err) {
			return retry.RetryableError(err)
		}
		return err
	})
}

// isTransient reports whether err is a retryable database failure: a Postgres
// serialization/deadlock rollback, or a connection-level error that occurred
// before the query could have taken effect (pgconn marks those SafeToRetry).
func isTransient(err error) bool {
	if err == nil {
		return false
	}

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case sqlStateSerializationFailure, sqlStateDeadlockDetected:
			return true
		default:
			return false
		}
	}

	// Connection reset/refused/EOF before the request was sent: re-running is safe.
	return pgconn.SafeToRetry(err)
}

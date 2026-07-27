//go:build integration

package integration

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/repositories"
)

func TestMediaKeyLocksReservePoolCapacity(t *testing.T) {
	requireDB(t)
	config, err := pgxpool.ParseConfig(os.Getenv("TEST_DATABASE_URL"))
	if err != nil {
		t.Fatalf("parse test database URL: %v", err)
	}
	config.MaxConns = 2
	config.MinConns = 0
	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		t.Fatalf("create bounded media-lock pool: %v", err)
	}
	defer pool.Close()
	repo := repositories.NewMediaLifecycleRepository(pool)

	first, err := repo.LockMediaKeys(context.Background(), []string{"uploads/first.webp"})
	if err != nil {
		t.Fatalf("acquire first media-key lock: %v", err)
	}
	defer first.Release(context.Background()) //nolint:errcheck

	var one int
	if err := pool.QueryRow(context.Background(), `SELECT 1`).Scan(&one); err != nil || one != 1 {
		t.Fatalf("query with one pinned lock = %d, %v; want free connection", one, err)
	}
	waitCtx, cancel := context.WithTimeout(context.Background(), 25*time.Millisecond)
	defer cancel()
	if _, err := repo.LockMediaKeys(waitCtx, []string{"uploads/second.webp"}); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("second lock error = %v; want bounded wait deadline", err)
	}
	if err := first.Release(context.Background()); err != nil {
		t.Fatalf("release first media-key lock: %v", err)
	}
	second, err := repo.LockMediaKeys(context.Background(), []string{"uploads/second.webp"})
	if err != nil {
		t.Fatalf("acquire second media-key lock after release: %v", err)
	}
	if err := second.Release(context.Background()); err != nil {
		t.Fatalf("release second media-key lock: %v", err)
	}
}

package inventory

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/tiredbooy/internal/models"
)

type stubInventoryExec struct {
	insertAffected int64
	insertErr      error
	exists         bool
	existsErr      error
	execs          int
}

func (s *stubInventoryExec) Exec(context.Context, string, ...any) (pgconn.CommandTag, error) {
	s.execs++
	if s.insertErr != nil {
		return pgconn.CommandTag{}, s.insertErr
	}
	return pgconn.NewCommandTag("INSERT 0 " + strconv.FormatInt(s.insertAffected, 10)), nil
}

func (s *stubInventoryExec) QueryRow(context.Context, string, ...any) pgx.Row {
	return stubExistsRow{exists: s.exists, err: s.existsErr}
}

type stubExistsRow struct {
	exists bool
	err    error
}

func (r stubExistsRow) Scan(dest ...any) error {
	if r.err != nil {
		return r.err
	}
	if len(dest) != 1 {
		return errors.New("expected one dest")
	}
	ptr, ok := dest[0].(*bool)
	if !ok {
		return errors.New("expected *bool dest")
	}
	*ptr = r.exists
	return nil
}

func TestEnsureForVariantInsertsZeroStockRow(t *testing.T) {
	exec := &stubInventoryExec{insertAffected: 1}
	if err := ensureForVariant(context.Background(), exec, 42); err != nil {
		t.Fatalf("ensureForVariant: %v", err)
	}
	if exec.execs != 1 {
		t.Fatalf("exec calls = %d; want 1", exec.execs)
	}
}

func TestEnsureForVariantIdempotentWhenRowExists(t *testing.T) {
	exec := &stubInventoryExec{insertAffected: 0, exists: true}
	if err := ensureForVariant(context.Background(), exec, 42); err != nil {
		t.Fatalf("ensureForVariant existing: %v", err)
	}
}

func TestEnsureForVariantMissingVariant(t *testing.T) {
	exec := &stubInventoryExec{insertAffected: 0, exists: false}
	if err := ensureForVariant(context.Background(), exec, 99); !errors.Is(err, models.ErrNotFound) {
		t.Fatalf("ensureForVariant missing = %v; want ErrNotFound", err)
	}
}

func TestEnsureForVariantPropagatesInsertError(t *testing.T) {
	boom := errors.New("db down")
	exec := &stubInventoryExec{insertErr: boom}
	err := ensureForVariant(context.Background(), exec, 1)
	if err == nil || !strings.Contains(err.Error(), "db down") {
		t.Fatalf("ensureForVariant insert error = %v; want wrap of db down", err)
	}
}

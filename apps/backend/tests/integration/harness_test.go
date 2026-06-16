//go:build integration

// Package integration holds the backend's database-backed integration tests.
//
// They run only under the `integration` build tag (so the default `go test
// ./...` unit run is untouched) and only when TEST_DATABASE_URL points at a
// throwaway Postgres — otherwise the suite skips cleanly. We deliberately avoid
// testcontainers (its docker SDK pulls klauspost/compress, which the build
// sandbox blocks); instead the operator/CI provides a database.
//
//	# one-liner to run locally:
//	docker run -d --name pg -e POSTGRES_PASSWORD=test -e POSTGRES_USER=test \
//	    -e POSTGRES_DB=rumera_test -p 55432:5432 postgres:17-alpine
//	TEST_DATABASE_URL='postgres://test:test@localhost:55432/rumera_test?sslmode=disable' \
//	    make test-integration
package integration

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

// testPool is the shared connection pool to the test database. Nil when
// TEST_DATABASE_URL is unset (every test then skips via requireDB).
var testPool *pgxpool.Pool

func TestMain(m *testing.M) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		fmt.Println("integration: TEST_DATABASE_URL not set — skipping integration suite")
		os.Exit(0)
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		fmt.Println("integration: connect:", err)
		os.Exit(1)
	}
	if err := runMigrations(pool); err != nil {
		fmt.Println("integration: migrate:", err)
		os.Exit(1)
	}
	testPool = pool

	code := m.Run()
	pool.Close()
	os.Exit(code)
}

// runMigrations applies the main schema to the test database via goose, reading
// the SQL straight off disk (no embed) relative to this package.
func runMigrations(pool *pgxpool.Pool) error {
	db := stdlib.OpenDBFromPool(pool)
	defer db.Close()

	goose.SetLogger(goose.NopLogger())
	if err := goose.SetDialect("postgres"); err != nil {
		return fmt.Errorf("set dialect: %w", err)
	}
	if err := goose.Up(db, "../../migrations/main"); err != nil {
		return fmt.Errorf("goose up: %w", err)
	}
	return nil
}

// requireDB skips the test when no database is configured.
func requireDB(t *testing.T) {
	t.Helper()
	if testPool == nil {
		t.Skip("TEST_DATABASE_URL not set")
	}
}

// resetTables truncates the named tables (RESTART IDENTITY CASCADE) so each test
// starts from a clean slate without re-running migrations.
func resetTables(t *testing.T, tables ...string) {
	t.Helper()
	stmt := fmt.Sprintf("TRUNCATE %s RESTART IDENTITY CASCADE", strings.Join(tables, ", "))
	if _, err := testPool.Exec(context.Background(), stmt); err != nil {
		t.Fatalf("reset tables: %v", err)
	}
}

// TestMigrationsApply is a smoke test: the full main schema applies cleanly to an
// empty database and produces the expected tables.
func TestMigrationsApply(t *testing.T) {
	requireDB(t)
	var n int
	err := testPool.QueryRow(context.Background(),
		`SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'`).Scan(&n)
	if err != nil {
		t.Fatalf("count tables: %v", err)
	}
	if n < 15 {
		t.Fatalf("expected the full schema (>=15 tables), got %d", n)
	}
}

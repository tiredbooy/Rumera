package cart

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// TestGetOrCreateRequiresUniqueUserID documents PR-004a: GetOrCreate uses
// ON CONFLICT (user_id), which needs UNIQUE NOT NULL on carts.user_id.
// The live DB check lives in tests/integration (GetOrCreate twice).
func TestGetOrCreateRequiresUniqueUserID(t *testing.T) {
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	repoDir := filepath.Dir(thisFile)
	backendRoot := filepath.Clean(filepath.Join(repoDir, "..", "..", ".."))

	repoSrc, err := os.ReadFile(filepath.Join(repoDir, "repository.go"))
	if err != nil {
		t.Fatalf("read repository.go: %v", err)
	}
	if !strings.Contains(string(repoSrc), "ON CONFLICT (user_id)") {
		t.Fatal("GetOrCreate must use ON CONFLICT (user_id)")
	}

	migrationPath := filepath.Join(backendRoot, "migrations", "main", "20260816170000_carts_user_id_unique.sql")
	migration, err := os.ReadFile(migrationPath)
	if err != nil {
		t.Fatalf("read unique-user_id migration: %v", err)
	}
	parts := strings.SplitN(string(migration), "-- +goose Down", 2)
	if len(parts) != 2 {
		t.Fatal("migration must have goose Up and Down sections")
	}
	up, down := parts[0], parts[1]

	for _, want := range []string{
		"ALTER TABLE carts ALTER COLUMN user_id SET NOT NULL",
		"DROP INDEX IF EXISTS idx_carts_user_id",
		"CREATE UNIQUE INDEX IF NOT EXISTS uq_carts_user_id ON carts (user_id)",
	} {
		if !strings.Contains(up, want) {
			t.Fatalf("Up missing %q", want)
		}
	}
	for _, want := range []string{
		"DROP INDEX IF EXISTS uq_carts_user_id",
		"ALTER TABLE carts ALTER COLUMN user_id DROP NOT NULL",
		"CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts (user_id)",
	} {
		if !strings.Contains(down, want) {
			t.Fatalf("Down missing %q", want)
		}
	}
}

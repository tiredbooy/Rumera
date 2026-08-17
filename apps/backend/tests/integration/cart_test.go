//go:build integration

package integration

import (
	"context"
	"testing"

	"github.com/tiredbooy/internal/features/cart"
)

// TestCartGetOrCreate_SameUserReturnsSameCart is the PR-004a DB proof:
// GetOrCreate twice for one user must hit ON CONFLICT (user_id) and leave
// exactly one carts row. A second INSERT without ON CONFLICT must fail UNIQUE.
func TestCartGetOrCreate_SameUserReturnsSameCart(t *testing.T) {
	requireDB(t)
	resetTables(t, "users")
	ctx := context.Background()
	userID := seedUser(t)
	repo := cart.NewRepository(testPool)

	first, err := repo.GetOrCreate(ctx, userID)
	if err != nil {
		t.Fatalf("first GetOrCreate: %v", err)
	}
	if first == nil || first.ID == 0 {
		t.Fatalf("first GetOrCreate returned empty cart: %+v", first)
	}

	second, err := repo.GetOrCreate(ctx, userID)
	if err != nil {
		t.Fatalf("second GetOrCreate: %v", err)
	}
	if second.ID != first.ID {
		t.Fatalf("GetOrCreate returned different carts: %d vs %d", first.ID, second.ID)
	}

	var n int
	if err := testPool.QueryRow(ctx,
		`SELECT COUNT(*) FROM carts WHERE user_id = $1`, userID,
	).Scan(&n); err != nil {
		t.Fatalf("count carts: %v", err)
	}
	if n != 1 {
		t.Fatalf("carts for user = %d; want 1 (UNIQUE user_id)", n)
	}

	if _, err := testPool.Exec(ctx, `INSERT INTO carts (user_id) VALUES ($1)`, userID); err == nil {
		t.Fatal("second insert of same user_id succeeded; want unique violation")
	}
}

//go:build integration

package integration

import (
	"context"
	"testing"

	"github.com/tiredbooy/internal/features/orders"
	"github.com/tiredbooy/internal/models"
)

// adminListFilter mirrors what the admin handler builds: buyer projection on,
// default sort. The sort matters — `created_at` exists on BOTH orders and users
// now that the list joins them, so an unqualified ORDER BY is an ambiguous
// column error that only a real database can catch.
func adminListFilter(t *testing.T) orders.OrderFilter {
	t.Helper()
	f := orders.OrderFilter{BaseFilter: models.BaseFilter{
		PaginationParams: models.PaginationParams{Page: 1, Limit: 20},
		SortBy:           "created_at",
		OrderBy:          "desc",
	}}
	f.Defaults()
	return f
}

func seedNamedUser(t *testing.T, email string) (id int64, publicID string) {
	t.Helper()
	// phone carries a unique-where-not-null index, so it has to vary per user.
	err := testPool.QueryRow(context.Background(),
		`INSERT INTO users (user_id, email, first_name, last_name, phone)
		 VALUES (gen_random_uuid(), $1, 'Ali', 'Rezaei',
		         '0912' || lpad((nextval('users_id_seq') % 1000000)::text, 7, '0'))
		 RETURNING id, user_id::text`, email).Scan(&id, &publicID)
	if err != nil {
		t.Fatalf("seed named user: %v", err)
	}
	return id, publicID
}

// CF-1. The admin orders list carried no buyer at all, so triaging a morning
// meant opening every order to learn who placed it.
func TestAdminOrderListCarriesBuyerIdentity(t *testing.T) {
	requireDB(t)
	resetTables(t, "orders", "users")
	ctx := context.Background()
	repo := orders.NewRepository(testPool)

	userID, publicID := seedNamedUser(t, "triage@test.local")
	orderID := seedOrder(t, userID)

	rows, total, err := repo.GetAll(ctx, orders.AdminListFilter(adminListFilter(t)))
	if err != nil {
		t.Fatalf("admin list: %v", err)
	}
	if total != 1 || len(rows) != 1 {
		t.Fatalf("rows=%d total=%d; want 1, 1", len(rows), total)
	}
	got := rows[0]
	if got.ID != orderID {
		t.Fatalf("order id = %d, want %d", got.ID, orderID)
	}
	if got.Buyer == nil {
		t.Fatal("buyer is nil on the admin list — the whole point of CF-1")
	}
	if got.Buyer.Email != "triage@test.local" {
		t.Errorf("buyer email = %q", got.Buyer.Email)
	}
	if got.Buyer.FirstName == nil || *got.Buyer.FirstName != "Ali" {
		t.Errorf("buyer first name = %v", got.Buyer.FirstName)
	}
	// The public id is what the customers screen exposes, so it is the only id a
	// link back to the customer can be built from.
	if got.Buyer.UserID.String() != publicID {
		t.Errorf("buyer public id = %s, want %s", got.Buyer.UserID, publicID)
	}
	if got.Buyer.ID != userID {
		t.Errorf("buyer internal id = %d, want %d", got.Buyer.ID, userID)
	}
}

// The customer's own list shares this repository method and must not grow a
// buyer block describing the caller to themselves.
func TestCustomerOrderListHasNoBuyerBlock(t *testing.T) {
	requireDB(t)
	resetTables(t, "orders", "users")
	ctx := context.Background()
	repo := orders.NewRepository(testPool)

	userID, _ := seedNamedUser(t, "self@test.local")
	seedOrder(t, userID)

	f := adminListFilter(t) // same filter, WITHOUT the admin buyer opt-in
	f.UserID = &userID
	rows, _, err := repo.GetAll(ctx, f)
	if err != nil {
		t.Fatalf("customer list: %v", err)
	}
	if len(rows) != 1 {
		t.Fatalf("rows = %d, want 1", len(rows))
	}
	if rows[0].Buyer != nil {
		t.Error("customer list projected a buyer block; it should stay off by default")
	}
}

// The round trip CF-1 exists for: the customers screen only ever shows the UUID,
// so filtering orders by it has to work. The pre-existing numeric filter could
// only be used by someone who already had an order open.
func TestAdminOrderListFiltersByPublicCustomerID(t *testing.T) {
	requireDB(t)
	resetTables(t, "orders", "users")
	ctx := context.Background()
	repo := orders.NewRepository(testPool)

	wantedID, wantedPublic := seedNamedUser(t, "wanted@test.local")
	otherID, _ := seedNamedUser(t, "other@test.local")
	seedOrder(t, wantedID)
	seedOrder(t, wantedID)
	seedOrder(t, otherID)

	f := orders.AdminListFilter(adminListFilter(t))
	f.UserUUID = wantedPublic
	rows, total, err := repo.GetAll(ctx, f)
	if err != nil {
		t.Fatalf("filter by uuid: %v", err)
	}
	if total != 2 || len(rows) != 2 {
		t.Fatalf("rows=%d total=%d; want 2, 2 — the other buyer's order leaked or the filter missed", len(rows), total)
	}
	for _, r := range rows {
		if r.Buyer == nil || r.Buyer.ID != wantedID {
			t.Fatalf("row %d belongs to the wrong buyer", r.ID)
		}
	}
}

// An unknown UUID must return nothing rather than everything — a filter that
// silently no-ops would show one customer's orders under another's name.
func TestAdminOrderListUnknownPublicIDReturnsNothing(t *testing.T) {
	requireDB(t)
	resetTables(t, "orders", "users")
	ctx := context.Background()
	repo := orders.NewRepository(testPool)

	userID, _ := seedNamedUser(t, "present@test.local")
	seedOrder(t, userID)

	f := orders.AdminListFilter(adminListFilter(t))
	f.UserUUID = "00000000-0000-4000-8000-000000000000"
	rows, total, err := repo.GetAll(ctx, f)
	if err != nil {
		t.Fatalf("unknown uuid: %v", err)
	}
	if total != 0 || len(rows) != 0 {
		t.Fatalf("rows=%d total=%d; want 0, 0", len(rows), total)
	}
}

// Every sortable column is on `orders`, but `users` has a created_at too. This
// is the regression guard for the ambiguous-column error the join introduces.
func TestAdminOrderListSortsOnEverySupportedColumn(t *testing.T) {
	requireDB(t)
	resetTables(t, "orders", "users")
	ctx := context.Background()
	repo := orders.NewRepository(testPool)

	userID, _ := seedNamedUser(t, "sort@test.local")
	seedOrder(t, userID)
	seedOrder(t, userID)

	for _, col := range []string{"created_at", "total_amount", "status"} {
		for _, dir := range []string{"asc", "desc"} {
			f := adminListFilter(t)
			f.SortBy, f.OrderBy = col, dir
			f = orders.AdminListFilter(f)
			if _, total, err := repo.GetAll(ctx, f); err != nil || total != 2 {
				t.Fatalf("sort %s %s: total=%d err=%v", col, dir, total, err)
			}
		}
	}
}

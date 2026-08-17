package inventory

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/tiredbooy/internal/models"
)

func TestReservationStatusConstants(t *testing.T) {
	if reservationActive != "active" || reservationReleased != "released" || reservationDeducted != "deducted" {
		t.Fatalf("unexpected reservation statuses")
	}
}

func TestActivateReservationSQL_OnlyReactivatesReleased(t *testing.T) {
	q := strings.ToLower(activateReservationSQL)
	if !strings.Contains(q, "inventory_reservations") {
		t.Fatal("activate must write inventory_reservations")
	}
	if !strings.Contains(q, "status = 'released'") {
		t.Fatal("activate must only revive released rows (never deducted)")
	}
	if strings.Contains(q, "status <> 'active'") || strings.Contains(q, "status != 'active'") {
		t.Fatal("activate must not revive deducted rows")
	}
}

func TestCloseReservationSQL_RequiresActiveRow(t *testing.T) {
	q := strings.ToLower(closeReservationSQL)
	if !strings.Contains(q, "status = 'active'") {
		t.Fatal("close must require an active reservation")
	}
	if !strings.Contains(q, "order_id") || !strings.Contains(q, "product_variant_id") {
		t.Fatal("close must be scoped to order + variant")
	}
}

// reservationBook is an in-memory model of the production contract:
// committed_stock only moves when THIS order owns an active row.
type reservationBook struct {
	Repository
	tx        *fakeTx
	onHand    map[int64]int
	committed map[int64]int
	rows      map[reservationKey]reservationRow
}

type reservationKey struct {
	orderID   int64
	variantID int64
}

type reservationRow struct {
	qty    int
	status string
}

func newReservationBook(onHand, committed int) *reservationBook {
	return &reservationBook{
		tx:        &fakeTx{},
		onHand:    map[int64]int{1: onHand},
		committed: map[int64]int{1: committed},
		rows:      map[reservationKey]reservationRow{},
	}
}

func (b *reservationBook) BeginTx(context.Context) (pgx.Tx, error) {
	if b.tx == nil {
		b.tx = &fakeTx{}
	}
	return b.tx, nil
}

func (b *reservationBook) Reserve(_ context.Context, _ pgx.Tx, variantID int64, quantity int, orderID int64) error {
	key := reservationKey{orderID, variantID}
	if row, ok := b.rows[key]; ok {
		if row.status == reservationActive && row.qty == quantity {
			return nil
		}
		if row.status != reservationReleased {
			return models.ErrInvalidState
		}
	}
	avail := b.onHand[variantID] - b.committed[variantID]
	if avail < quantity {
		return models.ErrInsufficientStock
	}
	b.committed[variantID] += quantity
	b.rows[key] = reservationRow{qty: quantity, status: reservationActive}
	return nil
}

func (b *reservationBook) Release(_ context.Context, _ pgx.Tx, variantID int64, quantity int, orderID int64) error {
	key := reservationKey{orderID, variantID}
	row, ok := b.rows[key]
	if !ok {
		return nil
	}
	if row.status != reservationActive || row.qty != quantity {
		return nil
	}
	if b.committed[variantID] < quantity {
		return models.ErrInvalidState
	}
	b.committed[variantID] -= quantity
	row.status = reservationReleased
	b.rows[key] = row
	return nil
}

func (b *reservationBook) Deduct(_ context.Context, _ pgx.Tx, variantID int64, quantity int, orderID int64) error {
	key := reservationKey{orderID, variantID}
	row, ok := b.rows[key]
	if !ok || row.status != reservationActive || row.qty != quantity {
		return models.ErrInvalidState
	}
	if b.onHand[variantID] < quantity || b.committed[variantID] < quantity {
		return models.ErrInvalidState
	}
	b.onHand[variantID] -= quantity
	b.committed[variantID] -= quantity
	row.status = reservationDeducted
	b.rows[key] = row
	return nil
}

func TestDeductAfterReleaseDoesNotStealForeignCommitted(t *testing.T) {
	book := newReservationBook(10, 0)
	svc := NewService(book, &movementRepoStub{})
	ctx := context.Background()
	line := []StockLine{{VariantID: 1, Quantity: 2}}

	if err := svc.ReserveForOrder(ctx, 100, line); err != nil {
		t.Fatalf("reserve A: %v", err)
	}
	if err := svc.ReleaseForOrder(ctx, 100, line); err != nil {
		t.Fatalf("release A: %v", err)
	}
	if err := svc.ReserveForOrder(ctx, 200, line); err != nil {
		t.Fatalf("reserve B: %v", err)
	}
	if book.committed[1] != 2 {
		t.Fatalf("committed after B reserved = %d; want 2", book.committed[1])
	}

	err := svc.DeductForOrder(ctx, 100, line)
	if !errors.Is(err, models.ErrInvalidState) {
		t.Fatalf("deduct A after release = %v; want ErrInvalidState", err)
	}
	if book.committed[1] != 2 {
		t.Fatalf("committed after late deduct A = %d; want 2 (B's hold)", book.committed[1])
	}
	if book.onHand[1] != 10 {
		t.Fatalf("on_hand after late deduct A = %d; want 10", book.onHand[1])
	}

	if err := svc.ReleaseForOrder(ctx, 100, line); err != nil {
		t.Fatalf("re-release A: %v", err)
	}
	if book.committed[1] != 2 {
		t.Fatalf("committed after re-release A = %d; want 2 (must not steal B)", book.committed[1])
	}
}

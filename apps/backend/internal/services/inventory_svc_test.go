package services

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/tiredbooy/internal/mocks"
	"github.com/tiredbooy/internal/models"
)

func orderItems() []models.OrderItemResponse {
	return []models.OrderItemResponse{
		{VariantID: 10, Quantity: 2},
		{VariantID: 11, Quantity: 1},
	}
}

func TestInventoryService_ReserveForOrder_Success(t *testing.T) {
	tx := &mocks.FakeTx{}
	var reserved int
	repo := &mocks.InventoryRepo{
		Tx: tx,
		ReserveFn: func(context.Context, pgx.Tx, int64, int, int64) error {
			reserved++
			return nil
		},
	}
	svc := NewInventoryService(repo, &mocks.MovementRepo{})

	if err := svc.ReserveForOrder(context.Background(), 1, orderItems()); err != nil {
		t.Fatalf("ReserveForOrder err = %v; want nil", err)
	}
	if reserved != 2 {
		t.Fatalf("Reserve called %d times; want 2", reserved)
	}
	if !tx.Committed || tx.RolledBack {
		t.Fatalf("tx state: committed=%v rolledback=%v; want committed", tx.Committed, tx.RolledBack)
	}
}

func TestInventoryService_ReserveForOrder_InsufficientStockRollsBack(t *testing.T) {
	tx := &mocks.FakeTx{}
	repo := &mocks.InventoryRepo{
		Tx: tx,
		ReserveFn: func(context.Context, pgx.Tx, int64, int, int64) error {
			return models.ErrInsufficientStock
		},
	}
	svc := NewInventoryService(repo, &mocks.MovementRepo{})

	err := svc.ReserveForOrder(context.Background(), 1, orderItems())
	if !errors.Is(err, models.ErrInsufficientStock) {
		t.Fatalf("err = %v; want ErrInsufficientStock unwrapped", err)
	}
	if tx.Committed {
		t.Fatal("tx must not commit on insufficient stock")
	}
	if !tx.RolledBack {
		t.Fatal("tx must roll back on insufficient stock")
	}
}

func TestInventoryService_ReleaseForOrder_Success(t *testing.T) {
	tx := &mocks.FakeTx{}
	var released int
	repo := &mocks.InventoryRepo{
		Tx: tx,
		ReleaseFn: func(context.Context, pgx.Tx, int64, int, int64) error {
			released++
			return nil
		},
	}
	svc := NewInventoryService(repo, &mocks.MovementRepo{})

	if err := svc.ReleaseForOrder(context.Background(), 1, orderItems()); err != nil {
		t.Fatalf("ReleaseForOrder err = %v; want nil", err)
	}
	if released != 2 || !tx.Committed {
		t.Fatalf("released=%d committed=%v; want 2 / true", released, tx.Committed)
	}
}

func TestInventoryService_DeductForOrder_Success(t *testing.T) {
	tx := &mocks.FakeTx{}
	var deducted int
	repo := &mocks.InventoryRepo{
		Tx: tx,
		DeductFn: func(context.Context, pgx.Tx, int64, int, int64) error {
			deducted++
			return nil
		},
	}
	svc := NewInventoryService(repo, &mocks.MovementRepo{})

	if err := svc.DeductForOrder(context.Background(), 1, orderItems()); err != nil {
		t.Fatalf("DeductForOrder err = %v; want nil", err)
	}
	if deducted != 2 || !tx.Committed {
		t.Fatalf("deducted=%d committed=%v; want 2 / true", deducted, tx.Committed)
	}
}

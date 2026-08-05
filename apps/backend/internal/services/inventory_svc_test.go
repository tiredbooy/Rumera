package services

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/tiredbooy/internal/mocks"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
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

func TestInventoryService_AdjustStock_CommitsExactDelta(t *testing.T) {
	tx := &mocks.FakeTx{}
	note := "cycle count"
	called := false
	repo := &mocks.InventoryRepo{
		Tx: tx,
		AdjustFn: func(_ context.Context, gotTx pgx.Tx, variantID int64, req models.AdjustStockReq, orderID *int64) error {
			called = true
			if gotTx != tx || variantID != 14 || req.Quantity != -3 || req.Type != models.MovementTypeAdjustment || req.Note == nil || *req.Note != note || orderID != nil {
				t.Fatalf("adjust args = tx %T variant %d req %+v order %v", gotTx, variantID, req, orderID)
			}
			return nil
		},
	}
	svc := NewInventoryService(repo, &mocks.MovementRepo{})

	err := svc.AdjustStock(context.Background(), 14, models.AdjustStockReq{
		Quantity: -3,
		Type:     models.MovementTypeAdjustment,
		Note:     &note,
	}, nil)
	if err != nil {
		t.Fatalf("AdjustStock: %v", err)
	}
	if !called || !tx.Committed || tx.RolledBack {
		t.Fatalf("called=%v committed=%v rolledback=%v", called, tx.Committed, tx.RolledBack)
	}
}

func TestInventoryService_AdjustStock_BusinessFailureRollsBack(t *testing.T) {
	tx := &mocks.FakeTx{}
	repo := &mocks.InventoryRepo{
		Tx: tx,
		AdjustFn: func(context.Context, pgx.Tx, int64, models.AdjustStockReq, *int64) error {
			return models.ErrInsufficientStock
		},
	}
	svc := NewInventoryService(repo, &mocks.MovementRepo{})

	err := svc.AdjustStock(context.Background(), 14, models.AdjustStockReq{
		Quantity: -20,
		Type:     models.MovementTypeAdjustment,
	}, nil)
	if !errors.Is(err, models.ErrInsufficientStock) {
		t.Fatalf("AdjustStock error = %v, want ErrInsufficientStock", err)
	}
	if tx.Committed || !tx.RolledBack {
		t.Fatalf("committed=%v rolledback=%v", tx.Committed, tx.RolledBack)
	}
}

func TestInventoryService_AdjustStock_RejectsSemanticallyInvalidMovement(t *testing.T) {
	repoCalls := 0
	repo := &mocks.InventoryRepo{
		AdjustFn: func(context.Context, pgx.Tx, int64, models.AdjustStockReq, *int64) error {
			repoCalls++
			return nil
		},
	}
	svc := NewInventoryService(repo, &mocks.MovementRepo{})

	invalid := []models.AdjustStockReq{
		{Quantity: 1, Type: models.MovementTypeDamage},
		{Quantity: -1, Type: models.MovementTypeRestock},
		{Quantity: 1, Type: models.MovementTypeReservation},
		{Quantity: 0, Type: models.MovementTypeAdjustment},
	}
	for _, request := range invalid {
		err := svc.AdjustStock(context.Background(), 14, request, nil)
		if !errors.Is(err, models.ErrInvalidInventoryAdjustment) {
			t.Fatalf("AdjustStock(%+v) error = %v, want ErrInvalidInventoryAdjustment", request, err)
		}
	}
	if repoCalls != 0 {
		t.Fatalf("repository calls = %d, want 0", repoCalls)
	}
}

func TestInventoryService_GetMovementsByVariant_RequiresInventory(t *testing.T) {
	movementCalls := 0
	// Missing variant: EnsureForVariant (or subsequent Get) surfaces as apperr.ErrNotFound.
	repo := &mocks.InventoryRepo{
		EnsureForVariantFn: func(context.Context, int64) error {
			return models.ErrNotFound
		},
		GetByVariantFn: func(context.Context, int64) (*models.Inventory, error) {
			return nil, models.ErrNotFound
		},
	}
	movements := &mocks.MovementRepo{
		GetByVariantFn: func(context.Context, int64) ([]*models.InventoryMovement, error) {
			movementCalls++
			return nil, nil
		},
	}
	svc := NewInventoryService(repo, movements)

	_, err := svc.GetMovementsByVariant(context.Background(), 99)
	if !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("GetMovementsByVariant error = %v, want apperr.ErrNotFound", err)
	}
	if movementCalls != 0 {
		t.Fatalf("movement calls = %d, want 0", movementCalls)
	}
}

func TestInventoryService_UpdateReorder_ReturnsConfirmedInventory(t *testing.T) {
	point, quantity := 7, 30
	want := &models.Inventory{ProductVariantID: 14, ReorderPoint: point, ReorderQuantity: quantity}
	repo := &mocks.InventoryRepo{
		UpdateReorderFn: func(_ context.Context, variantID int64, req models.UpdateReorderReq) (*models.Inventory, error) {
			if variantID != 14 || req.ReorderPoint == nil || *req.ReorderPoint != point || req.ReorderQuantity == nil || *req.ReorderQuantity != quantity {
				t.Fatalf("UpdateReorder args = variant %d req %+v", variantID, req)
			}
			return want, nil
		},
	}
	svc := NewInventoryService(repo, &mocks.MovementRepo{})

	got, err := svc.UpdateReorder(context.Background(), 14, models.UpdateReorderReq{
		ReorderPoint: &point, ReorderQuantity: &quantity,
	})
	if err != nil || got != want {
		t.Fatalf("UpdateReorder = %+v, %v", got, err)
	}
}

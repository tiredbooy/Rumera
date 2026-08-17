package inventory

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

// Local FakeTx — inventory tests must not import mocks (cycle via Repository).
type fakeTx struct {
	Committed  bool
	RolledBack bool
}

func (t *fakeTx) Begin(context.Context) (pgx.Tx, error) { return t, nil }
func (t *fakeTx) Commit(context.Context) error          { t.Committed = true; return nil }
func (t *fakeTx) Rollback(context.Context) error        { t.RolledBack = true; return nil }
func (t *fakeTx) CopyFrom(context.Context, pgx.Identifier, []string, pgx.CopyFromSource) (int64, error) {
	return 0, nil
}
func (t *fakeTx) SendBatch(context.Context, *pgx.Batch) pgx.BatchResults { return nil }
func (t *fakeTx) LargeObjects() pgx.LargeObjects                         { return pgx.LargeObjects{} }
func (t *fakeTx) Prepare(context.Context, string, string) (*pgconn.StatementDescription, error) {
	return nil, nil
}
func (t *fakeTx) Exec(context.Context, string, ...any) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, nil
}
func (t *fakeTx) Query(context.Context, string, ...any) (pgx.Rows, error) { return nil, nil }
func (t *fakeTx) QueryRow(context.Context, string, ...any) pgx.Row        { return nil }
func (t *fakeTx) Conn() *pgx.Conn                                         { return nil }

type invRepoStub struct {
	Repository
	tx              *fakeTx
	reserveFn       func(context.Context, pgx.Tx, int64, int, int64) error
	releaseFn       func(context.Context, pgx.Tx, int64, int, int64) error
	deductFn        func(context.Context, pgx.Tx, int64, int, int64) error
	adjustFn        func(context.Context, pgx.Tx, int64, AdjustStockReq, *int64) error
	ensureFn        func(context.Context, int64) error
	getByVariantFn  func(context.Context, int64) (*Inventory, error)
	updateReorderFn func(context.Context, int64, UpdateReorderReq) (*Inventory, error)
	ensureTxCalls   int
}

func (r *invRepoStub) BeginTx(context.Context) (pgx.Tx, error) {
	if r.tx == nil {
		r.tx = &fakeTx{}
	}
	return r.tx, nil
}
func (r *invRepoStub) Reserve(ctx context.Context, tx pgx.Tx, variantID int64, quantity int, orderID int64) error {
	if r.reserveFn != nil {
		return r.reserveFn(ctx, tx, variantID, quantity, orderID)
	}
	return nil
}
func (r *invRepoStub) Release(ctx context.Context, tx pgx.Tx, variantID int64, quantity int, orderID int64) error {
	if r.releaseFn != nil {
		return r.releaseFn(ctx, tx, variantID, quantity, orderID)
	}
	return nil
}
func (r *invRepoStub) Deduct(ctx context.Context, tx pgx.Tx, variantID int64, quantity int, orderID int64) error {
	if r.deductFn != nil {
		return r.deductFn(ctx, tx, variantID, quantity, orderID)
	}
	return nil
}
func (r *invRepoStub) Adjust(ctx context.Context, tx pgx.Tx, variantID int64, req AdjustStockReq, orderID *int64) error {
	if r.adjustFn != nil {
		return r.adjustFn(ctx, tx, variantID, req, orderID)
	}
	return nil
}
func (r *invRepoStub) EnsureForVariant(ctx context.Context, variantID int64) error {
	if r.ensureFn != nil {
		return r.ensureFn(ctx, variantID)
	}
	return nil
}
func (r *invRepoStub) EnsureForVariantTx(ctx context.Context, _ pgx.Tx, variantID int64) error {
	r.ensureTxCalls++
	return r.EnsureForVariant(ctx, variantID)
}
func (r *invRepoStub) GetByVariantID(ctx context.Context, variantID int64) (*Inventory, error) {
	if r.getByVariantFn != nil {
		return r.getByVariantFn(ctx, variantID)
	}
	return nil, nil
}
func (r *invRepoStub) UpdateReorder(ctx context.Context, variantID int64, req UpdateReorderReq) (*Inventory, error) {
	if r.updateReorderFn != nil {
		return r.updateReorderFn(ctx, variantID, req)
	}
	return nil, nil
}

type movementRepoStub struct {
	MovementRepository
	getByVariantFn func(context.Context, int64) ([]*InventoryMovement, error)
}

func (m *movementRepoStub) GetByVariantID(ctx context.Context, variantID int64) ([]*InventoryMovement, error) {
	if m.getByVariantFn != nil {
		return m.getByVariantFn(ctx, variantID)
	}
	return nil, nil
}

func orderItems() []StockLine {
	return []StockLine{
		{VariantID: 10, Quantity: 2},
		{VariantID: 11, Quantity: 1},
	}
}

func TestService_ReserveForOrder_Success(t *testing.T) {
	tx := &fakeTx{}
	var reserved int
	repo := &invRepoStub{
		tx: tx,
		reserveFn: func(context.Context, pgx.Tx, int64, int, int64) error {
			reserved++
			return nil
		},
	}
	svc := NewService(repo, &movementRepoStub{})

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

func TestService_ReserveForOrder_InsufficientStockRollsBack(t *testing.T) {
	tx := &fakeTx{}
	repo := &invRepoStub{
		tx: tx,
		reserveFn: func(context.Context, pgx.Tx, int64, int, int64) error {
			return models.ErrInsufficientStock
		},
	}
	svc := NewService(repo, &movementRepoStub{})

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

func TestService_ReleaseForOrder_Success(t *testing.T) {
	tx := &fakeTx{}
	var released int
	repo := &invRepoStub{
		tx: tx,
		releaseFn: func(context.Context, pgx.Tx, int64, int, int64) error {
			released++
			return nil
		},
	}
	svc := NewService(repo, &movementRepoStub{})

	if err := svc.ReleaseForOrder(context.Background(), 1, orderItems()); err != nil {
		t.Fatalf("ReleaseForOrder err = %v; want nil", err)
	}
	if released != 2 || !tx.Committed {
		t.Fatalf("released=%d committed=%v; want 2 / true", released, tx.Committed)
	}
}

func TestService_DeductForOrder_Success(t *testing.T) {
	tx := &fakeTx{}
	var deducted int
	repo := &invRepoStub{
		tx: tx,
		deductFn: func(context.Context, pgx.Tx, int64, int, int64) error {
			deducted++
			return nil
		},
	}
	svc := NewService(repo, &movementRepoStub{})

	if err := svc.DeductForOrder(context.Background(), 1, orderItems()); err != nil {
		t.Fatalf("DeductForOrder err = %v; want nil", err)
	}
	if deducted != 2 || !tx.Committed {
		t.Fatalf("deducted=%d committed=%v; want 2 / true", deducted, tx.Committed)
	}
}

func TestService_AdjustStock_CommitsExactDelta(t *testing.T) {
	tx := &fakeTx{}
	note := "cycle count"
	called := false
	repo := &invRepoStub{
		tx: tx,
		adjustFn: func(_ context.Context, gotTx pgx.Tx, variantID int64, req AdjustStockReq, orderID *int64) error {
			called = true
			if gotTx != tx || variantID != 14 || req.Quantity != -3 || req.Type != MovementTypeAdjustment || req.Note == nil || *req.Note != note || orderID != nil {
				t.Fatalf("adjust args = tx %T variant %d req %+v order %v", gotTx, variantID, req, orderID)
			}
			return nil
		},
	}
	svc := NewService(repo, &movementRepoStub{})

	err := svc.AdjustStock(context.Background(), 14, AdjustStockReq{
		Quantity: -3,
		Type:     MovementTypeAdjustment,
		Note:     &note,
	}, nil)
	if err != nil {
		t.Fatalf("AdjustStock: %v", err)
	}
	if !called || !tx.Committed || tx.RolledBack {
		t.Fatalf("called=%v committed=%v rolledback=%v", called, tx.Committed, tx.RolledBack)
	}
}

func TestService_AdjustStock_BusinessFailureRollsBack(t *testing.T) {
	tx := &fakeTx{}
	repo := &invRepoStub{
		tx: tx,
		adjustFn: func(context.Context, pgx.Tx, int64, AdjustStockReq, *int64) error {
			return models.ErrInsufficientStock
		},
	}
	svc := NewService(repo, &movementRepoStub{})

	err := svc.AdjustStock(context.Background(), 14, AdjustStockReq{
		Quantity: -20,
		Type:     MovementTypeAdjustment,
	}, nil)
	if !errors.Is(err, models.ErrInsufficientStock) {
		t.Fatalf("AdjustStock error = %v, want ErrInsufficientStock", err)
	}
	if tx.Committed || !tx.RolledBack {
		t.Fatalf("committed=%v rolledback=%v", tx.Committed, tx.RolledBack)
	}
}

func TestService_AdjustStock_RejectsSemanticallyInvalidMovement(t *testing.T) {
	repoCalls := 0
	repo := &invRepoStub{
		adjustFn: func(context.Context, pgx.Tx, int64, AdjustStockReq, *int64) error {
			repoCalls++
			return nil
		},
	}
	svc := NewService(repo, &movementRepoStub{})

	invalid := []AdjustStockReq{
		{Quantity: 1, Type: MovementTypeDamage},
		{Quantity: -1, Type: MovementTypeRestock},
		{Quantity: 1, Type: MovementTypeReservation},
		{Quantity: 0, Type: MovementTypeAdjustment},
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

func TestService_GetMovementsByVariant_RequiresInventory(t *testing.T) {
	movementCalls := 0
	repo := &invRepoStub{
		ensureFn: func(context.Context, int64) error {
			return models.ErrNotFound
		},
		getByVariantFn: func(context.Context, int64) (*Inventory, error) {
			return nil, models.ErrNotFound
		},
	}
	movements := &movementRepoStub{
		getByVariantFn: func(context.Context, int64) ([]*InventoryMovement, error) {
			movementCalls++
			return nil, nil
		},
	}
	svc := NewService(repo, movements)

	_, err := svc.GetMovementsByVariant(context.Background(), 99)
	if !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("GetMovementsByVariant error = %v, want apperr.ErrNotFound", err)
	}
	if movementCalls != 0 {
		t.Fatalf("movement calls = %d, want 0", movementCalls)
	}
}

func TestService_UpdateReorder_ReturnsConfirmedInventory(t *testing.T) {
	point, quantity := 7, 30
	want := &Inventory{ProductVariantID: 14, ReorderPoint: point, ReorderQuantity: quantity}
	repo := &invRepoStub{
		updateReorderFn: func(_ context.Context, variantID int64, req UpdateReorderReq) (*Inventory, error) {
			if variantID != 14 || req.ReorderPoint == nil || *req.ReorderPoint != point || req.ReorderQuantity == nil || *req.ReorderQuantity != quantity {
				t.Fatalf("UpdateReorder args = variant %d req %+v", variantID, req)
			}
			return want, nil
		},
	}
	svc := NewService(repo, &movementRepoStub{})

	got, err := svc.UpdateReorder(context.Background(), 14, UpdateReorderReq{
		ReorderPoint: &point, ReorderQuantity: &quantity,
	})
	if err != nil || got != want {
		t.Fatalf("UpdateReorder = %+v, %v", got, err)
	}
}

func TestIsBusinessError_WrappedSentinel(t *testing.T) {
	sentinels := []error{
		models.ErrInsufficientStock,
		models.ErrNotFound,
		models.ErrInvalidState,
	}
	for _, sentinel := range sentinels {
		wrapped := fmt.Errorf("repo: %w", sentinel)
		if !isBusinessError(wrapped) {
			t.Fatalf("isBusinessError(%v) = false; want true for wrapped sentinel", wrapped)
		}
	}
	if isBusinessError(fmt.Errorf("repo: %w", errors.New("disk full"))) {
		t.Fatal("isBusinessError(wrapped unknown) = true; want false")
	}
}

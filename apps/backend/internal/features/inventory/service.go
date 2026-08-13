// internal/services/inventory_service.go
package inventory

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
	"github.com/tiredbooy/pkg/metrics"
	"github.com/tiredbooy/pkg/tracing"
	"github.com/tiredbooy/pkg/utils"
)

type Service interface {
	// Admin operations
	GetByVariantID(ctx context.Context, variantID int64) (*Inventory, error)
	GetAll(ctx context.Context, filter InventoryFilter) ([]*Inventory, int64, error)
	GetLowStock(ctx context.Context) ([]*Inventory, error)
	GetMovements(ctx context.Context, filter MovementFilter) ([]*InventoryMovement, int64, error)
	GetMovementsByVariant(ctx context.Context, variantID int64) ([]*InventoryMovement, error)
	// EnsureForVariant creates a zero-stock row when a variant has none yet.
	EnsureForVariant(ctx context.Context, variantID int64) error
	AdjustStock(ctx context.Context, variantID int64, req AdjustStockReq, orderID *int64) error
	UpdateReorder(ctx context.Context, variantID int64, req UpdateReorderReq) (*Inventory, error)

	// Order lifecycle — called by OrderService
	ReserveForOrder(ctx context.Context, orderID int64, items []StockLine) error
	// ReserveForOrderTx reserves stock on a caller-supplied transaction, so order
	// creation and stock reservation commit atomically (no oversell window, no
	// dangling pending order on crash).
	ReserveForOrderTx(ctx context.Context, tx pgx.Tx, orderID int64, items []StockLine) error
	ReleaseForOrder(ctx context.Context, orderID int64, items []StockLine) error
	DeductForOrder(ctx context.Context, orderID int64, items []StockLine) error
	// DeductForOrderTx drains committed stock on a caller-supplied transaction, so
	// confirming a payment and deducting stock commit atomically.
	DeductForOrderTx(ctx context.Context, tx pgx.Tx, orderID int64, items []StockLine) error
}

type inventoryService struct {
	inventoryRepo Repository
	movementRepo  MovementRepository
}

func NewService(
	inventoryRepo Repository,
	movementRepo MovementRepository,
) Service {
	return &inventoryService{
		inventoryRepo: inventoryRepo,
		movementRepo:  movementRepo,
	}
}

// ── Admin reads ───────────────────────────────────────────────────────────────

func (s *inventoryService) EnsureForVariant(ctx context.Context, variantID int64) error {
	if variantID <= 0 {
		return apperr.ErrInvalidRequest
	}
	if err := s.inventoryRepo.EnsureForVariant(ctx, variantID); err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrNotFound
		}
		return fmt.Errorf("inventoryService.EnsureForVariant: %w", err)
	}
	return nil
}

func (s *inventoryService) GetByVariantID(ctx context.Context, variantID int64) (*Inventory, error) {
	// Auto-create a zero-stock row so admin detail never 404s for new variants.
	if err := s.inventoryRepo.EnsureForVariant(ctx, variantID); err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("inventoryService.GetByVariantID ensure: %w", err)
	}
	inv, err := s.inventoryRepo.GetByVariantID(ctx, variantID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("inventoryService.GetByVariantID: %w", err)
	}
	return inv, nil
}

func (s *inventoryService) GetAll(ctx context.Context, filter InventoryFilter) ([]*Inventory, int64, error) {
	items, total, err := s.inventoryRepo.GetAll(ctx, filter)
	if err != nil {
		return nil, 0, fmt.Errorf("inventoryService.GetAll: %w", err)
	}
	return items, total, nil
}

func (s *inventoryService) GetLowStock(ctx context.Context) ([]*Inventory, error) {
	items, err := s.inventoryRepo.GetLowStock(ctx)
	if err != nil {
		return nil, fmt.Errorf("inventoryService.GetLowStock: %w", err)
	}
	return items, nil
}

func (s *inventoryService) GetMovements(ctx context.Context, filter MovementFilter) ([]*InventoryMovement, int64, error) {
	movements, total, err := s.movementRepo.GetAll(ctx, filter)
	if err != nil {
		return nil, 0, fmt.Errorf("inventoryService.GetMovements: %w", err)
	}
	return movements, total, nil
}

func (s *inventoryService) GetMovementsByVariant(ctx context.Context, variantID int64) ([]*InventoryMovement, error) {
	if _, err := s.GetByVariantID(ctx, variantID); err != nil {
		return nil, err
	}
	movements, err := s.movementRepo.GetByVariantID(ctx, variantID)
	if err != nil {
		return nil, fmt.Errorf("inventoryService.GetMovementsByVariant: %w", err)
	}
	return movements, nil
}

// ── Admin writes ──────────────────────────────────────────────────────────────

func (s *inventoryService) AdjustStock(ctx context.Context, variantID int64, req AdjustStockReq, orderID *int64) error {
	if !validInventoryAdjustment(req) {
		return fmt.Errorf("inventoryService.AdjustStock: %w", models.ErrInvalidInventoryAdjustment)
	}
	tx, err := s.inventoryRepo.BeginTx(ctx)
	if err != nil {
		return fmt.Errorf("inventoryService.AdjustStock: begin tx: %w", err)
	}
	defer utils.RollbackOnErr(ctx, tx, &err)

	// Ensure row exists so first adjust on a new variant does not miss.
	if err = s.inventoryRepo.EnsureForVariantTx(ctx, tx, variantID); err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrNotFound
		}
		return fmt.Errorf("inventoryService.AdjustStock ensure: %w", err)
	}

	if err = s.inventoryRepo.Adjust(ctx, tx, variantID, req, orderID); err != nil {
		if isBusinessError(err) {
			return err
		}
		return fmt.Errorf("inventoryService.AdjustStock: %w", err)
	}

	if err = tx.Commit(ctx); err != nil {
		return fmt.Errorf("inventoryService.AdjustStock: commit: %w", err)
	}
	return nil
}

func validInventoryAdjustment(req AdjustStockReq) bool {
	switch req.Type {
	case MovementTypeAdjustment:
		return req.Quantity != 0
	case MovementTypeRestock, MovementTypeRefund:
		return req.Quantity > 0
	case MovementTypePurchase, MovementTypeDamage:
		return req.Quantity < 0
	default:
		return false
	}
}

func (s *inventoryService) UpdateReorder(ctx context.Context, variantID int64, req UpdateReorderReq) (*Inventory, error) {
	if err := s.inventoryRepo.EnsureForVariant(ctx, variantID); err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("inventoryService.UpdateReorder ensure: %w", err)
	}
	inv, err := s.inventoryRepo.UpdateReorder(ctx, variantID, req)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("inventoryService.UpdateReorder: %w", err)
	}
	return inv, nil
}

// ── Order lifecycle ───────────────────────────────────────────────────────────

// ReserveForOrder moves stock from available → committed for every item in the
// order. The entire batch is atomic — if any variant has insufficient stock the
// transaction rolls back and no inventory is touched.
func (s *inventoryService) ReserveForOrder(ctx context.Context, orderID int64, items []StockLine) (err error) {
	tx, err := s.inventoryRepo.BeginTx(ctx)
	if err != nil {
		return fmt.Errorf("inventoryService.ReserveForOrder: begin tx: %w", err)
	}
	defer utils.RollbackOnErr(ctx, tx, &err)

	if err = s.ReserveForOrderTx(ctx, tx, orderID, items); err != nil {
		return err
	}

	if err = tx.Commit(ctx); err != nil {
		return fmt.Errorf("inventoryService.ReserveForOrder: commit: %w", err)
	}
	return nil
}

// ReserveForOrderTx reserves every line on the supplied transaction. The batch is
// atomic with whatever else the caller's tx contains — if any variant is short,
// the error propagates and the caller's deferred rollback undoes the whole unit.
func (s *inventoryService) ReserveForOrderTx(ctx context.Context, tx pgx.Tx, orderID int64, items []StockLine) (err error) {
	ctx, endSpan := tracing.Start(ctx, "inventory.ReserveForOrder", tracing.Int64("order.id", orderID))
	defer func() {
		if err != nil {
			metrics.IncInventoryOp(metrics.InventoryOpReserve, metrics.ResultError)
		} else {
			metrics.IncInventoryOp(metrics.InventoryOpReserve, metrics.ResultOK)
		}
		endSpan(err)
	}()

	for _, item := range items {
		if err = s.inventoryRepo.Reserve(ctx, tx, item.VariantID, item.Quantity, orderID); err != nil {
			// ErrInsufficientStock bubbles up as-is so the caller can map it
			// to a 409/422 without wrapping it into oblivion.
			if isBusinessError(err) {
				return err
			}
			return fmt.Errorf("inventoryService.ReserveForOrderTx variant %d: %w", item.VariantID, err)
		}
	}
	return nil
}

// ReleaseForOrder moves stock back from committed → available without changing
// physical stock.
// Called when an order is cancelled before payment.
func (s *inventoryService) ReleaseForOrder(ctx context.Context, orderID int64, items []StockLine) (err error) {
	ctx, endSpan := tracing.Start(ctx, "inventory.ReleaseForOrder", tracing.Int64("order.id", orderID))
	defer func() {
		if err != nil {
			metrics.IncInventoryOp(metrics.InventoryOpRelease, metrics.ResultError)
		} else {
			metrics.IncInventoryOp(metrics.InventoryOpRelease, metrics.ResultOK)
		}
		endSpan(err)
	}()

	tx, err := s.inventoryRepo.BeginTx(ctx)
	if err != nil {
		return fmt.Errorf("inventoryService.ReleaseForOrder: begin tx: %w", err)
	}
	defer utils.RollbackOnErr(ctx, tx, &err)

	for _, item := range items {
		if err = s.inventoryRepo.Release(ctx, tx, item.VariantID, item.Quantity, orderID); err != nil {
			return fmt.Errorf("inventoryService.ReleaseForOrder variant %d: %w", item.VariantID, err)
		}
	}

	if err = tx.Commit(ctx); err != nil {
		return fmt.Errorf("inventoryService.ReleaseForOrder: commit: %w", err)
	}
	return nil
}

// DeductForOrder removes paid units from physical and committed stock together.
func (s *inventoryService) DeductForOrder(ctx context.Context, orderID int64, items []StockLine) (err error) {
	tx, err := s.inventoryRepo.BeginTx(ctx)
	if err != nil {
		return fmt.Errorf("inventoryService.DeductForOrder: begin tx: %w", err)
	}
	defer utils.RollbackOnErr(ctx, tx, &err)

	if err = s.DeductForOrderTx(ctx, tx, orderID, items); err != nil {
		return err
	}

	if err = tx.Commit(ctx); err != nil {
		return fmt.Errorf("inventoryService.DeductForOrder: commit: %w", err)
	}
	return nil
}

// DeductForOrderTx drains committed stock for every line on the supplied
// transaction, so the deduction is atomic with whatever else the caller's tx
// contains (e.g. confirming the payment + marking the order paid).
func (s *inventoryService) DeductForOrderTx(ctx context.Context, tx pgx.Tx, orderID int64, items []StockLine) (err error) {
	ctx, endSpan := tracing.Start(ctx, "inventory.DeductForOrder", tracing.Int64("order.id", orderID))
	defer func() {
		if err != nil {
			metrics.IncInventoryOp(metrics.InventoryOpDeduct, metrics.ResultError)
		} else {
			metrics.IncInventoryOp(metrics.InventoryOpDeduct, metrics.ResultOK)
		}
		endSpan(err)
	}()

	for _, item := range items {
		if err = s.inventoryRepo.Deduct(ctx, tx, item.VariantID, item.Quantity, orderID); err != nil {
			return fmt.Errorf("inventoryService.DeductForOrderTx variant %d: %w", item.VariantID, err)
		}
	}
	return nil
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// isBusinessError returns true for sentinel errors the handler layer needs to
// distinguish — these should not be wrapped with additional context.
func isBusinessError(err error) bool {
	switch err {
	case models.ErrInsufficientStock,
		models.ErrNotFound,
		models.ErrInvalidState:
		return true
	}
	return false
}

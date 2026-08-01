// internal/services/inventory_service.go
package services

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/utils"
)

type InventoryService interface {
	// Admin operations
	GetByVariantID(ctx context.Context, variantID int64) (*models.Inventory, error)
	GetAll(ctx context.Context, filter models.InventoryFilter) ([]*models.Inventory, int64, error)
	GetLowStock(ctx context.Context) ([]*models.Inventory, error)
	GetMovements(ctx context.Context, filter models.MovementFilter) ([]*models.InventoryMovement, int64, error)
	GetMovementsByVariant(ctx context.Context, variantID int64) ([]*models.InventoryMovement, error)
	AdjustStock(ctx context.Context, variantID int64, req models.AdjustStockReq, orderID *int64) error
	UpdateReorder(ctx context.Context, variantID int64, req models.UpdateReorderReq) (*models.Inventory, error)

	// Order lifecycle — called by OrderService
	ReserveForOrder(ctx context.Context, orderID int64, items []models.OrderItemResponse) error
	// ReserveForOrderTx reserves stock on a caller-supplied transaction, so order
	// creation and stock reservation commit atomically (no oversell window, no
	// dangling pending order on crash).
	ReserveForOrderTx(ctx context.Context, tx pgx.Tx, orderID int64, items []models.OrderItemResponse) error
	ReleaseForOrder(ctx context.Context, orderID int64, items []models.OrderItemResponse) error
	DeductForOrder(ctx context.Context, orderID int64, items []models.OrderItemResponse) error
	// DeductForOrderTx drains committed stock on a caller-supplied transaction, so
	// confirming a payment and deducting stock commit atomically.
	DeductForOrderTx(ctx context.Context, tx pgx.Tx, orderID int64, items []models.OrderItemResponse) error
}

type inventoryService struct {
	inventoryRepo repositories.InventoryRepository
	movementRepo  repositories.MovementRepository
}

func NewInventoryService(
	inventoryRepo repositories.InventoryRepository,
	movementRepo repositories.MovementRepository,
) InventoryService {
	return &inventoryService{
		inventoryRepo: inventoryRepo,
		movementRepo:  movementRepo,
	}
}

// ── Admin reads ───────────────────────────────────────────────────────────────

func (s *inventoryService) GetByVariantID(ctx context.Context, variantID int64) (*models.Inventory, error) {
	inv, err := s.inventoryRepo.GetByVariantID(ctx, variantID)
	if err != nil {
		return nil, fmt.Errorf("inventoryService.GetByVariantID: %w", err)
	}
	return inv, nil
}

func (s *inventoryService) GetAll(ctx context.Context, filter models.InventoryFilter) ([]*models.Inventory, int64, error) {
	items, total, err := s.inventoryRepo.GetAll(ctx, filter)
	if err != nil {
		return nil, 0, fmt.Errorf("inventoryService.GetAll: %w", err)
	}
	return items, total, nil
}

func (s *inventoryService) GetLowStock(ctx context.Context) ([]*models.Inventory, error) {
	items, err := s.inventoryRepo.GetLowStock(ctx)
	if err != nil {
		return nil, fmt.Errorf("inventoryService.GetLowStock: %w", err)
	}
	return items, nil
}

func (s *inventoryService) GetMovements(ctx context.Context, filter models.MovementFilter) ([]*models.InventoryMovement, int64, error) {
	movements, total, err := s.movementRepo.GetAll(ctx, filter)
	if err != nil {
		return nil, 0, fmt.Errorf("inventoryService.GetMovements: %w", err)
	}
	return movements, total, nil
}

func (s *inventoryService) GetMovementsByVariant(ctx context.Context, variantID int64) ([]*models.InventoryMovement, error) {
	if _, err := s.inventoryRepo.GetByVariantID(ctx, variantID); err != nil {
		return nil, fmt.Errorf("inventoryService.GetMovementsByVariant inventory: %w", err)
	}
	movements, err := s.movementRepo.GetByVariantID(ctx, variantID)
	if err != nil {
		return nil, fmt.Errorf("inventoryService.GetMovementsByVariant: %w", err)
	}
	return movements, nil
}

// ── Admin writes ──────────────────────────────────────────────────────────────

func (s *inventoryService) AdjustStock(ctx context.Context, variantID int64, req models.AdjustStockReq, orderID *int64) error {
	if !validInventoryAdjustment(req) {
		return fmt.Errorf("inventoryService.AdjustStock: %w", models.ErrInvalidInventoryAdjustment)
	}
	tx, err := s.inventoryRepo.BeginTx(ctx)
	if err != nil {
		return fmt.Errorf("inventoryService.AdjustStock: begin tx: %w", err)
	}
	defer utils.RollbackOnErr(ctx, tx, &err)

	if err = s.inventoryRepo.Adjust(ctx, tx, variantID, req, orderID); err != nil {
		return fmt.Errorf("inventoryService.AdjustStock: %w", err)
	}

	if err = tx.Commit(ctx); err != nil {
		return fmt.Errorf("inventoryService.AdjustStock: commit: %w", err)
	}
	return nil
}

func validInventoryAdjustment(req models.AdjustStockReq) bool {
	switch req.Type {
	case models.MovementTypeAdjustment:
		return req.Quantity != 0
	case models.MovementTypeRestock, models.MovementTypeRefund:
		return req.Quantity > 0
	case models.MovementTypePurchase, models.MovementTypeDamage:
		return req.Quantity < 0
	default:
		return false
	}
}

func (s *inventoryService) UpdateReorder(ctx context.Context, variantID int64, req models.UpdateReorderReq) (*models.Inventory, error) {
	inv, err := s.inventoryRepo.UpdateReorder(ctx, variantID, req)
	if err != nil {
		return nil, fmt.Errorf("inventoryService.UpdateReorder: %w", err)
	}
	return inv, nil
}

// ── Order lifecycle ───────────────────────────────────────────────────────────

// ReserveForOrder moves stock from available → committed for every item in the
// order. The entire batch is atomic — if any variant has insufficient stock the
// transaction rolls back and no inventory is touched.
func (s *inventoryService) ReserveForOrder(ctx context.Context, orderID int64, items []models.OrderItemResponse) (err error) {
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
func (s *inventoryService) ReserveForOrderTx(ctx context.Context, tx pgx.Tx, orderID int64, items []models.OrderItemResponse) error {
	for _, item := range items {
		if err := s.inventoryRepo.Reserve(ctx, tx, item.VariantID, item.Quantity, orderID); err != nil {
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
func (s *inventoryService) ReleaseForOrder(ctx context.Context, orderID int64, items []models.OrderItemResponse) error {
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
func (s *inventoryService) DeductForOrder(ctx context.Context, orderID int64, items []models.OrderItemResponse) (err error) {
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
func (s *inventoryService) DeductForOrderTx(ctx context.Context, tx pgx.Tx, orderID int64, items []models.OrderItemResponse) error {
	for _, item := range items {
		if err := s.inventoryRepo.Deduct(ctx, tx, item.VariantID, item.Quantity, orderID); err != nil {
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

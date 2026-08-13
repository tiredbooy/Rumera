package cart

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/tiredbooy/internal/features/catalog/variant"
	"github.com/tiredbooy/internal/features/inventory"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

// Service manages a user's shopping cart. It snapshots the variant price at
// add-time so the basket total is stable even if catalogue prices change later
// (the cart read surfaces price drift via the `price_changed` flag).
type Service struct {
	cartRepo      Repository
	variantRepo   VariantLookup
	inventoryRepo inventory.Repository
	db            pgxBeginner
}

// VariantLookup is the catalog surface cart needs (implemented by catalog/variant.Repository).
type VariantLookup interface {
	GetByID(ctx context.Context, id int64) (*variant.ProductVariant, error)
}

// pgxBeginner opens transactions without depending on *pgxpool.Pool.
type pgxBeginner interface {
	Begin(ctx context.Context) (pgx.Tx, error)
}

func NewService(
	cartRepo Repository,
	variantRepo VariantLookup,
	inventoryRepo inventory.Repository,
	db pgxBeginner,
) *Service {
	return &Service{
		cartRepo:      cartRepo,
		variantRepo:   variantRepo,
		inventoryRepo: inventoryRepo,
		db:            db,
	}
}

// Get returns the user's cart with hydrated items and a computed summary,
// creating an empty cart on first access.
func (s *Service) Get(ctx context.Context, userID int64) (*CartResponse, error) {
	cart, err := s.cartRepo.GetOrCreate(ctx, userID)
	if err != nil {
		return nil, apperr.ErrInternal
	}

	items, err := s.cartRepo.GetItems(ctx, cart.ID)
	if err != nil {
		return nil, apperr.ErrInternal
	}

	return buildCartResponse(cart.ID, items), nil
}

// AddItem adds a variant to the cart (or bumps its quantity), snapshotting the
// current variant price. Adding an inactive/unknown variant is rejected.
func (s *Service) AddItem(ctx context.Context, userID int64, req AddCartItemReq) (*CartResponse, error) {
	if req.ProductVariantID <= 0 || req.Quantity <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	variant, err := s.variantRepo.GetByID(ctx, req.ProductVariantID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrProductNotFound
		}
		return nil, apperr.ErrInternal
	}
	if !variant.IsActive {
		return nil, apperr.ErrProductUnavailable
	}
	cart, err := s.cartRepo.GetOrCreate(ctx, userID)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	items, err := s.cartRepo.GetItems(ctx, cart.ID)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	totalQuantity := req.Quantity
	for _, item := range items {
		if item.VariantID == req.ProductVariantID {
			totalQuantity += item.Quantity
			break
		}
	}
	if err := s.ensureAvailable(ctx, req.ProductVariantID, totalQuantity); err != nil {
		return nil, err
	}

	// Price is set server-side from the live variant — never trusted from input.
	req.UnitPriceSnapshot = variant.Price
	if _, err := s.cartRepo.AddItem(ctx, cart.ID, req); err != nil {
		if errors.Is(err, models.ErrInsufficientStock) {
			return nil, apperr.ErrOutOfStock
		}
		return nil, apperr.ErrInternal
	}

	return s.reload(ctx, cart.ID)
}

// AddItems adds several variants in one call (e.g. all the products for a
// recipe). Each variant is validated independently: unknown or inactive variants
// are recorded in the skip list rather than failing the whole request, so the
// user still gets everything that *could* be added.
func (s *Service) AddItems(ctx context.Context, userID int64, req AddCartItemsReq) (*BulkAddResult, error) {
	if len(req.Items) == 0 {
		return nil, apperr.ErrInvalidRequest
	}

	cart, err := s.cartRepo.GetOrCreate(ctx, userID)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	existingItems, err := s.cartRepo.GetItems(ctx, cart.ID)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	quantities := make(map[int64]int, len(existingItems))
	for _, existing := range existingItems {
		quantities[existing.VariantID] = existing.Quantity
	}

	skipped := make([]SkippedCartItem, 0)
	added := 0
	for _, item := range req.Items {
		if item.ProductVariantID <= 0 || item.Quantity <= 0 {
			skipped = append(skipped, SkippedCartItem{ProductVariantID: item.ProductVariantID, Reason: "invalid"})
			continue
		}

		variant, err := s.variantRepo.GetByID(ctx, item.ProductVariantID)
		if err != nil {
			if errors.Is(err, models.ErrNotFound) {
				skipped = append(skipped, SkippedCartItem{ProductVariantID: item.ProductVariantID, Reason: "not_found"})
				continue
			}
			return nil, apperr.ErrInternal
		}
		if !variant.IsActive {
			skipped = append(skipped, SkippedCartItem{ProductVariantID: item.ProductVariantID, Reason: "unavailable"})
			continue
		}
		totalQuantity := quantities[item.ProductVariantID] + item.Quantity
		if err := s.ensureAvailable(ctx, item.ProductVariantID, totalQuantity); err != nil {
			if errors.Is(err, apperr.ErrOutOfStock) {
				skipped = append(skipped, SkippedCartItem{ProductVariantID: item.ProductVariantID, Reason: "out_of_stock"})
				continue
			}
			return nil, err
		}
		quantities[item.ProductVariantID] = totalQuantity

		// Price is set server-side from the live variant — never trusted from input.
		item.UnitPriceSnapshot = variant.Price
		if _, err := s.cartRepo.AddItem(ctx, cart.ID, item); err != nil {
			if errors.Is(err, models.ErrInsufficientStock) {
				skipped = append(skipped, SkippedCartItem{ProductVariantID: item.ProductVariantID, Reason: "out_of_stock"})
				continue
			}
			return nil, apperr.ErrInternal
		}
		added++
	}

	cartResp, err := s.reload(ctx, cart.ID)
	if err != nil {
		return nil, err
	}
	return &BulkAddResult{Cart: cartResp, Added: added, Skipped: skipped}, nil
}

func (s *Service) ensureAvailable(ctx context.Context, variantID int64, quantity int) error {
	inventory, err := s.inventoryRepo.GetByVariantID(ctx, variantID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrOutOfStock
		}
		return apperr.ErrInternal
	}
	if inventory.StockOnHand-inventory.CommittedStock < quantity {
		return apperr.ErrOutOfStock
	}
	return nil
}

// UpdateItem sets the quantity of an existing cart line.
func (s *Service) UpdateItem(ctx context.Context, userID, itemID int64, req UpdateCartItemReq) (*CartResponse, error) {
	if itemID <= 0 || req.Quantity <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	cart, err := s.cartRepo.GetOrCreate(ctx, userID)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	items, err := s.cartRepo.GetItems(ctx, cart.ID)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	var variantID int64
	for _, item := range items {
		if item.ID == itemID {
			variantID = item.VariantID
			break
		}
	}
	if variantID == 0 {
		return nil, apperr.ErrNotFound
	}
	if err := s.ensureAvailable(ctx, variantID, req.Quantity); err != nil {
		return nil, err
	}

	if _, err := s.cartRepo.UpdateItem(ctx, cart.ID, itemID, req); err != nil {
		if errors.Is(err, models.ErrInsufficientStock) {
			return nil, apperr.ErrOutOfStock
		}
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}

	return s.reload(ctx, cart.ID)
}

// RemoveItem deletes a single cart line.
func (s *Service) RemoveItem(ctx context.Context, userID, itemID int64) (*CartResponse, error) {
	if itemID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	cart, err := s.cartRepo.GetOrCreate(ctx, userID)
	if err != nil {
		return nil, apperr.ErrInternal
	}

	if err := s.cartRepo.RemoveItem(ctx, cart.ID, itemID); err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}

	return s.reload(ctx, cart.ID)
}

// Clear empties the cart of all items.
func (s *Service) Clear(ctx context.Context, userID int64) error {
	cart, err := s.cartRepo.GetOrCreate(ctx, userID)
	if err != nil {
		return apperr.ErrInternal
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return apperr.ErrInternal
	}
	defer tx.Rollback(ctx)

	if err := s.cartRepo.Clear(ctx, tx, cart.ID); err != nil {
		return apperr.ErrInternal
	}
	if err := tx.Commit(ctx); err != nil {
		return apperr.ErrInternal
	}
	return nil
}

func (s *Service) reload(ctx context.Context, cartID int64) (*CartResponse, error) {
	items, err := s.cartRepo.GetItems(ctx, cartID)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	return buildCartResponse(cartID, items), nil
}

// buildCartResponse assembles the response envelope and its summary totals.
func buildCartResponse(cartID int64, items []CartItemResponse) *CartResponse {
	if items == nil {
		items = []CartItemResponse{}
	}

	var totalItems int
	var subtotal float64
	for _, it := range items {
		totalItems += it.Quantity
		subtotal += it.LineTotal
	}

	return &CartResponse{
		ID:    cartID,
		Items: items,
		Summary: CartSummary{
			TotalItems:  totalItems,
			UniqueItems: len(items),
			Subtotal:    subtotal,
		},
	}
}

package services

import (
	"context"
	"errors"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
)

// CartService manages a user's shopping cart. It snapshots the variant price at
// add-time so the basket total is stable even if catalogue prices change later
// (the cart read surfaces price drift via the `price_changed` flag).
type CartService struct {
	cartRepo    repositories.CartRepository
	variantRepo repositories.VariantRepository
	db          pgxBeginner
}

func NewCartService(
	cartRepo repositories.CartRepository,
	variantRepo repositories.VariantRepository,
	db pgxBeginner,
) *CartService {
	return &CartService{cartRepo: cartRepo, variantRepo: variantRepo, db: db}
}

// Get returns the user's cart with hydrated items and a computed summary,
// creating an empty cart on first access.
func (s *CartService) Get(ctx context.Context, userID int64) (*models.CartResponse, error) {
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
func (s *CartService) AddItem(ctx context.Context, userID int64, req models.AddCartItemReq) (*models.CartResponse, error) {
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

	// Price is set server-side from the live variant — never trusted from input.
	req.UnitPriceSnapshot = variant.Price
	if _, err := s.cartRepo.AddItem(ctx, cart.ID, req); err != nil {
		return nil, apperr.ErrInternal
	}

	return s.reload(ctx, cart.ID)
}

// AddItems adds several variants in one call (e.g. all the products for a
// recipe). Each variant is validated independently: unknown or inactive variants
// are recorded in the skip list rather than failing the whole request, so the
// user still gets everything that *could* be added.
func (s *CartService) AddItems(ctx context.Context, userID int64, req models.AddCartItemsReq) (*models.BulkAddResult, error) {
	if len(req.Items) == 0 {
		return nil, apperr.ErrInvalidRequest
	}

	cart, err := s.cartRepo.GetOrCreate(ctx, userID)
	if err != nil {
		return nil, apperr.ErrInternal
	}

	skipped := make([]models.SkippedCartItem, 0)
	added := 0
	for _, item := range req.Items {
		if item.ProductVariantID <= 0 || item.Quantity <= 0 {
			skipped = append(skipped, models.SkippedCartItem{ProductVariantID: item.ProductVariantID, Reason: "invalid"})
			continue
		}

		variant, err := s.variantRepo.GetByID(ctx, item.ProductVariantID)
		if err != nil {
			if errors.Is(err, models.ErrNotFound) {
				skipped = append(skipped, models.SkippedCartItem{ProductVariantID: item.ProductVariantID, Reason: "not_found"})
				continue
			}
			return nil, apperr.ErrInternal
		}
		if !variant.IsActive {
			skipped = append(skipped, models.SkippedCartItem{ProductVariantID: item.ProductVariantID, Reason: "unavailable"})
			continue
		}

		// Price is set server-side from the live variant — never trusted from input.
		item.UnitPriceSnapshot = variant.Price
		if _, err := s.cartRepo.AddItem(ctx, cart.ID, item); err != nil {
			return nil, apperr.ErrInternal
		}
		added++
	}

	cartResp, err := s.reload(ctx, cart.ID)
	if err != nil {
		return nil, err
	}
	return &models.BulkAddResult{Cart: cartResp, Added: added, Skipped: skipped}, nil
}

// UpdateItem sets the quantity of an existing cart line.
func (s *CartService) UpdateItem(ctx context.Context, userID, itemID int64, req models.UpdateCartItemReq) (*models.CartResponse, error) {
	if itemID <= 0 || req.Quantity <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	cart, err := s.cartRepo.GetOrCreate(ctx, userID)
	if err != nil {
		return nil, apperr.ErrInternal
	}

	if _, err := s.cartRepo.UpdateItem(ctx, cart.ID, itemID, req); err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}

	return s.reload(ctx, cart.ID)
}

// RemoveItem deletes a single cart line.
func (s *CartService) RemoveItem(ctx context.Context, userID, itemID int64) (*models.CartResponse, error) {
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
func (s *CartService) Clear(ctx context.Context, userID int64) error {
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

func (s *CartService) reload(ctx context.Context, cartID int64) (*models.CartResponse, error) {
	items, err := s.cartRepo.GetItems(ctx, cartID)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	return buildCartResponse(cartID, items), nil
}

// buildCartResponse assembles the response envelope and its summary totals.
func buildCartResponse(cartID int64, items []models.CartItemResponse) *models.CartResponse {
	if items == nil {
		items = []models.CartItemResponse{}
	}

	var totalItems int
	var subtotal float64
	for _, it := range items {
		totalItems += it.Quantity
		subtotal += it.LineTotal
	}

	return &models.CartResponse{
		ID:    cartID,
		Items: items,
		Summary: models.CartSummary{
			TotalItems:  totalItems,
			UniqueItems: len(items),
			Subtotal:    subtotal,
		},
	}
}

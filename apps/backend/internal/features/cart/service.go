package cart

import (
	"context"
	"errors"
	"log/slog"

	"github.com/jackc/pgx/v5"

	"github.com/tiredbooy/internal/features/catalog/product"
	"github.com/tiredbooy/internal/features/catalog/variant"
	"github.com/tiredbooy/internal/features/inventory"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

// internal logs an unexpected repo/infra cause and returns the public 500
// sentinel. The SQL text is not wrapped so the client envelope stays INTERNAL_ERROR.
func internal(op string, err error) error {
	slog.Error("cart", "op", op, "err", err)
	return apperr.ErrInternal
}

// Service manages a user's shopping cart. It snapshots the variant price at
// add-time so the basket total is stable even if catalogue prices change later
// (the cart read surfaces price drift via the `price_changed` flag).
type Service struct {
	cartRepo      Repository
	variantRepo   VariantLookup
	productRepo   ProductLookup
	inventoryRepo inventory.Repository
	db            pgxBeginner
	recs          InteractionRecorder
}

// VariantLookup is the catalog surface cart needs (implemented by catalog/variant.Repository).
type VariantLookup interface {
	GetByID(ctx context.Context, id int64) (*variant.ProductVariant, error)
}

// ProductLookup is the parent-product surface cart needs. GetByIDForAdmin
// includes inactive rows so we can tell missing from unpublished.
type ProductLookup interface {
	GetByIDForAdmin(ctx context.Context, id int64) (*product.Product, error)
}

// pgxBeginner opens transactions without depending on *pgxpool.Pool.
type pgxBeginner interface {
	Begin(ctx context.Context) (pgx.Tx, error)
}

// InteractionRecorder writes an add_to_cart recs signal. Optional.
type InteractionRecorder interface {
	RecordAddToCart(ctx context.Context, userID, productID int64) error
}

func NewService(
	cartRepo Repository,
	variantRepo VariantLookup,
	productRepo ProductLookup,
	inventoryRepo inventory.Repository,
	db pgxBeginner,
) *Service {
	return &Service{
		cartRepo:      cartRepo,
		variantRepo:   variantRepo,
		productRepo:   productRepo,
		inventoryRepo: inventoryRepo,
		db:            db,
	}
}

// WithInteractions attaches the add_to_cart recs hook (PR-050d).
func (s *Service) WithInteractions(r InteractionRecorder) *Service {
	if s != nil {
		s.recs = r
	}
	return s
}

// Get returns the user's cart with hydrated items and a computed summary,
// creating an empty cart on first access.
func (s *Service) Get(ctx context.Context, userID int64) (*CartResponse, error) {
	cart, err := s.cartRepo.GetOrCreate(ctx, userID)
	if err != nil {
		return nil, internal("Get.GetOrCreate", err)
	}

	items, err := s.cartRepo.GetItems(ctx, cart.ID)
	if err != nil {
		return nil, internal("Get.GetItems", err)
	}

	return buildCartResponse(cart.ID, items), nil
}

// AddItem adds a variant to the cart (or bumps its quantity), snapshotting the
// current variant price. Adding an inactive/unknown variant, or an active
// variant whose parent product is inactive, is rejected.
func (s *Service) AddItem(ctx context.Context, userID int64, req AddCartItemReq) (*CartResponse, error) {
	if req.ProductVariantID <= 0 || req.Quantity <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	variant, err := s.variantRepo.GetByID(ctx, req.ProductVariantID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrProductNotFound
		}
		return nil, internal("AddItem.GetByID", err)
	}
	if !variant.IsActive {
		return nil, apperr.ErrProductUnavailable
	}
	if err := s.ensureParentActive(ctx, variant.ProductID); err != nil {
		return nil, err
	}
	cart, err := s.cartRepo.GetOrCreate(ctx, userID)
	if err != nil {
		return nil, internal("AddItem.GetOrCreate", err)
	}
	items, err := s.cartRepo.GetItems(ctx, cart.ID)
	if err != nil {
		return nil, internal("AddItem.GetItems", err)
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
		return nil, internal("AddItem.AddItem", err)
	}

	s.recordAddToCart(ctx, userID, variant.ProductID)
	return s.reload(ctx, cart.ID)
}

// AddItems adds several variants in one call (e.g. all the products for a
// recipe). Each variant is validated independently: unknown or inactive variants
// (and variants whose parent product is inactive) are recorded in the skip list
// rather than failing the whole request, so the user still gets everything that
// *could* be added.
func (s *Service) AddItems(ctx context.Context, userID int64, req AddCartItemsReq) (*BulkAddResult, error) {
	if len(req.Items) == 0 {
		return nil, apperr.ErrInvalidRequest
	}

	cart, err := s.cartRepo.GetOrCreate(ctx, userID)
	if err != nil {
		return nil, internal("AddItems.GetOrCreate", err)
	}
	existingItems, err := s.cartRepo.GetItems(ctx, cart.ID)
	if err != nil {
		return nil, internal("AddItems.GetItems", err)
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
			return nil, internal("AddItems.GetByID", err)
		}
		if !variant.IsActive {
			skipped = append(skipped, SkippedCartItem{ProductVariantID: item.ProductVariantID, Reason: "unavailable"})
			continue
		}
		if err := s.ensureParentActive(ctx, variant.ProductID); err != nil {
			if errors.Is(err, apperr.ErrProductNotFound) {
				skipped = append(skipped, SkippedCartItem{ProductVariantID: item.ProductVariantID, Reason: "not_found"})
				continue
			}
			if errors.Is(err, apperr.ErrProductUnavailable) {
				skipped = append(skipped, SkippedCartItem{ProductVariantID: item.ProductVariantID, Reason: "unavailable"})
				continue
			}
			return nil, err
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
			return nil, internal("AddItems.AddItem", err)
		}
		added++
		s.recordAddToCart(ctx, userID, variant.ProductID)
	}

	cartResp, err := s.reload(ctx, cart.ID)
	if err != nil {
		return nil, err
	}
	return &BulkAddResult{Cart: cartResp, Added: added, Skipped: skipped}, nil
}

// ensureParentActive rejects a missing parent as not-found and an inactive
// parent as unavailable, so a line cannot insert then vanish on GetItems.
func (s *Service) ensureParentActive(ctx context.Context, productID int64) error {
	parent, err := s.productRepo.GetByIDForAdmin(ctx, productID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrProductNotFound
		}
		return internal("ensureParentActive.GetByIDForAdmin", err)
	}
	if !parent.IsActive {
		return apperr.ErrProductUnavailable
	}
	return nil
}

func (s *Service) ensureAvailable(ctx context.Context, variantID int64, quantity int) error {
	inventory, err := s.inventoryRepo.GetByVariantID(ctx, variantID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrOutOfStock
		}
		return internal("ensureAvailable.GetByVariantID", err)
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
		return nil, internal("UpdateItem.GetOrCreate", err)
	}
	items, err := s.cartRepo.GetItems(ctx, cart.ID)
	if err != nil {
		return nil, internal("UpdateItem.GetItems", err)
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
		return nil, internal("UpdateItem.UpdateItem", err)
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
		return nil, internal("RemoveItem.GetOrCreate", err)
	}

	if err := s.cartRepo.RemoveItem(ctx, cart.ID, itemID); err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, internal("RemoveItem.RemoveItem", err)
	}

	return s.reload(ctx, cart.ID)
}

// Clear empties the cart of all items.
func (s *Service) Clear(ctx context.Context, userID int64) error {
	cart, err := s.cartRepo.GetOrCreate(ctx, userID)
	if err != nil {
		return internal("Clear.GetOrCreate", err)
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return internal("Clear.Begin", err)
	}
	defer tx.Rollback(ctx)

	if err := s.cartRepo.Clear(ctx, tx, cart.ID); err != nil {
		return internal("Clear.Clear", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return internal("Clear.Commit", err)
	}
	return nil
}

func (s *Service) recordAddToCart(ctx context.Context, userID, productID int64) {
	if s == nil || s.recs == nil || userID <= 0 || productID <= 0 {
		return
	}
	if err := s.recs.RecordAddToCart(ctx, userID, productID); err != nil {
		slog.Error("cart: record add_to_cart",
			"user_id", userID, "product_id", productID, "err", err)
	}
}

func (s *Service) reload(ctx context.Context, cartID int64) (*CartResponse, error) {
	items, err := s.cartRepo.GetItems(ctx, cartID)
	if err != nil {
		return nil, internal("reload.GetItems", err)
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

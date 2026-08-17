package coupons

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/features/cart"
	"github.com/tiredbooy/pkg/validator"
)

// New wires repositories → service → HTTP handler.
// Repository and UsageRepository are returned for order checkout.
//
// CartBasketLookup is attached here from cart.NewRepository(db) so
// POST /coupons/validate can fill omitted product/category IDs and
// subtotal from the caller's cart. container.go is not touched (PR-020a);
// a coordinator may later swap this for the shared cartRepo via WithCart.
func New(db *pgxpool.Pool, v *validator.Validator) (h *Handler, repo Repository, usage UsageRepository) {
	repo = NewRepository(db)
	usage = NewUsageRepository(db)
	svc := NewService(repo).WithCart(NewCartBasketLookup(cart.NewRepository(db)))
	h = NewHandler(svc, v)
	return h, repo, usage
}

// cartRepoBasketLookup implements CartBasketLookup via cart.Repository
// GetOrCreate + GetItems. CartItemResponse already carries ProductID,
// CategoryID, and LineTotal.
type cartRepoBasketLookup struct {
	repo cart.Repository
}

// NewCartBasketLookup adapts cart.Repository. A nil repo yields a nil lookup.
func NewCartBasketLookup(repo cart.Repository) CartBasketLookup {
	if repo == nil {
		return nil
	}
	return cartRepoBasketLookup{repo: repo}
}

func (l cartRepoBasketLookup) BasketForUser(ctx context.Context, userID int64) ([]CartBasketItem, error) {
	c, err := l.repo.GetOrCreate(ctx, userID)
	if err != nil {
		return nil, err
	}
	items, err := l.repo.GetItems(ctx, c.ID)
	if err != nil {
		return nil, err
	}
	out := make([]CartBasketItem, 0, len(items))
	for _, it := range items {
		out = append(out, CartBasketItem{
			ProductID:  it.ProductID,
			CategoryID: it.CategoryID,
			LineTotal:  it.LineTotal,
		})
	}
	return out, nil
}

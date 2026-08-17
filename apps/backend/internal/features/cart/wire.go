package cart

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/features/inventory"
	"github.com/tiredbooy/internal/features/recommendations"
	"github.com/tiredbooy/pkg/validator"
)

// New wires repository → service → HTTP handler.
// Repository is returned for order checkout cart reads.
func New(
	db *pgxpool.Pool,
	variants VariantLookup,
	products ProductLookup,
	invRepo inventory.Repository,
	v *validator.Validator,
) (h *Handler, repo Repository) {
	repo = NewRepository(db)
	recs := recommendations.NewService(recommendations.NewRepository(db), nil)
	svc := NewService(repo, variants, products, invRepo, db).WithInteractions(cartRecs{svc: recs})
	h = NewHandler(svc, v)
	return h, repo
}

type cartRecs struct{ svc recommendations.Service }

func (a cartRecs) RecordAddToCart(ctx context.Context, userID, productID int64) error {
	if a.svc == nil {
		return nil
	}
	src := "cart.add_item"
	return a.svc.RecordInteraction(ctx, userID, &recommendations.InteractionReq{
		ProductID:       productID,
		InteractionType: recommendations.InteractionAddToCart,
		Source:          &src,
	})
}

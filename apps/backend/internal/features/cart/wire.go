package cart

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/features/inventory"
	"github.com/tiredbooy/pkg/validator"
)

// New wires repository → service → HTTP handler.
// Repository is returned for order checkout cart reads.
func New(
	db *pgxpool.Pool,
	variants VariantLookup,
	invRepo inventory.Repository,
	v *validator.Validator,
) (h *Handler, repo Repository) {
	repo = NewRepository(db)
	svc := NewService(repo, variants, invRepo, db)
	h = NewHandler(svc, v)
	return h, repo
}

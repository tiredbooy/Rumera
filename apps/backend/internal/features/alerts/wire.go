package alerts

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/features/catalog/variant"
	"github.com/tiredbooy/internal/features/inventory"
	"github.com/tiredbooy/pkg/validator"
)

// New wires repository → service → HTTP handler.
// Repository is returned for the alert-check cron job.
func New(
	db *pgxpool.Pool,
	variants variant.Repository,
	invRepo inventory.Repository,
	v *validator.Validator,
) (h *Handler, repo Repository) {
	repo = NewRepository(db)
	h = NewHandler(NewService(repo, variants, invRepo), v)
	return h, repo
}

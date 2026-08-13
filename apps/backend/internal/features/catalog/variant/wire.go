package variant

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/features/inventory"
	"github.com/tiredbooy/internal/features/media"
	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/validator"
)

// New wires repository → service → HTTP handler for product variants.
// Repository is returned for cart, alerts, and other catalog consumers.
func New(
	db *pgxpool.Pool,
	invRepo inventory.Repository,
	lifecycle *media.LifecycleService,
	v *validator.Validator,
	store cache.Store,
) (h *Handler, repo Repository) {
	repo = NewRepository(db)
	h = NewHandler(NewService(repo, invRepo, lifecycle), v, store)
	return h, repo
}

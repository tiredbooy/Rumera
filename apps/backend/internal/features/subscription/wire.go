package subscription

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/features/addresses"
	"github.com/tiredbooy/pkg/validator"
)

// New wires repository → service → HTTP handler.
// Repository is returned for the subscription-renewal cron job.
// Address ownership uses a local addresses repo/service from db (not container).
func New(db *pgxpool.Pool, v *validator.Validator) (h *Handler, repo Repository) {
	repo = NewRepository(db)
	addrs := addresses.NewService(addresses.NewRepository(db))
	h = NewHandler(NewService(repo, addrs), v)
	return h, repo
}

package subscription

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/pkg/validator"
)

// New wires repository → service → HTTP handler.
// Repository is returned for the subscription-renewal cron job.
func New(db *pgxpool.Pool, v *validator.Validator) (h *Handler, repo Repository) {
	repo = NewRepository(db)
	h = NewHandler(NewService(repo), v)
	return h, repo
}

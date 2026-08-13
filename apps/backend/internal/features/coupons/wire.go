package coupons

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/pkg/validator"
)

// New wires repositories → service → HTTP handler.
// Repository and UsageRepository are returned for order checkout.
func New(db *pgxpool.Pool, v *validator.Validator) (h *Handler, repo Repository, usage UsageRepository) {
	repo = NewRepository(db)
	usage = NewUsageRepository(db)
	h = NewHandler(NewService(repo), v)
	return h, repo, usage
}

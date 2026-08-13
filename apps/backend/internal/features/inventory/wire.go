package inventory

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/pkg/validator"
)

// New wires repositories → service → HTTP handler.
// Service and Repository are returned for payments, orders, cart, alerts, and variants.
func New(db *pgxpool.Pool, v *validator.Validator) (h *Handler, svc Service, repo Repository) {
	repo = NewRepository(db)
	svc = NewService(repo, NewMovementRepository(db))
	h = NewHandler(svc, v)
	return h, svc, repo
}

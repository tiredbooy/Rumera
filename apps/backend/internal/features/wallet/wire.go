package wallet

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/features/users"
	"github.com/tiredbooy/pkg/validator"
)

// New wires repository → service → HTTP handler.
// Service is returned for loyalty redemptions and gift-card credits.
func New(db *pgxpool.Pool, usersSvc *users.Service, v *validator.Validator) (h *Handler, svc *Service) {
	svc = NewService(NewRepository(db))
	h = NewHandler(svc, usersSvc, v)
	return h, svc
}

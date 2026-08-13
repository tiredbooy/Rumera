package shipping

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/pkg/validator"
)

// New wires zone/method repositories → service → HTTP handler.
// Service is returned for checkout shipping authorization in orders.
func New(db *pgxpool.Pool, v *validator.Validator) (h *Handler, svc *Service) {
	svc = NewService(NewZoneRepository(db), NewMethodRepository(db))
	h = NewHandler(svc, v)
	return h, svc
}

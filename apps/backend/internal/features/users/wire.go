package users

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/pkg/validator"
)

// New wires repository → service → HTTP handler.
// Service is returned for middleware (Auth) and cross-feature use.
func New(db *pgxpool.Pool, v *validator.Validator) (h *Handler, svc *Service) {
	svc = NewService(NewRepository(db))
	h = NewHandler(svc, v)
	return h, svc
}

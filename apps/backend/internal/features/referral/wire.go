package referral

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/features/loyalty"
	"github.com/tiredbooy/pkg/validator"
)

// New wires repository → service → HTTP handler.
// Service is returned for payment confirmation referral completion.
func New(db *pgxpool.Pool, loyaltySvc *loyalty.Service, reward int, v *validator.Validator) (h *Handler, svc *Service) {
	var awarder PointAwarder
	if loyaltySvc != nil {
		awarder = loyaltySvc
	}
	svc = NewService(NewRepository(db), awarder, reward)
	h = NewHandler(svc, v)
	return h, svc
}

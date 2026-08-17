package recommendations

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/features/taste"
	"github.com/tiredbooy/pkg/validator"
)

// New wires repository → service → HTTP handler.
// Service is returned for the recommendation-refresh cron job.
// Taste is constructed here from db so bootstrap does not need a new dep.
func New(db *pgxpool.Pool, v *validator.Validator) (h *Handler, svc Service) {
	svc = NewService(NewRepository(db), taste.NewService(taste.NewRepository(db)))
	h = NewHandler(svc, v)
	return h, svc
}

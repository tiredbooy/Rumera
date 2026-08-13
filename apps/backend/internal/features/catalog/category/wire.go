package category

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/features/media"
	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/validator"
	"go.uber.org/zap"
)

// New wires repository → service → HTTP handler for categories.
func New(
	db *pgxpool.Pool,
	lifecycle *media.LifecycleService,
	v *validator.Validator,
	store cache.Store,
	log *zap.Logger,
) *Handler {
	return NewHandler(NewService(NewRepository(db), lifecycle), v, store, log)
}

package recipes

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/validator"
	"go.uber.org/zap"
)

// New wires repository → service → HTTP handler for recipes.
func New(db *pgxpool.Pool, media MediaCleaner, v *validator.Validator, store cache.Store, log *zap.Logger) *Handler {
	return NewHandler(NewService(NewRepository(db), db, media), v, store, log)
}

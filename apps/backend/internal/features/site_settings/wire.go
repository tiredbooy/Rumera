package site_settings

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/validator"
	"go.uber.org/zap"
)

// New wires repository → service → HTTP handler for site settings.
// Returns the service so commerce features (orders gift options) can read config.
func New(db *pgxpool.Pool, v *validator.Validator, store cache.Store, log *zap.Logger) (*Handler, Service) {
	svc := NewService(NewRepository(db))
	return NewHandler(svc, v, store, log), svc
}

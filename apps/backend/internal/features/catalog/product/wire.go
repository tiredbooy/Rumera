package product

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/features/media"
	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/validator"
	"go.uber.org/zap"
)

// NewRepos constructs the product repositories needed by media before the
// product HTTP stack is fully wired.
func NewRepos(db *pgxpool.Pool) (repo Repository, images ImageRepository) {
	return NewRepository(db), NewImageRepository(db)
}

// New wires service → HTTP handler from an already-constructed repository
// (shared with media for product-image ownership).
func New(
	repo Repository,
	lifecycle *media.LifecycleService,
	mediaSvc *media.Service,
	v *validator.Validator,
	store cache.Store,
	log *zap.Logger,
) *Handler {
	return NewHandler(NewService(repo, lifecycle, mediaSvc), v, store, log)
}

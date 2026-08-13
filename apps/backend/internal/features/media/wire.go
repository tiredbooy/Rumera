package media

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/imaging"
	"github.com/tiredbooy/pkg/storage"
	"github.com/tiredbooy/pkg/validator"
	"go.uber.org/zap"
)

// New wires media lifecycle + service + HTTP handler from storage backends
// and product ownership repositories. Lifecycle is returned for content
// features (hero, blog, recipes, catalog) that clean up detached media.
func New(
	db *pgxpool.Pool,
	store storage.WriteOnceStorage,
	cacheStore storage.Storage,
	productImages ProductImageRepository,
	products productMediaRepository,
	cfg Config,
	log *zap.Logger,
	appCache cache.Store,
	v *validator.Validator,
) (h *Handler, lifecycle *LifecycleService, svc *Service) {
	lifecycle = NewLifecycleService(store, cacheStore, NewLifecycleRepository(db), log)
	svc = NewService(
		store, cacheStore, productImages, products, NewContentRepository(db),
		lifecycle, imaging.New(), cfg, log,
	)
	h = NewHandler(svc, appCache, v)
	return h, lifecycle, svc
}

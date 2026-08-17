//go:build integration

package integration

import (
	"context"
	"errors"
	"github.com/tiredbooy/internal/features/catalog/product"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/features/media"
	"github.com/tiredbooy/pkg/apperr"
	"github.com/tiredbooy/pkg/imaging"
	"github.com/tiredbooy/pkg/storage"
	"go.uber.org/zap"
)

func TestMediaKeyLocksReservePoolCapacity(t *testing.T) {
	requireDB(t)
	config, err := pgxpool.ParseConfig(os.Getenv("TEST_DATABASE_URL"))
	if err != nil {
		t.Fatalf("parse test database URL: %v", err)
	}
	config.MaxConns = 2
	config.MinConns = 0
	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		t.Fatalf("create bounded media-lock pool: %v", err)
	}
	defer pool.Close()
	repo := media.NewLifecycleRepository(pool)

	first, err := repo.LockMediaKeys(context.Background(), []string{"uploads/first.webp"})
	if err != nil {
		t.Fatalf("acquire first media-key lock: %v", err)
	}
	defer first.Release(context.Background()) //nolint:errcheck

	var one int
	if err := pool.QueryRow(context.Background(), `SELECT 1`).Scan(&one); err != nil || one != 1 {
		t.Fatalf("query with one pinned lock = %d, %v; want free connection", one, err)
	}
	waitCtx, cancel := context.WithTimeout(context.Background(), 25*time.Millisecond)
	defer cancel()
	if _, err := repo.LockMediaKeys(waitCtx, []string{"uploads/second.webp"}); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("second lock error = %v; want bounded wait deadline", err)
	}
	if err := first.Release(context.Background()); err != nil {
		t.Fatalf("release first media-key lock: %v", err)
	}
	second, err := repo.LockMediaKeys(context.Background(), []string{"uploads/second.webp"})
	if err != nil {
		t.Fatalf("acquire second media-key lock after release: %v", err)
	}
	if err := second.Release(context.Background()); err != nil {
		t.Fatalf("release second media-key lock: %v", err)
	}
}

func TestStandaloneReleaseAndAggregateAttachmentAreLinearizable(t *testing.T) {
	requireDB(t)

	t.Run("aggregate attachment wins", func(t *testing.T) {
		resetTables(t, "product_aggregate_operations", "products")
		fixture := newMediaLinearizationFixture(t)
		defer fixture.gate.allowFirstToProceed()
		ctx := context.Background()
		upload, err := fixture.media.UploadImage(ctx, "uploads", integrationPNG(t))
		if err != nil {
			t.Fatalf("stage aggregate upload: %v", err)
		}
		req := preparedAggregateRequest(upload.Key, "Attachment wins")

		aggregateDone := make(chan aggregateSaveResult, 1)
		go func() {
			product, saveErr := fixture.product.SaveAggregate(ctx, 0, req)
			aggregateDone <- aggregateSaveResult{product: product, err: saveErr}
		}()
		waitForSignal(t, fixture.gate.firstAcquired, "aggregate media lock")

		releaseDone := make(chan error, 1)
		go func() { releaseDone <- fixture.lifecycle.ReleaseStandalone(ctx, upload.Key) }()
		waitForSignal(t, fixture.gate.secondEntered, "standalone release lock attempt")
		assertStillBlocked(t, releaseDone, "standalone release")

		fixture.gate.allowFirstToProceed()
		aggregate := waitForAggregate(t, aggregateDone)
		if aggregate.err != nil || aggregate.product == nil {
			t.Fatalf("aggregate result = %+v, %v; want product, nil", aggregate.product, aggregate.err)
		}
		if err := waitForError(t, releaseDone, "standalone release"); err != nil {
			t.Fatalf("release after aggregate attachment: %v", err)
		}
		if exists, err := fixture.store.Exists(ctx, upload.Key); err != nil || !exists {
			t.Fatalf("attached upload exists = %v, %v; want true, nil", exists, err)
		}
		referenced, err := media.NewLifecycleRepository(testPool).IsReferenced(ctx, upload.Key)
		if err != nil || !referenced {
			t.Fatalf("attached upload referenced = %v, %v; want true, nil", referenced, err)
		}
	})

	t.Run("standalone release wins", func(t *testing.T) {
		resetTables(t, "product_aggregate_operations", "products")
		fixture := newMediaLinearizationFixture(t)
		defer fixture.gate.allowFirstToProceed()
		ctx := context.Background()
		upload, err := fixture.media.UploadImage(ctx, "uploads", integrationPNG(t))
		if err != nil {
			t.Fatalf("stage aggregate upload: %v", err)
		}
		req := preparedAggregateRequest(upload.Key, "Release wins")

		releaseDone := make(chan error, 1)
		go func() { releaseDone <- fixture.lifecycle.ReleaseStandalone(ctx, upload.Key) }()
		waitForSignal(t, fixture.gate.firstAcquired, "standalone release lock")

		aggregateDone := make(chan aggregateSaveResult, 1)
		go func() {
			product, saveErr := fixture.product.SaveAggregate(ctx, 0, req)
			aggregateDone <- aggregateSaveResult{product: product, err: saveErr}
		}()
		waitForSignal(t, fixture.gate.secondEntered, "aggregate media lock attempt")
		assertAggregateStillBlocked(t, aggregateDone)

		fixture.gate.allowFirstToProceed()
		if err := waitForError(t, releaseDone, "standalone release"); err != nil {
			t.Fatalf("standalone release: %v", err)
		}
		aggregate := waitForAggregate(t, aggregateDone)
		if !errors.Is(aggregate.err, apperr.ErrValidation) || aggregate.product != nil {
			t.Fatalf("aggregate after release = %+v, %v; want nil validation error", aggregate.product, aggregate.err)
		}
		if exists, err := fixture.store.Exists(ctx, upload.Key); err != nil || exists {
			t.Fatalf("released upload exists = %v, %v; want false, nil", exists, err)
		}
		assertRowCount(t, "products", 0)
		assertRowCount(t, "product_images", 0)
	})
}

type mediaLinearizationFixture struct {
	gate      *gatedMediaLifecycleRepository
	lifecycle *media.LifecycleService
	media     *media.Service
	product   *product.Service
	store     *storage.LocalStorage
}

func newMediaLinearizationFixture(t *testing.T) mediaLinearizationFixture {
	t.Helper()
	store, err := storage.NewLocalStorage(t.TempDir())
	if err != nil {
		t.Fatalf("create media store: %v", err)
	}
	cache, err := storage.NewLocalStorage(t.TempDir())
	if err != nil {
		t.Fatalf("create media cache: %v", err)
	}
	productRepo := product.NewRepository(testPool)
	gate := newGatedMediaLifecycleRepository(media.NewLifecycleRepository(testPool))
	lifecycle := media.NewLifecycleService(store, cache, gate, zap.NewNop())
	media := media.NewService(
		store,
		cache,
		product.NewImageRepository(testPool),
		productRepo,
		media.NewContentRepository(testPool),
		lifecycle,
		imaging.New(),
		media.Config{
			MaxUploadBytes: 1 << 20, MaxDimension: 4000,
			MaxSourceDimension: 12000, MaxSourcePixels: 40_000_000,
		},
		zap.NewNop(),
	)
	return mediaLinearizationFixture{
		gate: gate, lifecycle: lifecycle, media: media,
		product: product.NewService(productRepo, lifecycle, media), store: store,
	}
}

type gatedMediaLifecycleRepository struct {
	delegate         media.LifecycleRepository
	calls            atomic.Int32
	firstAcquired    chan struct{}
	secondEntered    chan struct{}
	releaseFirst     chan struct{}
	releaseFirstOnce sync.Once
}

func newGatedMediaLifecycleRepository(delegate media.LifecycleRepository) *gatedMediaLifecycleRepository {
	return &gatedMediaLifecycleRepository{
		delegate: delegate, firstAcquired: make(chan struct{}),
		secondEntered: make(chan struct{}), releaseFirst: make(chan struct{}),
	}
}

func (r *gatedMediaLifecycleRepository) IsReferenced(ctx context.Context, key string) (bool, error) {
	return r.delegate.IsReferenced(ctx, key)
}

func (r *gatedMediaLifecycleRepository) ReferencedKeys(ctx context.Context) ([]string, error) {
	return r.delegate.ReferencedKeys(ctx)
}

func (r *gatedMediaLifecycleRepository) ProductKeys(ctx context.Context, productID int64) ([]string, error) {
	return r.delegate.ProductKeys(ctx, productID)
}

func (r *gatedMediaLifecycleRepository) VariantKeys(ctx context.Context, variantID int64) ([]string, error) {
	return r.delegate.VariantKeys(ctx, variantID)
}

func (r *gatedMediaLifecycleRepository) LockMediaKeys(
	ctx context.Context,
	keys []string,
) (media.KeyLock, error) {
	call := r.calls.Add(1)
	if call == 2 {
		close(r.secondEntered)
	}
	lock, err := r.delegate.LockMediaKeys(ctx, keys)
	if err != nil {
		return nil, err
	}
	if call != 1 {
		return lock, nil
	}
	close(r.firstAcquired)
	select {
	case <-r.releaseFirst:
		return lock, nil
	case <-ctx.Done():
		_ = lock.Release(context.Background())
		return nil, ctx.Err()
	}
}

func (r *gatedMediaLifecycleRepository) TryReconciliationLock(
	ctx context.Context,
) (media.ReconciliationLock, bool, error) {
	return r.delegate.TryReconciliationLock(ctx)
}

func (r *gatedMediaLifecycleRepository) allowFirstToProceed() {
	r.releaseFirstOnce.Do(func() { close(r.releaseFirst) })
}

type aggregateSaveResult struct {
	product *product.Product
	err     error
}

func preparedAggregateRequest(key, title string) product.SaveProductAggregateReq {
	return product.SaveProductAggregateReq{
		OperationID: uuid.NewString(),
		Title:       title,
		Images: []product.SaveProductImageReq{{
			StorageKey: &key,
			IsPrimary:  true,
		}},
	}
}

func waitForSignal(t *testing.T, signal <-chan struct{}, name string) {
	t.Helper()
	select {
	case <-signal:
	case <-time.After(5 * time.Second):
		t.Fatalf("timed out waiting for %s", name)
	}
}

func assertStillBlocked(t *testing.T, result <-chan error, name string) {
	t.Helper()
	select {
	case err := <-result:
		t.Fatalf("%s completed before the held media lock was released: %v", name, err)
	case <-time.After(50 * time.Millisecond):
	}
}

func assertAggregateStillBlocked(t *testing.T, result <-chan aggregateSaveResult) {
	t.Helper()
	select {
	case got := <-result:
		t.Fatalf("aggregate completed before the held media lock was released: %+v, %v", got.product, got.err)
	case <-time.After(50 * time.Millisecond):
	}
}

func waitForAggregate(t *testing.T, result <-chan aggregateSaveResult) aggregateSaveResult {
	t.Helper()
	select {
	case got := <-result:
		return got
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for aggregate result")
		return aggregateSaveResult{}
	}
}

func waitForError(t *testing.T, result <-chan error, name string) error {
	t.Helper()
	select {
	case err := <-result:
		return err
	case <-time.After(5 * time.Second):
		t.Fatalf("timed out waiting for %s", name)
		return nil
	}
}

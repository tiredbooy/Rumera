package services

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/storage"
	"go.uber.org/zap"
)

func TestMediaLifecycleCleanupRemovesOriginalAndDerivatives(t *testing.T) {
	ctx := context.Background()
	store := lifecycleStorage(t)
	cache := lifecycleStorage(t)
	repo := &mediaLifecycleRepositoryStub{}
	service := NewMediaLifecycleService(store, cache, repo, zap.NewNop())
	const key = "products/4-bottle/gallery-image.webp"
	for object, value := range map[string]string{
		key:                                    "original",
		mediaDerivativePrefix(key) + "/a.webp": "render-a",
		mediaDerivativePrefix(key) + "/b.jpg":  "render-b",
		mediaDerivativePrefix("products/5/other.webp") + "/a.webp": "other",
	} {
		target := store
		if strings.HasPrefix(object, "render-v2/") {
			target = cache
		}
		if err := target.Put(ctx, object, strings.NewReader(value)); err != nil {
			t.Fatalf("seed %q: %v", object, err)
		}
	}

	service.CleanupKeys(ctx, key)
	if exists, err := store.Exists(ctx, key); err != nil || exists {
		t.Fatalf("original exists = %v, %v; want false, nil", exists, err)
	}
	if objects, err := cache.List(ctx, mediaDerivativePrefix(key)); err != nil || len(objects) != 0 {
		t.Fatalf("derivatives = %+v, %v; want none", objects, err)
	}
	if objects, err := cache.List(ctx, mediaDerivativePrefix("products/5/other.webp")); err != nil || len(objects) != 1 {
		t.Fatalf("other derivatives = %+v, %v; want one", objects, err)
	}
}

func TestMediaLifecycleDerivativeCleanupFailureIsRetryable(t *testing.T) {
	ctx := context.Background()
	store := lifecycleStorage(t)
	cacheStore := lifecycleStorage(t)
	cache := &deletePrefixFailingStorage{
		Storage:         cacheStore,
		deletePrefixErr: errors.New("cache unavailable"),
	}
	service := NewMediaLifecycleService(store, cache, &mediaLifecycleRepositoryStub{}, zap.NewNop())
	const key = "products/4-bottle/gallery-image.webp"
	derivative := mediaDerivativePrefix(key) + "/a.webp"
	if err := store.Put(ctx, key, strings.NewReader("original")); err != nil {
		t.Fatalf("seed original: %v", err)
	}
	if err := cacheStore.Put(ctx, derivative, strings.NewReader("render")); err != nil {
		t.Fatalf("seed derivative: %v", err)
	}

	service.CleanupKeys(ctx, key)
	if exists, err := store.Exists(ctx, key); err != nil || !exists {
		t.Fatalf("original after failed derivative cleanup exists = %v, %v; want true, nil", exists, err)
	}
	if exists, err := cacheStore.Exists(ctx, derivative); err != nil || !exists {
		t.Fatalf("derivative after failed cleanup exists = %v, %v; want true, nil", exists, err)
	}

	cache.deletePrefixErr = nil
	service.CleanupKeys(ctx, key)
	if exists, err := store.Exists(ctx, key); err != nil || exists {
		t.Fatalf("original after retry exists = %v, %v; want false, nil", exists, err)
	}
	if exists, err := cacheStore.Exists(ctx, derivative); err != nil || exists {
		t.Fatalf("derivative after retry exists = %v, %v; want false, nil", exists, err)
	}
}

func TestMediaLifecycleNeverDeletesReferencedOrNonStandaloneKeys(t *testing.T) {
	ctx := context.Background()
	store := lifecycleStorage(t)
	cache := lifecycleStorage(t)
	repo := &mediaLifecycleRepositoryStub{referenced: map[string]bool{"categories/live.webp": true}}
	service := NewMediaLifecycleService(store, cache, repo, zap.NewNop())
	if err := store.Put(ctx, "categories/live.webp", strings.NewReader("live")); err != nil {
		t.Fatalf("seed: %v", err)
	}

	if err := service.ReleaseStandalone(ctx, "categories/live.webp"); err != nil {
		t.Fatalf("release referenced: %v", err)
	}
	if exists, err := store.Exists(ctx, "categories/live.webp"); err != nil || !exists {
		t.Fatalf("referenced object exists = %v, %v; want true, nil", exists, err)
	}
	if err := service.ReleaseStandalone(ctx, "products/4/image.webp"); !errors.Is(err, storage.ErrInvalidKey) {
		t.Fatalf("release product error = %v; want invalid key", err)
	}
}

func TestMediaReconciliationDryRunAndApply(t *testing.T) {
	ctx := context.Background()
	store := lifecycleStorage(t)
	cache := lifecycleStorage(t)
	now := time.Date(2026, time.July, 25, 12, 0, 0, 0, time.UTC)
	repo := &mediaLifecycleRepositoryStub{
		referenced: map[string]bool{"categories/live.webp": true, "recipes/missing.webp": true},
	}
	service := NewMediaLifecycleService(store, cache, repo, zap.NewNop())

	for key := range map[string]struct{}{
		"categories/live.webp": {},
		"uploads/orphan.webp":  {},
		"uploads/recent.webp":  {},
	} {
		if err := store.Put(ctx, key, strings.NewReader(key)); err != nil {
			t.Fatalf("seed %q: %v", key, err)
		}
	}
	old := now.Add(-48 * time.Hour)
	for _, key := range []string{"categories/live.webp", "uploads/orphan.webp"} {
		path := filepath.Join(store.Root(), filepath.FromSlash(key))
		if err := os.Chtimes(path, old, old); err != nil {
			t.Fatalf("age %q: %v", key, err)
		}
	}

	dryRun, err := service.Reconcile(ctx, MediaReconcileOptions{MinimumAge: 24 * time.Hour, Now: now})
	if err != nil {
		t.Fatalf("dry run: %v", err)
	}
	if dryRun.Mode != "dry-run" || len(dryRun.Objects) != 1 || dryRun.Objects[0].Action != "would_delete" {
		t.Fatalf("dry-run report = %+v", dryRun)
	}
	if !dryRun.Cutoff.Equal(now.Add(-24 * time.Hour)) {
		t.Fatalf("dry-run cutoff = %s; want %s", dryRun.Cutoff, now.Add(-24*time.Hour))
	}
	if len(dryRun.Missing) != 1 || dryRun.Missing[0].Key != "recipes/missing.webp" || dryRun.Summary.RecentUnreferenced != 1 {
		t.Fatalf("dry-run inventory = %+v", dryRun)
	}
	if exists, _ := store.Exists(ctx, "uploads/orphan.webp"); !exists {
		t.Fatal("dry run deleted orphan")
	}

	applied, err := service.Reconcile(ctx, MediaReconcileOptions{Apply: true, MinimumAge: 24 * time.Hour, Now: now})
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	if applied.Summary.Deleted != 1 || applied.Objects[0].Action != "deleted" {
		t.Fatalf("apply report = %+v", applied)
	}
	if exists, _ := store.Exists(ctx, "uploads/orphan.webp"); exists {
		t.Fatal("apply retained orphan")
	}
	if exists, _ := store.Exists(ctx, "categories/live.webp"); !exists {
		t.Fatal("apply deleted referenced object")
	}
}

func TestMediaReconciliationRechecksCandidateBeforeDelete(t *testing.T) {
	ctx := context.Background()
	store := lifecycleStorage(t)
	const key = "uploads/newly-referenced.webp"
	if err := store.Put(ctx, key, strings.NewReader("candidate")); err != nil {
		t.Fatalf("seed candidate: %v", err)
	}
	repo := &mediaLifecycleRepositoryStub{
		isReferenced: func(got string) (bool, error) {
			return got == key, nil
		},
	}
	service := NewMediaLifecycleService(store, lifecycleStorage(t), repo, zap.NewNop())

	report, err := service.Reconcile(ctx, MediaReconcileOptions{
		Apply: true,
		Now:   time.Now().UTC().Add(time.Hour),
	})
	if err != nil {
		t.Fatalf("reconcile: %v", err)
	}
	if report.Summary.Candidates != 1 || report.Summary.SkippedReferenced != 1 || report.Summary.Deleted != 0 {
		t.Fatalf("reconcile summary = %+v; want one skipped referenced candidate", report.Summary)
	}
	if len(report.Objects) != 1 || report.Objects[0].Action != "skipped_referenced" {
		t.Fatalf("reconcile objects = %+v; want skipped_referenced", report.Objects)
	}
	if exists, err := store.Exists(ctx, key); err != nil || !exists {
		t.Fatalf("newly referenced candidate exists = %v, %v; want true, nil", exists, err)
	}
}

func TestMediaReconciliationReusesReviewedCutoff(t *testing.T) {
	now := time.Date(2026, time.July, 25, 12, 0, 0, 0, time.UTC)
	cutoff := now.Add(-36 * time.Hour)
	service := NewMediaLifecycleService(
		lifecycleStorage(t), lifecycleStorage(t), &mediaLifecycleRepositoryStub{}, zap.NewNop(),
	)

	report, err := service.Reconcile(context.Background(), MediaReconcileOptions{
		Apply: true, MinimumAge: 24 * time.Hour, Cutoff: cutoff, Now: now,
	})
	if err != nil {
		t.Fatalf("reconcile with fixed cutoff: %v", err)
	}
	if !report.Cutoff.Equal(cutoff) {
		t.Fatalf("report cutoff = %s; want %s", report.Cutoff, cutoff)
	}
	if _, err := service.Reconcile(context.Background(), MediaReconcileOptions{
		Cutoff: now.Add(time.Second), Now: now,
	}); err == nil {
		t.Fatal("future cutoff succeeded")
	}
}

func lifecycleStorage(t *testing.T) *storage.LocalStorage {
	t.Helper()
	value, err := storage.NewLocalStorage(t.TempDir())
	if err != nil {
		t.Fatalf("new storage: %v", err)
	}
	return value
}

type mediaLifecycleRepositoryStub struct {
	referenced   map[string]bool
	product      []string
	variant      []string
	isReferenced func(string) (bool, error)
}

func (r *mediaLifecycleRepositoryStub) IsReferenced(_ context.Context, key string) (bool, error) {
	if r.isReferenced != nil {
		return r.isReferenced(key)
	}
	return r.referenced[key], nil
}

func (r *mediaLifecycleRepositoryStub) ReferencedKeys(context.Context) ([]string, error) {
	keys := make([]string, 0, len(r.referenced))
	for key, referenced := range r.referenced {
		if referenced {
			keys = append(keys, key)
		}
	}
	return keys, nil
}

func (r *mediaLifecycleRepositoryStub) ProductKeys(context.Context, int64) ([]string, error) {
	return r.product, nil
}

func (r *mediaLifecycleRepositoryStub) VariantKeys(context.Context, int64) ([]string, error) {
	return r.variant, nil
}

func (r *mediaLifecycleRepositoryStub) LockMediaKeys(context.Context, []string) (repositories.MediaKeyLock, error) {
	return mediaReconciliationLockStub{}, nil
}

func (r *mediaLifecycleRepositoryStub) TryReconciliationLock(context.Context) (repositories.MediaReconciliationLock, bool, error) {
	return mediaReconciliationLockStub{}, true, nil
}

type mediaReconciliationLockStub struct{}

func (mediaReconciliationLockStub) Release(context.Context) error { return nil }

type deletePrefixFailingStorage struct {
	storage.Storage
	deletePrefixErr error
}

func (s *deletePrefixFailingStorage) DeletePrefix(ctx context.Context, prefix string) error {
	if s.deletePrefixErr != nil {
		return s.deletePrefixErr
	}
	return s.Storage.DeletePrefix(ctx, prefix)
}

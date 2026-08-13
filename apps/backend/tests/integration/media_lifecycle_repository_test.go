//go:build integration

package integration

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/tiredbooy/internal/features/media"
	"github.com/tiredbooy/pkg/storage"
	"go.uber.org/zap"
)

func TestMediaReconcileProtectsEveryDatabaseReference(t *testing.T) {
	requireDB(t)
	resetTables(t,
		"site_settings", "review_images", "reviews", "brands", "categories",
		"hero_slides", "recipes", "blogs", "users", "products",
	)
	ctx := context.Background()
	productID := seedProduct(t)
	userID := seedUser(t)

	const (
		productOwned       = "products/reference-owned.webp"
		productLegacy      = "products/reference-legacy.webp"
		heroDesktopOwned   = "hero-slides/reference-desktop-owned.webp"
		heroMobileOwned    = "hero-slides/reference-mobile-owned.webp"
		heroDesktopLegacy  = "hero-slides/reference-desktop-legacy.webp"
		heroMobileLegacy   = "hero-slides/reference-mobile-legacy.webp"
		recipeCoverOwned   = "recipes/reference-cover-owned.webp"
		recipeOGOwned      = "recipes/reference-og-owned.webp"
		recipeCoverLegacy  = "recipes/reference-cover-legacy.webp"
		recipeOGLegacy     = "recipes/reference-og-legacy.webp"
		journalOwned       = "journal/reference-cover-owned.webp"
		journalLegacy      = "journal/reference-cover-legacy.webp"
		journalSoftDeleted = "journal/reference-soft-deleted.webp"
		categoryLegacy     = "categories/reference-legacy.webp"
		brandLegacy        = "brands/reference-legacy.webp"
		reviewLegacy       = "reviews/reference-legacy.webp"
		siteLogo           = "site/reference-logo.webp"
		siteOG             = "site/reference-og.webp"
	)

	if _, err := testPool.Exec(ctx, `
		INSERT INTO product_images (product_id, image_url, storage_key, sort_order, is_primary)
		VALUES ($1, $2, $3, 0, TRUE), ($1, $4, NULL, 1, FALSE)`,
		productID, "/media/"+productOwned, productOwned, "/media/"+productLegacy,
	); err != nil {
		t.Fatalf("insert product references: %v", err)
	}
	if _, err := testPool.Exec(ctx, `
		INSERT INTO hero_slides (
			title, image_url, image_storage_key, mobile_image_url, mobile_image_storage_key, is_active
		) VALUES
			('Owned hero reference', $1, $2, $3, $4, FALSE),
			('Legacy hero reference', $5, NULL, $6, NULL, FALSE)`,
		"/media/"+heroDesktopOwned, heroDesktopOwned,
		"/media/"+heroMobileOwned, heroMobileOwned,
		"/media/"+heroDesktopLegacy, "/media/"+heroMobileLegacy,
	); err != nil {
		t.Fatalf("insert hero references: %v", err)
	}
	if _, err := testPool.Exec(ctx, `
		INSERT INTO recipes (
			title, slug, content, difficulty, image_url, image_storage_key, og_image_url, og_image_storage_key
		) VALUES
			('Owned recipe reference', 'owned-reference', 'Steps', 'easy', $1, $2, $3, $4),
			('Legacy recipe reference', 'legacy-reference', 'Steps', 'easy', $5, NULL, $6, NULL)`,
		"/media/"+recipeCoverOwned, recipeCoverOwned,
		"/media/"+recipeOGOwned, recipeOGOwned,
		"/media/"+recipeCoverLegacy, "/media/"+recipeOGLegacy,
	); err != nil {
		t.Fatalf("insert recipe references: %v", err)
	}
	if _, err := testPool.Exec(ctx, `
		INSERT INTO blogs (author_id, title, slug, content, image_url, image_storage_key, deleted_at)
		VALUES
			($1, 'Owned journal reference', 'owned-journal-reference', 'Body', $2, $3, NULL),
			($1, 'Legacy journal reference', 'legacy-journal-reference', 'Body', $4, NULL, NULL),
			($1, 'Deleted journal reference', 'deleted-journal-reference', 'Body', $5, $6, NOW())`,
		userID,
		"/media/"+journalOwned, journalOwned,
		"/media/"+journalLegacy,
		"/media/"+journalSoftDeleted, journalSoftDeleted,
	); err != nil {
		t.Fatalf("insert journal references: %v", err)
	}
	if _, err := testPool.Exec(ctx,
		`INSERT INTO categories (title, image_url) VALUES ('Referenced category', $1)`,
		"/media/"+categoryLegacy,
	); err != nil {
		t.Fatalf("insert category reference: %v", err)
	}
	if _, err := testPool.Exec(ctx,
		`INSERT INTO brands (title, slug, image_url) VALUES ('Referenced brand', 'referenced-brand', $1)`,
		"/media/"+brandLegacy,
	); err != nil {
		t.Fatalf("insert brand reference: %v", err)
	}
	var reviewID int64
	if err := testPool.QueryRow(ctx, `
		INSERT INTO reviews (title, content, rating, user_id, product_id)
		VALUES ('Referenced review', 'Body', 5, $1, $2) RETURNING id`,
		userID, productID,
	).Scan(&reviewID); err != nil {
		t.Fatalf("insert review: %v", err)
	}
	if _, err := testPool.Exec(ctx,
		`INSERT INTO review_images (review_id, image_url) VALUES ($1, $2)`,
		reviewID, "/media/"+reviewLegacy,
	); err != nil {
		t.Fatalf("insert review reference: %v", err)
	}
	if _, err := testPool.Exec(ctx, `
		INSERT INTO site_settings (id, settings)
		VALUES (1, jsonb_build_object(
			'store', jsonb_build_object('logoUrl', $1::text),
			'seo', jsonb_build_object('ogImage', $2::text)
		))`,
		"/media/"+siteLogo, "/media/"+siteOG,
	); err != nil {
		t.Fatalf("insert site references: %v", err)
	}

	want := map[string]bool{
		productOwned: true, productLegacy: true,
		heroDesktopOwned: true, heroMobileOwned: true,
		heroDesktopLegacy: true, heroMobileLegacy: true,
		recipeCoverOwned: true, recipeOGOwned: true,
		recipeCoverLegacy: true, recipeOGLegacy: true,
		journalOwned: true, journalLegacy: true,
		categoryLegacy: true, brandLegacy: true, reviewLegacy: true,
		siteLogo: true, siteOG: true,
	}
	repo := media.NewLifecycleRepository(testPool)
	keys, err := repo.ReferencedKeys(ctx)
	if err != nil {
		t.Fatalf("list referenced keys: %v", err)
	}
	if len(keys) != len(want) {
		t.Fatalf("referenced keys = %v; want %d keys", keys, len(want))
	}
	for _, key := range keys {
		if !want[key] {
			t.Fatalf("unexpected referenced key %q in %v", key, keys)
		}
		delete(want, key)
	}
	if len(want) != 0 {
		t.Fatalf("missing referenced keys: %v", want)
	}
	for _, key := range keys {
		referenced, err := repo.IsReferenced(ctx, key)
		if err != nil || !referenced {
			t.Fatalf("IsReferenced(%q) = %v, %v; want true, nil", key, referenced, err)
		}
	}
	for _, key := range []string{journalSoftDeleted, "uploads/not-referenced.webp"} {
		referenced, err := repo.IsReferenced(ctx, key)
		if err != nil || referenced {
			t.Fatalf("IsReferenced(%q) = %v, %v; want false, nil", key, referenced, err)
		}
	}

	store, err := storage.NewLocalStorage(t.TempDir())
	if err != nil {
		t.Fatalf("create reconciliation store: %v", err)
	}
	cache, err := storage.NewLocalStorage(t.TempDir())
	if err != nil {
		t.Fatalf("create reconciliation cache: %v", err)
	}
	for _, key := range keys {
		if err := store.Put(ctx, key, strings.NewReader(key)); err != nil {
			t.Fatalf("store referenced key %q: %v", key, err)
		}
	}
	const orphan = "uploads/not-referenced.webp"
	if err := store.Put(ctx, orphan, strings.NewReader("orphan")); err != nil {
		t.Fatalf("store orphan: %v", err)
	}
	lifecycle := media.NewLifecycleService(store, cache, repo, zap.NewNop())
	report, err := lifecycle.Reconcile(ctx, media.ReconcileOptions{
		Apply: true,
		Now:   time.Now().UTC().Add(time.Second),
	})
	if err != nil {
		t.Fatalf("reconcile references: %v", err)
	}
	if report.Summary.Stored != len(keys)+1 || report.Summary.Candidates != 1 ||
		report.Summary.Deleted != 1 || report.Summary.Failed != 0 || len(report.Missing) != 0 {
		t.Fatalf("reconciliation report = %+v; want only orphan deleted", report)
	}
	for _, key := range keys {
		if exists, err := store.Exists(ctx, key); err != nil || !exists {
			t.Fatalf("referenced original %q exists = %v, %v; want true, nil", key, exists, err)
		}
	}
	if exists, err := store.Exists(ctx, orphan); err != nil || exists {
		t.Fatalf("orphan exists = %v, %v; want false, nil", exists, err)
	}
}

//go:build integration

package integration

import (
	"context"
	"errors"
	"fmt"
	"github.com/tiredbooy/internal/features/catalog/product"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/tiredbooy/internal/features/blog"
	"github.com/tiredbooy/internal/features/hero"
	"github.com/tiredbooy/internal/features/media"
	"github.com/tiredbooy/internal/features/recipes"
	"github.com/tiredbooy/internal/models"
)

func TestProductMediaIdentityIncludesInactiveOwners(t *testing.T) {
	requireDB(t)
	resetTables(t, "products")
	ctx := context.Background()

	var productID int64
	if err := testPool.QueryRow(ctx,
		`INSERT INTO products (title, slug, is_active)
		 VALUES ('Draft bottle', 'draft-bottle', false) RETURNING id`,
	).Scan(&productID); err != nil {
		t.Fatalf("insert draft product: %v", err)
	}

	slug, err := product.NewRepository(testPool).GetMediaIdentity(ctx, productID)
	if err != nil || slug != "draft-bottle" {
		t.Fatalf("GetMediaIdentity = %q, %v; want draft-bottle, nil", slug, err)
	}
}

func TestContentMediaKeysTrackCanonicalURLChanges(t *testing.T) {
	requireDB(t)
	resetTables(t, "hero_slides", "recipes", "blogs", "users")
	ctx := context.Background()

	t.Run("hero slide", func(t *testing.T) {
		key := "hero-slides/7/desktop-550e8400-e29b-41d4-a716-446655440000.webp"
		url := "/media/" + key
		var id int64
		if err := testPool.QueryRow(ctx,
			`INSERT INTO hero_slides (title, image_url, image_storage_key, is_active)
			 VALUES ('Hero', $1, $2, false) RETURNING id`, url, key,
		).Scan(&id); err != nil {
			t.Fatalf("insert hero: %v", err)
		}
		repo := hero.NewRepository(testPool)
		if _, err := repo.Update(ctx, id, &hero.HeroSlideUpdateReq{ImageURL: mediaValuePatch(url)}); err != nil {
			t.Fatalf("keep hero URL: %v", err)
		}
		assertColumnString(t, "hero_slides", "image_storage_key", id, &key)

		external := "https://images.example/hero.webp"
		if _, err := repo.Update(ctx, id, &hero.HeroSlideUpdateReq{ImageURL: mediaValuePatch(external)}); err != nil {
			t.Fatalf("replace hero URL: %v", err)
		}
		assertColumnString(t, "hero_slides", "image_storage_key", id, nil)
	})

	t.Run("recipe", func(t *testing.T) {
		key := "recipes/11/cover-550e8400-e29b-41d4-a716-446655440000.webp"
		url := "/media/" + key
		var id int64
		if err := testPool.QueryRow(ctx,
			`INSERT INTO recipes (title, slug, content, difficulty, image_url, image_storage_key)
			 VALUES ('Recipe', 'recipe', 'Steps', 'easy', $1, $2) RETURNING id`, url, key,
		).Scan(&id); err != nil {
			t.Fatalf("insert recipe: %v", err)
		}
		repo := recipes.NewRepository(testPool)
		if _, err := repo.Update(ctx, id, &recipes.RecipeUpdateReq{ImageURL: mediaValuePatch(url)}); err != nil {
			t.Fatalf("keep recipe URL: %v", err)
		}
		assertColumnString(t, "recipes", "image_storage_key", id, &key)

		external := "https://images.example/recipe.webp"
		if _, err := repo.Update(ctx, id, &recipes.RecipeUpdateReq{ImageURL: mediaValuePatch(external)}); err != nil {
			t.Fatalf("replace recipe URL: %v", err)
		}
		assertColumnString(t, "recipes", "image_storage_key", id, nil)
	})

	t.Run("journal", func(t *testing.T) {
		userID := seedUser(t)
		key := "journal/19/cover-550e8400-e29b-41d4-a716-446655440000.webp"
		url := "/media/" + key
		var id int64
		if err := testPool.QueryRow(ctx,
			`INSERT INTO blogs (author_id, title, slug, content, image_url, image_storage_key)
			 VALUES ($1, 'Journal', 'journal', 'Body', $2, $3) RETURNING id`, userID, url, key,
		).Scan(&id); err != nil {
			t.Fatalf("insert journal: %v", err)
		}
		repo := blog.NewRepository(testPool)
		if _, err := repo.Update(ctx, id, &blog.BlogUpdateReq{ImageURL: mediaValuePatch(url)}); err != nil {
			t.Fatalf("keep journal URL: %v", err)
		}
		assertColumnString(t, "blogs", "image_storage_key", id, &key)

		external := "https://images.example/journal.webp"
		if _, err := repo.Update(ctx, id, &blog.BlogUpdateReq{ImageURL: mediaValuePatch(external)}); err != nil {
			t.Fatalf("replace journal URL: %v", err)
		}
		assertColumnString(t, "blogs", "image_storage_key", id, nil)
	})
}

func TestProductImageRepositorySerializesOrderingAndPrimaryWrites(t *testing.T) {
	requireDB(t)
	resetTables(t, "products")
	ctx := context.Background()
	productID := seedProduct(t)
	repo := product.NewImageRepository(testPool)

	const imageCount = 8
	var wg sync.WaitGroup
	errs := make(chan error, imageCount)
	for i := range imageCount {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := repo.Create(ctx, &models.ProductImage{
				ProductID: &productID,
				ImageURL:  fmt.Sprintf("https://images.example/product-%d.webp", i),
				IsPrimary: true,
			})
			errs <- err
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatalf("concurrent create: %v", err)
		}
	}

	images, err := repo.ListByProduct(ctx, productID)
	if err != nil {
		t.Fatalf("list product images: %v", err)
	}
	if len(images) != imageCount {
		t.Fatalf("image count = %d; want %d", len(images), imageCount)
	}
	primaryCount := 0
	ids := make([]int64, len(images))
	for i, image := range images {
		ids[len(images)-1-i] = image.ID
		if image.SortOrder != i {
			t.Fatalf("sort order at index %d = %d; want %d", i, image.SortOrder, i)
		}
		if image.IsPrimary {
			primaryCount++
		}
	}
	if primaryCount != 1 {
		t.Fatalf("primary image count = %d; want 1", primaryCount)
	}

	if err := repo.Reorder(ctx, productID, ids); err != nil {
		t.Fatalf("reverse image order: %v", err)
	}
	reordered, err := repo.ListByProduct(ctx, productID)
	if err != nil {
		t.Fatalf("list reordered images: %v", err)
	}
	for i, image := range reordered {
		if image.ID != ids[i] || image.SortOrder != i {
			t.Fatalf("reordered image %d = id %d/order %d; want id %d/order %d", i, image.ID, image.SortOrder, ids[i], i)
		}
	}
	if err := repo.Reorder(ctx, productID, ids[:len(ids)-1]); !errors.Is(err, models.ErrInvalidState) {
		t.Fatalf("partial reorder error = %v; want ErrInvalidState", err)
	}

	var primaryID int64
	for _, image := range reordered {
		if image.IsPrimary {
			primaryID = image.ID
			break
		}
	}
	if err := repo.Delete(ctx, productID, primaryID); err != nil {
		t.Fatalf("delete primary image: %v", err)
	}
	afterDelete, err := repo.ListByProduct(ctx, productID)
	if err != nil {
		t.Fatalf("list after primary delete: %v", err)
	}
	if len(afterDelete) != imageCount-1 {
		t.Fatalf("image count after delete = %d; want %d", len(afterDelete), imageCount-1)
	}
	primaryCount = 0
	for i, image := range afterDelete {
		if image.SortOrder != i {
			t.Fatalf("post-delete order at index %d = %d; want %d", i, image.SortOrder, i)
		}
		if image.IsPrimary {
			primaryCount++
		}
	}
	if primaryCount != 1 {
		t.Fatalf("primary count after primary delete = %d; want 1", primaryCount)
	}
}

func TestMediaSchemaRejectsUnsafeOrCollidingKeys(t *testing.T) {
	requireDB(t)
	resetTables(t, "products")
	ctx := context.Background()
	productID := seedProduct(t)

	const key = "products/1-test/gallery-550e8400-e29b-41d4-a716-446655440000.webp"
	if _, err := testPool.Exec(ctx,
		`INSERT INTO product_images (product_id, image_url, storage_key)
		 VALUES ($1, $2, $3)`, productID, "/media/"+key, key,
	); err != nil {
		t.Fatalf("insert canonical product image: %v", err)
	}
	if _, err := testPool.Exec(ctx,
		`INSERT INTO product_images (product_id, image_url, storage_key)
		 VALUES ($1, $2, $3)`, productID, "/media/"+key, key,
	); err == nil {
		t.Fatal("duplicate storage key was accepted")
	}
	unsafeKeys := []string{
		"products/../safe.webp",
		"products/image%2fcover.webp",
		"products/image?cover.webp",
		"products/image#cover.webp",
		"Products/image.webp",
		"products/con.webp",
		"products/image.",
	}
	for _, unsafeKey := range unsafeKeys {
		if _, err := testPool.Exec(ctx,
			`INSERT INTO product_images (product_id, image_url, storage_key)
			 VALUES ($1, $2, $3)`, productID, "/media/"+unsafeKey, unsafeKey,
		); err == nil {
			t.Fatalf("unsafe storage key %q was accepted", unsafeKey)
		}
	}
	if _, err := testPool.Exec(ctx,
		`INSERT INTO product_images (product_id, image_url, storage_key)
		 VALUES ($1, '/media/products/other.webp', 'products/safe.webp')`, productID,
	); err == nil {
		t.Fatal("mismatched canonical URL and storage key were accepted")
	}
}

func TestContentMediaRepositoryAttachesEveryOwnerSlot(t *testing.T) {
	requireDB(t)
	resetTables(t, "hero_slides", "recipes", "blogs", "users")
	ctx := context.Background()

	var heroID, recipeID, blogID int64
	if err := testPool.QueryRow(ctx,
		`INSERT INTO hero_slides (title, image_url, is_active)
		 VALUES ('Media draft', NULL, false) RETURNING id`,
	).Scan(&heroID); err != nil {
		t.Fatalf("insert media-less hero draft: %v", err)
	}
	if _, err := testPool.Exec(ctx,
		`INSERT INTO hero_slides (title, image_url, is_active)
		 VALUES ('Invalid active draft', NULL, true)`,
	); err == nil {
		t.Fatal("active media-less hero was accepted")
	}
	if err := testPool.QueryRow(ctx,
		`INSERT INTO recipes (title, slug, content, difficulty, status)
		 VALUES ('Media recipe', 'media-recipe', 'Steps', 'easy', 'draft') RETURNING id`,
	).Scan(&recipeID); err != nil {
		t.Fatalf("insert recipe owner: %v", err)
	}
	userID := seedUser(t)
	if err := testPool.QueryRow(ctx,
		`INSERT INTO blogs (author_id, title, slug, content, status)
		 VALUES ($1, 'Media journal', 'media-journal', 'Body', 'draft') RETURNING id`, userID,
	).Scan(&blogID); err != nil {
		t.Fatalf("insert journal owner: %v", err)
	}

	repo := media.NewContentRepository(testPool)
	tests := []struct {
		name      string
		ownerType string
		role      string
		ownerID   int64
		table     string
		column    string
		key       string
	}{
		{name: "hero desktop", ownerType: "hero-slides", role: "desktop", ownerID: heroID, table: "hero_slides", column: "image_storage_key", key: "hero-slides/1/desktop-550e8400-e29b-41d4-a716-446655440000.webp"},
		{name: "hero mobile", ownerType: "hero-slides", role: "mobile", ownerID: heroID, table: "hero_slides", column: "mobile_image_storage_key", key: "hero-slides/1/mobile-550e8400-e29b-41d4-a716-446655440001.webp"},
		{name: "recipe cover", ownerType: "recipes", role: "cover", ownerID: recipeID, table: "recipes", column: "image_storage_key", key: "recipes/1/cover-550e8400-e29b-41d4-a716-446655440002.webp"},
		{name: "recipe og", ownerType: "recipes", role: "og", ownerID: recipeID, table: "recipes", column: "og_image_storage_key", key: "recipes/1/og-550e8400-e29b-41d4-a716-446655440003.webp"},
		{name: "journal cover", ownerType: "journal", role: "cover", ownerID: blogID, table: "blogs", column: "image_storage_key", key: "journal/1/cover-550e8400-e29b-41d4-a716-446655440004.webp"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			exists, err := repo.OwnerExists(ctx, tt.ownerType, tt.ownerID)
			if err != nil || !exists {
				t.Fatalf("OwnerExists = %v, %v; want true, nil", exists, err)
			}
			mediaURL := "/media/" + tt.key
			alt := models.NullablePatch[string]{}
			if tt.role != "og" {
				alt = mediaValuePatch(tt.name + " alt")
			}
			if _, err := repo.Attach(ctx, tt.ownerType, tt.role, tt.ownerID, mediaURL, tt.key, alt); err != nil {
				t.Fatalf("Attach: %v", err)
			}
			assertColumnString(t, tt.table, tt.column, tt.ownerID, &tt.key)
			if alt.Set {
				assertColumnString(t, tt.table, "image_alt", tt.ownerID, alt.Value)
			}
		})
	}

	var oldRecipeURL string
	if err := testPool.QueryRow(ctx, `SELECT image_url FROM recipes WHERE id = $1`, recipeID).Scan(&oldRecipeURL); err != nil {
		t.Fatalf("read recipe URL before concurrent attachment: %v", err)
	}
	replacementKey := "recipes/1/cover-550e8400-e29b-41d4-a716-446655440099.webp"
	replacementAlt := mediaValuePatch("replacement alt")
	attachment, err := repo.Attach(ctx, "recipes", "cover", recipeID, "/media/"+replacementKey, replacementKey, replacementAlt)
	if err != nil {
		t.Fatalf("attach replacement recipe cover: %v", err)
	}
	if attachment.DetachedKey == nil || *attachment.DetachedKey != tests[2].key || attachment.OwnerSlug != "media-recipe" {
		t.Fatalf("replacement attachment = %+v; want detached key and recipe slug", attachment)
	}
	staleAlt := mediaValuePatch("stale alt")
	_, err = recipes.NewRepository(testPool).Update(ctx, recipeID, &recipes.RecipeUpdateReq{
		ImageAlt:         staleAlt,
		ExpectedImageURL: mediaValuePatch(oldRecipeURL),
	})
	if !errors.Is(err, models.ErrConflict) {
		t.Fatalf("stale recipe media update error = %v; want ErrConflict", err)
	}
	assertColumnString(t, "recipes", "image_storage_key", recipeID, &replacementKey)
	assertColumnString(t, "recipes", "image_alt", recipeID, replacementAlt.Value)

	if _, err := testPool.Exec(ctx, `UPDATE hero_slides SET is_active = true WHERE id = $1`, heroID); err != nil {
		t.Fatalf("activate hero after desktop attachment: %v", err)
	}
	if _, err := testPool.Exec(ctx, `UPDATE blogs SET deleted_at = NOW() WHERE id = $1`, blogID); err != nil {
		t.Fatalf("soft delete journal owner: %v", err)
	}
	if exists, err := repo.OwnerExists(ctx, "journal", blogID); err != nil || exists {
		t.Fatalf("deleted journal OwnerExists = %v, %v; want false, nil", exists, err)
	}
	if _, err := repo.Attach(ctx, "journal", "cover", blogID, "/media/journal/new.webp", "journal/new.webp", models.NullablePatch[string]{}); !errors.Is(err, models.ErrNotFound) {
		t.Fatalf("attach deleted journal error = %v; want ErrNotFound", err)
	}
}

func TestMediaMigrationKeepsSharedKeysDetachedAcrossDownUp(t *testing.T) {
	requireDB(t)
	resetTables(t, "hero_slides", "recipes", "blogs", "users", "products")
	ctx := context.Background()
	db := stdlib.OpenDBFromPool(testPool)
	defer func() { _ = db.Close() }()

	const (
		migrationDir        = "../../migrations/main"
		preMediaMigrationID = int64(20260719110000)
		mediaMigrationID    = int64(20260720110000)
	)
	if err := goose.DownTo(db, migrationDir, preMediaMigrationID); err != nil {
		t.Fatalf("migrate media down: %v", err)
	}
	migrationApplied := false
	defer func() {
		if !migrationApplied {
			if err := goose.Up(db, migrationDir); err != nil {
				t.Errorf("restore media migration: %v", err)
			}
		}
	}()

	productID := seedProduct(t)
	userID := seedUser(t)
	const (
		sharedKey      = "legacy/shared.webp"
		heroMobileKey  = "legacy/hero-mobile.webp"
		recipeCoverKey = "legacy/recipe-cover.webp"
		recipeOGKey    = "legacy/recipe-og.webp"
		journalKey     = "legacy/journal-cover.webp"
	)
	if _, err := testPool.Exec(ctx,
		`INSERT INTO product_images (product_id, image_url, storage_key)
		 VALUES ($1, 'https://old.example/shared.webp', $2)`, productID, sharedKey,
	); err != nil {
		t.Fatalf("insert legacy product media: %v", err)
	}
	if _, err := testPool.Exec(ctx,
		`INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
		 VALUES ($1, 'https://old.example/null-primary.webp', 0, NULL),
		        ($1, 'https://old.example/primary.webp', 2, true),
		        ($1, 'https://old.example/duplicate-primary.webp', 5, true)`, productID,
	); err != nil {
		t.Fatalf("insert legacy gallery state: %v", err)
	}
	if _, err := testPool.Exec(ctx,
		`INSERT INTO hero_slides (title, image_url, mobile_image_url, is_active)
		 VALUES ('Legacy hero', $1, $2, false)`,
		"/media/"+sharedKey, "/media/"+heroMobileKey,
	); err != nil {
		t.Fatalf("insert legacy hero media: %v", err)
	}
	if _, err := testPool.Exec(ctx,
		`INSERT INTO recipes (title, slug, content, difficulty, image_url, og_image_url)
		 VALUES ('Legacy recipe', 'legacy-recipe', 'Steps', 'easy', $1, $2)`,
		"/media/"+recipeCoverKey, "/media/"+recipeOGKey,
	); err != nil {
		t.Fatalf("insert legacy recipe media: %v", err)
	}
	if _, err := testPool.Exec(ctx,
		`INSERT INTO blogs (author_id, title, slug, content, image_url)
		 VALUES ($1, 'Legacy journal', 'legacy-journal', 'Body', $2)`,
		userID, "/media/"+journalKey,
	); err != nil {
		t.Fatalf("insert legacy journal media: %v", err)
	}

	if err := goose.Up(db, migrationDir); err != nil {
		t.Fatalf("migrate media up: %v", err)
	}
	migrationApplied = true
	assertMigratedMediaKeys(t, sharedKey, heroMobileKey, recipeCoverKey, recipeOGKey, journalKey)
	assertProductGalleryInvariant(t, productID, 4)

	// Simulate a NO TRANSACTION failure after all schema statements completed but
	// before Goose recorded the migration version. Retrying must first remove the
	// existing unique indexes, then safely repeat backfill and shared-key cleanup.
	if err := goose.DownTo(db, migrationDir, mediaMigrationID); err != nil {
		t.Fatalf("remove post-media migration before retry simulation: %v", err)
	}
	migrationApplied = false
	if _, err := testPool.Exec(ctx,
		`DELETE FROM goose_db_version WHERE version_id = $1`, mediaMigrationID,
	); err != nil {
		t.Fatalf("remove media migration version: %v", err)
	}
	migrationApplied = false
	if err := goose.Up(db, migrationDir); err != nil {
		t.Fatalf("retry unversioned media migration: %v", err)
	}
	migrationApplied = true
	assertMigratedMediaKeys(t, sharedKey, heroMobileKey, recipeCoverKey, recipeOGKey, journalKey)

	if err := goose.DownTo(db, migrationDir, preMediaMigrationID); err != nil {
		t.Fatalf("repeat media down: %v", err)
	}
	migrationApplied = false
	if err := goose.Up(db, migrationDir); err != nil {
		t.Fatalf("repeat media up: %v", err)
	}
	migrationApplied = true
	assertMigratedMediaKeys(t, sharedKey, heroMobileKey, recipeCoverKey, recipeOGKey, journalKey)
}

func assertMigratedMediaKeys(t *testing.T, shared, heroMobile, recipeCover, recipeOG, journal string) {
	t.Helper()
	ctx := context.Background()

	var productURL string
	var productKey, heroKey, gotHeroMobile, gotRecipeCover, gotRecipeOG, gotJournal *string
	if err := testPool.QueryRow(ctx,
		`SELECT image_url, storage_key FROM product_images ORDER BY id LIMIT 1`,
	).Scan(&productURL, &productKey); err != nil {
		t.Fatalf("read migrated product media: %v", err)
	}
	if productURL != "/media/"+shared || productKey != nil {
		t.Fatalf("product media = %q, %v; want canonical shared URL with NULL key", productURL, productKey)
	}
	if err := testPool.QueryRow(ctx,
		`SELECT image_storage_key, mobile_image_storage_key FROM hero_slides LIMIT 1`,
	).Scan(&heroKey, &gotHeroMobile); err != nil {
		t.Fatalf("read migrated hero media: %v", err)
	}
	if heroKey != nil || gotHeroMobile == nil || *gotHeroMobile != heroMobile {
		t.Fatalf("hero keys = %v, %v; want NULL, %q", heroKey, gotHeroMobile, heroMobile)
	}
	if err := testPool.QueryRow(ctx,
		`SELECT image_storage_key, og_image_storage_key FROM recipes LIMIT 1`,
	).Scan(&gotRecipeCover, &gotRecipeOG); err != nil {
		t.Fatalf("read migrated recipe media: %v", err)
	}
	if gotRecipeCover == nil || *gotRecipeCover != recipeCover || gotRecipeOG == nil || *gotRecipeOG != recipeOG {
		t.Fatalf("recipe keys = %v, %v; want %q, %q", gotRecipeCover, gotRecipeOG, recipeCover, recipeOG)
	}
	if err := testPool.QueryRow(ctx,
		`SELECT image_storage_key FROM blogs LIMIT 1`,
	).Scan(&gotJournal); err != nil {
		t.Fatalf("read migrated journal media: %v", err)
	}
	if gotJournal == nil || *gotJournal != journal {
		t.Fatalf("journal key = %v; want %q", gotJournal, journal)
	}
}

func assertProductGalleryInvariant(t *testing.T, productID int64, wantCount int) {
	t.Helper()
	rows, err := testPool.Query(context.Background(),
		`SELECT sort_order, is_primary FROM product_images WHERE product_id = $1 ORDER BY sort_order`,
		productID,
	)
	if err != nil {
		t.Fatalf("read product gallery invariant: %v", err)
	}
	defer rows.Close()
	count := 0
	primaryCount := 0
	for rows.Next() {
		var order int
		var primary bool
		if err := rows.Scan(&order, &primary); err != nil {
			t.Fatalf("scan product gallery invariant: %v", err)
		}
		if order != count {
			t.Fatalf("gallery order at index %d = %d", count, order)
		}
		if primary {
			primaryCount++
		}
		count++
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate product gallery invariant: %v", err)
	}
	if count != wantCount || primaryCount != 1 {
		t.Fatalf("gallery count/primary = %d/%d; want %d/1", count, primaryCount, wantCount)
	}
}

func assertColumnString(t *testing.T, table, column string, id int64, want *string) {
	t.Helper()
	allowed := map[string]map[string]bool{
		"hero_slides": {"image_storage_key": true, "mobile_image_storage_key": true, "image_alt": true},
		"recipes":     {"image_storage_key": true, "og_image_storage_key": true, "image_alt": true},
		"blogs":       {"image_storage_key": true, "image_alt": true},
	}
	if !allowed[table][column] {
		t.Fatalf("unsupported test column %s.%s", table, column)
	}

	var got *string
	query := "SELECT " + column + " FROM " + table + " WHERE id = $1"
	if err := testPool.QueryRow(context.Background(), query, id).Scan(&got); err != nil {
		t.Fatalf("read %s.%s: %v", table, column, err)
	}
	if want == nil {
		if got != nil {
			t.Fatalf("%s.%s = %q; want NULL", table, column, *got)
		}
		return
	}
	if got == nil || *got != *want {
		t.Fatalf("%s.%s = %v; want %q", table, column, got, *want)
	}
}

func mediaValuePatch(value string) models.NullablePatch[string] {
	return models.NullablePatch[string]{Set: true, Value: &value}
}

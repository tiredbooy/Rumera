//go:build integration

package integration

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/tiredbooy/internal/features/hero"
	"github.com/tiredbooy/internal/models"
)

func TestHeroSlideRepositoryPersistsNullPatchesAndAtomicOrder(t *testing.T) {
	requireDB(t)
	resetTables(t, "hero_slides")
	ctx := context.Background()
	repo := hero.NewRepository(testPool)

	copyValue := "Existing"
	primaryHref := "/products"
	secondaryHref := "https://example.com/journal"
	imageURL := "/images/hero/first.webp"
	mobileImageURL := "/images/hero/first-mobile.webp"
	start := time.Date(2026, 8, 1, 12, 0, 0, 0, time.UTC)
	end := start.Add(time.Hour)
	first, err := repo.Create(ctx, &hero.HeroSlideReq{
		Eyebrow:           &copyValue,
		Title:             "First",
		Subtitle:          &copyValue,
		Badge:             &copyValue,
		ImageURL:          &imageURL,
		MobileImageURL:    &mobileImageURL,
		ImageAlt:          &copyValue,
		CTALabel:          &copyValue,
		CTAHref:           &primaryHref,
		SecondaryCTALabel: &copyValue,
		SecondaryCTAHref:  &secondaryHref,
		StartsAt:          &start,
		EndsAt:            &end,
	})
	if err != nil {
		t.Fatalf("create first hero slide: %v", err)
	}
	second := createIntegrationHeroSlide(t, repo, "Second", "/images/hero/second.webp", 20)
	third := createIntegrationHeroSlide(t, repo, "Third", "/images/hero/third.webp", 30)

	desktopKey := fmt.Sprintf("hero-slides/%d/desktop/test.webp", first.ID)
	mobileKey := fmt.Sprintf("hero-slides/%d/mobile/test.webp", first.ID)
	desktopMediaURL := "/media/" + desktopKey
	mobileMediaURL := "/media/" + mobileKey
	if _, err := testPool.Exec(ctx, `
		UPDATE hero_slides
		SET image_url = $2, image_storage_key = $3,
		    mobile_image_url = $4, mobile_image_storage_key = $5
		WHERE id = $1`, first.ID, desktopMediaURL, desktopKey, mobileMediaURL, mobileKey); err != nil {
		t.Fatalf("attach canonical hero media: %v", err)
	}

	staleURL := "/media/hero-slides/stale/desktop/test.webp"
	newAlt := "New alt"
	if _, err := repo.Update(ctx, first.ID, &hero.HeroSlideUpdateReq{
		ImageAlt:         models.NullablePatch[string]{Set: true, Value: &newAlt},
		ExpectedImageURL: models.NullablePatch[string]{Set: true, Value: &staleURL},
	}); !errors.Is(err, models.ErrConflict) {
		t.Fatalf("stale media expectation error = %v; want ErrConflict", err)
	}

	inactive := false
	clearString := models.NullablePatch[string]{Set: true}
	clearTime := models.NullablePatch[time.Time]{Set: true}
	updated, err := repo.Update(ctx, first.ID, &hero.HeroSlideUpdateReq{
		Eyebrow:           clearString,
		Subtitle:          clearString,
		ImageURL:          clearString,
		MobileImageURL:    clearString,
		ImageAlt:          clearString,
		CTALabel:          clearString,
		CTAHref:           clearString,
		SecondaryCTALabel: clearString,
		SecondaryCTAHref:  clearString,
		IsActive:          &inactive,
		StartsAt:          clearTime,
		EndsAt:            clearTime,
	})
	if err != nil {
		t.Fatalf("clear nullable hero fields: %v", err)
	}
	if updated.Title != "First" || updated.Badge == nil || *updated.Badge != copyValue ||
		updated.IsActive || updated.ImageURL != nil || updated.MobileImageURL != nil ||
		updated.Eyebrow != nil || updated.Subtitle != nil || updated.ImageAlt != nil ||
		updated.CTALabel != nil || updated.CTAHref != nil ||
		updated.SecondaryCTALabel != nil || updated.SecondaryCTAHref != nil ||
		updated.StartsAt != nil || updated.EndsAt != nil {
		t.Fatalf("updated hero slide did not persist explicit nulls: %+v", updated)
	}
	var storedDesktopKey, storedMobileKey *string
	if err := testPool.QueryRow(ctx, `
		SELECT image_storage_key, mobile_image_storage_key
		FROM hero_slides WHERE id = $1`, first.ID).Scan(&storedDesktopKey, &storedMobileKey); err != nil {
		t.Fatalf("read cleared hero media keys: %v", err)
	}
	if storedDesktopKey != nil || storedMobileKey != nil {
		t.Fatalf("storage keys after URL clear = %v, %v; want nil", storedDesktopKey, storedMobileKey)
	}

	ids := []int64{third.ID, first.ID, second.ID}
	if err := repo.Reorder(ctx, ids); err != nil {
		t.Fatalf("reorder hero slides: %v", err)
	}
	slides, err := repo.GetAll(ctx)
	if err != nil {
		t.Fatalf("list reordered hero slides: %v", err)
	}
	for i, slide := range slides {
		if slide.ID != ids[i] || slide.SortOrder != i {
			t.Fatalf("slide at %d = id %d/order %d; want id %d/order %d", i, slide.ID, slide.SortOrder, ids[i], i)
		}
	}
	if err := repo.Reorder(ctx, ids[:len(ids)-1]); !errors.Is(err, models.ErrInvalidState) {
		t.Fatalf("partial hero reorder error = %v; want ErrInvalidState", err)
	}
}

func TestHeroSlidePublicationConstraintsRejectInvalidRows(t *testing.T) {
	requireDB(t)
	resetTables(t, "hero_slides")
	ctx := context.Background()
	repo := hero.NewRepository(testPool)
	start := time.Date(2026, 8, 2, 12, 0, 0, 0, time.UTC)
	end := start.Add(-time.Minute)
	inactive := false

	if _, err := repo.Create(ctx, &hero.HeroSlideReq{
		Title:    "Invalid schedule",
		IsActive: &inactive,
		StartsAt: &start,
		EndsAt:   &end,
	}); !errors.Is(err, models.ErrHeroSchedule) {
		t.Fatalf("invalid hero schedule error = %v; want ErrHeroSchedule", err)
	}
	if _, err := testPool.Exec(ctx, `
		INSERT INTO hero_slides (title, is_active, cta_label)
		VALUES ('Incomplete CTA', FALSE, 'Shop')`); err == nil {
		t.Fatal("incomplete primary CTA satisfied database constraint")
	}
	if _, err := testPool.Exec(ctx, `
		INSERT INTO hero_slides (title, is_active, secondary_cta_href)
		VALUES ('Incomplete secondary CTA', FALSE, '/journal')`); err == nil {
		t.Fatal("incomplete secondary CTA satisfied database constraint")
	}
	for _, href := range []string{
		"javascript:alert(1)",
		"http://example.com/products",
		"//example.com/products",
		"/%2Fexample.com/products",
		`/products\unsafe`,
	} {
		if _, err := testPool.Exec(ctx, `
			INSERT INTO hero_slides (title, is_active, cta_label, cta_href)
			VALUES ('Unsafe CTA', FALSE, 'Shop', $1)`, href); err == nil {
			t.Fatalf("unsafe CTA href %q satisfied database constraint", href)
		}
	}
}

func createIntegrationHeroSlide(
	t *testing.T,
	repo hero.Repository,
	title string,
	imageURL string,
	sortOrder int,
) *hero.HeroSlide {
	t.Helper()
	slide, err := repo.Create(context.Background(), &hero.HeroSlideReq{
		Title:     title,
		ImageURL:  &imageURL,
		SortOrder: &sortOrder,
	})
	if err != nil {
		t.Fatalf("create %s hero slide: %v", title, err)
	}
	return slide
}

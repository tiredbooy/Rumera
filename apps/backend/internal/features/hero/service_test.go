package hero

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

func TestHeroSlideCreateAllowsOnlyInactiveMediaLessDraft(t *testing.T) {
	repo := &heroSlideRepositoryStub{}
	service := NewService(repo, nil)

	if _, err := service.Create(context.Background(), &HeroSlideReq{Title: "Active"}); err == nil {
		t.Fatal("active media-less create succeeded; want validation error")
	} else {
		requireHeroValidationField(t, err, "image_url")
	}
	if repo.created != nil {
		t.Fatal("active media-less slide reached repository")
	}

	inactive := false
	blank := "   "
	created, err := service.Create(context.Background(), &HeroSlideReq{
		Title:             "  Draft  ",
		Eyebrow:           &blank,
		Subtitle:          &blank,
		Badge:             &blank,
		ImageURL:          &blank,
		MobileImageURL:    &blank,
		ImageAlt:          &blank,
		CTALabel:          &blank,
		CTAHref:           &blank,
		SecondaryCTALabel: &blank,
		SecondaryCTAHref:  &blank,
		IsActive:          &inactive,
	})
	if err != nil {
		t.Fatalf("inactive draft create: %v", err)
	}
	if created.Title != "Draft" || created.ImageURL != nil || created.IsActive {
		t.Fatalf("created draft = %+v; want normalized inactive draft", created)
	}
	if created.Eyebrow != nil || created.Subtitle != nil || created.Badge != nil ||
		created.MobileImageURL != nil || created.ImageAlt != nil ||
		created.CTALabel != nil || created.CTAHref != nil ||
		created.SecondaryCTALabel != nil || created.SecondaryCTAHref != nil {
		t.Fatalf("created optional fields were not normalized to nil: %+v", created)
	}
}

func TestHeroSlideCreateValidatesMergedPublicationFields(t *testing.T) {
	repo := &heroSlideRepositoryStub{}
	service := NewService(repo, nil)
	inactive := false
	start := time.Date(2026, 8, 1, 12, 0, 0, 0, time.UTC)
	label := "Shop"

	_, err := service.Create(context.Background(), &HeroSlideReq{
		Title:    "Draft",
		CTALabel: &label,
		IsActive: &inactive,
		StartsAt: &start,
		EndsAt:   &start,
	})
	requireHeroValidationField(t, err, "cta_href")
	requireHeroValidationField(t, err, "ends_at")
	if repo.created != nil {
		t.Fatal("invalid publication state reached repository")
	}
}

func TestHeroSlideCreateValidatesAtDatabaseTimestampPrecision(t *testing.T) {
	repo := &heroSlideRepositoryStub{}
	service := NewService(repo, nil)
	inactive := false
	start := time.Date(2026, 8, 1, 12, 0, 0, 0, time.UTC)
	end := start.Add(time.Nanosecond)

	_, err := service.Create(context.Background(), &HeroSlideReq{
		Title:    "Draft",
		IsActive: &inactive,
		StartsAt: &start,
		EndsAt:   &end,
	})
	requireHeroValidationField(t, err, "ends_at")
	if repo.created != nil {
		t.Fatal("sub-microsecond schedule reached repository")
	}
}

func TestHeroSlideUpdateMapsConcurrentConstraintFailuresToValidation(t *testing.T) {
	repo := &heroSlideRepositoryStub{
		current:   &HeroSlide{ID: 12, Title: "Slide", Theme: "dark"},
		updateErr: models.ErrHeroSchedule,
	}
	service := NewService(repo, nil)

	_, err := service.Update(context.Background(), 12, &HeroSlideUpdateReq{})
	requireHeroValidationField(t, err, "ends_at")
}

func TestHeroSlideCreateRejectsUnsafeHref(t *testing.T) {
	repo := &heroSlideRepositoryStub{}
	service := NewService(repo, nil)
	inactive := false
	label := "Shop"
	href := "javascript:alert(1)"

	_, err := service.Create(context.Background(), &HeroSlideReq{
		Title:    "Draft",
		CTALabel: &label,
		CTAHref:  &href,
		IsActive: &inactive,
	})
	requireHeroValidationField(t, err, "cta_href")
	if repo.created != nil {
		t.Fatal("unsafe CTA href reached repository")
	}
}

func TestHeroSlideHrefValidation(t *testing.T) {
	tests := []struct {
		value string
		want  bool
	}{
		{value: "/", want: true},
		{value: "/products?sort=discount#sale", want: true},
		{value: "https://example.com", want: true},
		{value: "HTTPS://example.com/journal", want: true},
		{value: "products"},
		{value: "//example.com/products"},
		{value: "/%2Fexample.com/products"},
		{value: "http://example.com/products"},
		{value: "javascript:alert(1)"},
		{value: "data:text/html,unsafe"},
		{value: "https://user:pass@example.com/products"},
		{value: "https:///missing-host"},
		{value: `/products\unsafe`},
		{value: `/products%5Cunsafe`},
		{value: `/products%00unsafe`},
		{value: "/products\nunsafe"},
	}
	for _, tt := range tests {
		t.Run(tt.value, func(t *testing.T) {
			if got := validHeroHref(tt.value); got != tt.want {
				t.Fatalf("validHeroHref(%q) = %v; want %v", tt.value, got, tt.want)
			}
		})
	}
}

func TestHeroSlideUpdateRequiresMediaBeforeActivation(t *testing.T) {
	repo := &heroSlideRepositoryStub{current: &HeroSlide{ID: 7, Title: "Draft", Theme: "dark"}}
	service := NewService(repo, nil)
	active := true

	if _, err := service.Update(context.Background(), 7, &HeroSlideUpdateReq{IsActive: &active}); err == nil {
		t.Fatal("draft activation succeeded; want validation error")
	} else {
		requireHeroValidationField(t, err, "image_url")
	}
	if repo.updated != nil {
		t.Fatal("invalid activation reached repository update")
	}

	imageURL := "/images/hero/desktop.webp"
	updated, err := service.Update(context.Background(), 7, &HeroSlideUpdateReq{
		ImageURL: models.NullablePatch[string]{Set: true, Value: &imageURL},
		IsActive: &active,
	})
	if err != nil {
		t.Fatalf("activation with media: %v", err)
	}
	if updated.ImageURL == nil || *updated.ImageURL != imageURL || !updated.IsActive {
		t.Fatalf("updated slide = %+v; want active with media", updated)
	}
}

func TestHeroSlideUpdateClearsOrdinaryNullableFields(t *testing.T) {
	value := "Existing"
	start := time.Date(2026, 8, 1, 12, 0, 0, 0, time.UTC)
	end := start.Add(time.Hour)
	repo := &heroSlideRepositoryStub{current: &HeroSlide{
		ID:                8,
		Title:             "Slide",
		Eyebrow:           &value,
		Subtitle:          &value,
		Badge:             &value,
		ImageURL:          heroTestString("/images/hero/desktop.webp"),
		CTALabel:          &value,
		CTAHref:           heroTestString("/products"),
		SecondaryCTALabel: &value,
		SecondaryCTAHref:  heroTestString("https://example.com/journal"),
		Theme:             "dark",
		IsActive:          true,
		StartsAt:          &start,
		EndsAt:            &end,
	}}
	service := NewService(repo, nil)
	blank := "   "
	clearString := models.NullablePatch[string]{Set: true}
	clearTime := models.NullablePatch[time.Time]{Set: true}

	updated, err := service.Update(context.Background(), 8, &HeroSlideUpdateReq{
		Eyebrow:           models.NullablePatch[string]{Set: true, Value: &blank},
		Subtitle:          clearString,
		Badge:             clearString,
		CTALabel:          clearString,
		CTAHref:           clearString,
		SecondaryCTALabel: clearString,
		SecondaryCTAHref:  clearString,
		StartsAt:          clearTime,
		EndsAt:            clearTime,
	})
	if err != nil {
		t.Fatalf("clear nullable fields: %v", err)
	}
	if updated.Eyebrow != nil || updated.Subtitle != nil || updated.Badge != nil ||
		updated.CTALabel != nil || updated.CTAHref != nil ||
		updated.SecondaryCTALabel != nil || updated.SecondaryCTAHref != nil ||
		updated.StartsAt != nil || updated.EndsAt != nil {
		t.Fatalf("updated nullable fields were not cleared: %+v", updated)
	}
	if updated.ImageURL == nil || *updated.ImageURL != "/images/hero/desktop.webp" {
		t.Fatalf("omitted image_url changed: %+v", updated.ImageURL)
	}
}

func TestHeroSlideUpdateValidatesMergedCTAPair(t *testing.T) {
	repo := &heroSlideRepositoryStub{current: &HeroSlide{
		ID:       9,
		Title:    "Slide",
		ImageURL: heroTestString("/images/hero/desktop.webp"),
		CTALabel: heroTestString("Shop"),
		CTAHref:  heroTestString("/products"),
		Theme:    "dark",
		IsActive: true,
	}}
	service := NewService(repo, nil)

	_, err := service.Update(context.Background(), 9, &HeroSlideUpdateReq{
		CTAHref: models.NullablePatch[string]{Set: true},
	})
	requireHeroValidationField(t, err, "cta_href")
	if repo.updated != nil {
		t.Fatal("incomplete merged CTA reached repository")
	}
}

func TestHeroSlideUpdateAllowsClearAndDeactivateTogether(t *testing.T) {
	imageURL := "/images/hero/desktop.webp"
	repo := &heroSlideRepositoryStub{current: &HeroSlide{
		ID:       10,
		Title:    "Slide",
		ImageURL: &imageURL,
		Theme:    "dark",
		IsActive: true,
	}}
	service := NewService(repo, nil)
	inactive := false

	updated, err := service.Update(context.Background(), 10, &HeroSlideUpdateReq{
		ImageURL: models.NullablePatch[string]{Set: true},
		IsActive: &inactive,
	})
	if err != nil {
		t.Fatalf("clear and deactivate: %v", err)
	}
	if updated.ImageURL != nil || updated.IsActive {
		t.Fatalf("updated slide = %+v; want inactive without image", updated)
	}
	if repo.updated == nil || !repo.updated.ExpectedImageURL.Set ||
		repo.updated.ExpectedImageURL.Value == nil || *repo.updated.ExpectedImageURL.Value != imageURL {
		t.Fatalf("desktop media expectation = %+v; want current URL", repo.updated)
	}
}

func TestHeroSlideReorderValidatesPermutationInput(t *testing.T) {
	tests := []struct {
		name string
		ids  []int64
	}{
		{name: "empty"},
		{name: "non-positive", ids: []int64{1, 0}},
		{name: "duplicate", ids: []int64{1, 1}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &heroSlideRepositoryStub{}
			service := NewService(repo, nil)
			err := service.Reorder(context.Background(), tt.ids)
			requireHeroValidationField(t, err, "ids")
			if repo.reordered != nil {
				t.Fatalf("invalid IDs reached repository: %v", repo.reordered)
			}
		})
	}

	repo := &heroSlideRepositoryStub{reorderErr: models.ErrInvalidState}
	service := NewService(repo, nil)
	requireHeroValidationField(t, service.Reorder(context.Background(), []int64{2, 1}), "ids")

	repo.reorderErr = nil
	want := []int64{3, 1, 2}
	if err := service.Reorder(context.Background(), want); err != nil {
		t.Fatalf("valid reorder: %v", err)
	}
	if !reflect.DeepEqual(repo.reordered, want) {
		t.Fatalf("reordered IDs = %v; want %v", repo.reordered, want)
	}
}

func requireHeroValidationField(t *testing.T, err error, field string) {
	t.Helper()
	if !errors.Is(err, apperr.ErrValidation) {
		t.Fatalf("error = %v; want validation error", err)
	}
	fields, ok := apperr.Fields(err)
	if !ok || len(fields[field]) == 0 {
		t.Fatalf("validation fields = %#v; want %q", fields, field)
	}
}

func heroTestString(value string) *string { return &value }

type heroSlideRepositoryStub struct {
	current    *HeroSlide
	created    *HeroSlideReq
	updated    *HeroSlideUpdateReq
	reordered  []int64
	reorderErr error
	updateErr  error
}

func (r *heroSlideRepositoryStub) GetActive(context.Context) ([]*HeroSlide, error) {
	return nil, nil
}

func (r *heroSlideRepositoryStub) GetAll(context.Context) ([]*HeroSlide, error) {
	return nil, nil
}

func (r *heroSlideRepositoryStub) GetByID(context.Context, int64) (*HeroSlide, error) {
	if r.current == nil {
		return nil, models.ErrNotFound
	}
	copy := *r.current
	return &copy, nil
}

func (r *heroSlideRepositoryStub) Create(_ context.Context, req *HeroSlideReq) (*HeroSlide, error) {
	r.created = req
	active := req.IsActive == nil || *req.IsActive
	theme := "dark"
	if req.Theme != nil {
		theme = *req.Theme
	}
	return &HeroSlide{
		ID:                1,
		Eyebrow:           req.Eyebrow,
		Title:             req.Title,
		Subtitle:          req.Subtitle,
		Badge:             req.Badge,
		ImageURL:          req.ImageURL,
		MobileImageURL:    req.MobileImageURL,
		ImageAlt:          req.ImageAlt,
		CTALabel:          req.CTALabel,
		CTAHref:           req.CTAHref,
		SecondaryCTALabel: req.SecondaryCTALabel,
		SecondaryCTAHref:  req.SecondaryCTAHref,
		Theme:             theme,
		IsActive:          active,
		StartsAt:          req.StartsAt,
		EndsAt:            req.EndsAt,
	}, nil
}

func (r *heroSlideRepositoryStub) Update(_ context.Context, id int64, req *HeroSlideUpdateReq) (*HeroSlide, error) {
	r.updated = req
	if r.updateErr != nil {
		return nil, r.updateErr
	}
	current := *r.current
	current.ID = id
	current.Eyebrow = heroPatchedValue(current.Eyebrow, req.Eyebrow)
	if req.Title != nil {
		current.Title = *req.Title
	}
	current.Subtitle = heroPatchedValue(current.Subtitle, req.Subtitle)
	current.Badge = heroPatchedValue(current.Badge, req.Badge)
	current.ImageURL = heroPatchedValue(current.ImageURL, req.ImageURL)
	current.MobileImageURL = heroPatchedValue(current.MobileImageURL, req.MobileImageURL)
	current.ImageAlt = heroPatchedValue(current.ImageAlt, req.ImageAlt)
	current.CTALabel = heroPatchedValue(current.CTALabel, req.CTALabel)
	current.CTAHref = heroPatchedValue(current.CTAHref, req.CTAHref)
	current.SecondaryCTALabel = heroPatchedValue(current.SecondaryCTALabel, req.SecondaryCTALabel)
	current.SecondaryCTAHref = heroPatchedValue(current.SecondaryCTAHref, req.SecondaryCTAHref)
	if req.Theme != nil {
		current.Theme = *req.Theme
	}
	if req.SortOrder != nil {
		current.SortOrder = *req.SortOrder
	}
	if req.IsActive != nil {
		current.IsActive = *req.IsActive
	}
	current.StartsAt = heroPatchedValue(current.StartsAt, req.StartsAt)
	current.EndsAt = heroPatchedValue(current.EndsAt, req.EndsAt)
	r.current = &current
	return &current, nil
}

func (r *heroSlideRepositoryStub) Reorder(_ context.Context, ids []int64) error {
	r.reordered = append([]int64(nil), ids...)
	return r.reorderErr
}

func (r *heroSlideRepositoryStub) Delete(context.Context, int64) error { return nil }

package services

import (
	"context"
	"errors"
	"testing"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

func TestHeroSlideCreateAllowsOnlyInactiveMediaLessDraft(t *testing.T) {
	repo := &heroSlideRepositoryStub{}
	service := NewHeroSlideService(repo)

	if _, err := service.Create(context.Background(), &models.HeroSlideReq{Title: "Active"}); !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("active media-less create error = %v; want invalid request", err)
	}
	if repo.created != nil {
		t.Fatal("active media-less slide reached repository")
	}

	inactive := false
	created, err := service.Create(context.Background(), &models.HeroSlideReq{
		Title:    "Draft",
		IsActive: &inactive,
	})
	if err != nil {
		t.Fatalf("inactive draft create: %v", err)
	}
	if created.ImageURL != nil || created.IsActive {
		t.Fatalf("created draft = %+v; want nil image and inactive", created)
	}
}

func TestHeroSlideUpdateRequiresMediaBeforeActivation(t *testing.T) {
	repo := &heroSlideRepositoryStub{current: &models.HeroSlide{ID: 7, Title: "Draft"}}
	service := NewHeroSlideService(repo)
	active := true

	if _, err := service.Update(context.Background(), 7, &models.HeroSlideUpdateReq{IsActive: &active}); !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("draft activation error = %v; want invalid request", err)
	}
	if repo.updated != nil {
		t.Fatal("invalid activation reached repository update")
	}

	imageURL := "/images/hero/desktop.webp"
	updated, err := service.Update(context.Background(), 7, &models.HeroSlideUpdateReq{
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

type heroSlideRepositoryStub struct {
	current *models.HeroSlide
	created *models.HeroSlideReq
	updated *models.HeroSlideUpdateReq
}

func (r *heroSlideRepositoryStub) GetActive(context.Context) ([]*models.HeroSlide, error) {
	return nil, nil
}

func (r *heroSlideRepositoryStub) GetAll(context.Context) ([]*models.HeroSlide, error) {
	return nil, nil
}

func (r *heroSlideRepositoryStub) GetByID(context.Context, int64) (*models.HeroSlide, error) {
	if r.current == nil {
		return nil, models.ErrNotFound
	}
	copy := *r.current
	return &copy, nil
}

func (r *heroSlideRepositoryStub) Create(_ context.Context, req *models.HeroSlideReq) (*models.HeroSlide, error) {
	r.created = req
	active := req.IsActive == nil || *req.IsActive
	return &models.HeroSlide{ID: 1, Title: req.Title, ImageURL: req.ImageURL, IsActive: active}, nil
}

func (r *heroSlideRepositoryStub) Update(_ context.Context, id int64, req *models.HeroSlideUpdateReq) (*models.HeroSlide, error) {
	r.updated = req
	current := *r.current
	current.ID = id
	if req.ImageURL.Set {
		current.ImageURL = req.ImageURL.Value
	}
	if req.IsActive != nil {
		current.IsActive = *req.IsActive
	}
	r.current = &current
	return &current, nil
}

func (r *heroSlideRepositoryStub) Delete(context.Context, int64) error { return nil }

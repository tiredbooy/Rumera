package services

import (
	"context"
	"testing"

	"github.com/tiredbooy/internal/models"
)

type brandServiceRepo struct {
	createdReq models.CreateBrandReq
	gotSlug    string
}

func (r *brandServiceRepo) Create(_ context.Context, req models.CreateBrandReq) (*models.Brand, error) {
	r.createdReq = req
	return &models.Brand{ID: 1, Title: req.Title, Slug: *req.Slug}, nil
}

func (r *brandServiceRepo) GetByID(context.Context, int64) (*models.Brand, error) {
	return &models.Brand{ID: 1, Title: "Jack Daniel", Slug: "jack-daniel"}, nil
}

func (r *brandServiceRepo) GetBySlug(_ context.Context, slug string) (*models.Brand, error) {
	r.gotSlug = slug
	return &models.Brand{ID: 1, Title: "Jack Daniel", Slug: slug}, nil
}

func (r *brandServiceRepo) GetAll(context.Context, models.BrandFilter) ([]*models.Brand, int64, error) {
	return nil, 0, nil
}

func (r *brandServiceRepo) Update(_ context.Context, _ int64, req models.UpdateBrandReq) (*models.Brand, error) {
	return &models.Brand{ID: 1, Title: "Jack Daniel", Slug: "jack-daniel"}, nil
}

func (r *brandServiceRepo) Delete(context.Context, int64) error { return nil }

func (r *brandServiceRepo) ExistsByTitle(context.Context, string) (bool, error) {
	return false, nil
}

func (r *brandServiceRepo) ExistsBySlug(context.Context, string, int64) (bool, error) {
	return false, nil
}

func TestBrandServiceCreateGeneratesCanonicalSlug(t *testing.T) {
	repo := &brandServiceRepo{}
	brand, err := NewBrandService(repo).Create(
		context.Background(),
		models.CreateBrandReq{Title: "  Jack Daniel  "},
	)
	if err != nil {
		t.Fatalf("create brand: %v", err)
	}
	if repo.createdReq.Title != "Jack Daniel" || repo.createdReq.Slug == nil || *repo.createdReq.Slug != "jack-daniel" {
		t.Fatalf("persisted brand = %+v", repo.createdReq)
	}
	if brand.Slug != "jack-daniel" {
		t.Fatalf("brand slug = %q", brand.Slug)
	}
}

func TestBrandServiceGetBySlugNormalizesPublicKey(t *testing.T) {
	repo := &brandServiceRepo{}
	brand, err := NewBrandService(repo).GetBySlug(context.Background(), "  Jack Daniel  ")
	if err != nil {
		t.Fatalf("get brand by slug: %v", err)
	}
	if repo.gotSlug != "jack-daniel" || brand.Slug != "jack-daniel" {
		t.Fatalf("slug lookup = %q, brand = %+v", repo.gotSlug, brand)
	}
}

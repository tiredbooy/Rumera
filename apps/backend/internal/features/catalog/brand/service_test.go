package brand

import (
	"context"
	"testing"
)

type brandServiceRepo struct {
	createdReq CreateBrandReq
	gotSlug    string
}

func (r *brandServiceRepo) Create(_ context.Context, req CreateBrandReq) (*Brand, error) {
	r.createdReq = req
	return &Brand{ID: 1, Title: req.Title, Slug: *req.Slug}, nil
}

func (r *brandServiceRepo) GetByID(context.Context, int64) (*Brand, error) {
	return &Brand{ID: 1, Title: "Jack Daniel", Slug: "jack-daniel"}, nil
}

func (r *brandServiceRepo) GetBySlug(_ context.Context, slug string) (*Brand, error) {
	r.gotSlug = slug
	return &Brand{ID: 1, Title: "Jack Daniel", Slug: slug}, nil
}

func (r *brandServiceRepo) GetAll(context.Context, BrandFilter) ([]*Brand, int64, error) {
	return nil, 0, nil
}

func (r *brandServiceRepo) Update(_ context.Context, _ int64, req UpdateBrandReq) (*Brand, error) {
	return &Brand{ID: 1, Title: "Jack Daniel", Slug: "jack-daniel"}, nil
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
	brand, err := NewService(repo).Create(
		context.Background(),
		CreateBrandReq{Title: "  Jack Daniel  "},
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
	brand, err := NewService(repo).GetBySlug(context.Background(), "  Jack Daniel  ")
	if err != nil {
		t.Fatalf("get brand by slug: %v", err)
	}
	if repo.gotSlug != "jack-daniel" || brand.Slug != "jack-daniel" {
		t.Fatalf("slug lookup = %q, brand = %+v", repo.gotSlug, brand)
	}
}

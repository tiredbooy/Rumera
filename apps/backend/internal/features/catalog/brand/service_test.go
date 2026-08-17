package brand

import (
	"context"
	"errors"
	"testing"

	"github.com/tiredbooy/internal/models"
)

type brandServiceRepo struct {
	createdReq     CreateBrandReq
	gotSlug        string
	updatedID      int64
	updatedReq     UpdateBrandReq
	titleConflicts map[string]bool
	excludeIDs     []int64
	updateCalls    int
}

func (r *brandServiceRepo) Create(_ context.Context, req CreateBrandReq) (*Brand, error) {
	r.createdReq = req
	return &Brand{ID: 1, Title: req.Title, Slug: *req.Slug}, nil
}

func (r *brandServiceRepo) GetByID(_ context.Context, id int64) (*Brand, error) {
	return &Brand{ID: id, Title: "Jack Daniel", Slug: "jack-daniel"}, nil
}

func (r *brandServiceRepo) GetBySlug(_ context.Context, slug string) (*Brand, error) {
	r.gotSlug = slug
	return &Brand{ID: 1, Title: "Jack Daniel", Slug: slug}, nil
}

func (r *brandServiceRepo) GetAll(context.Context, BrandFilter) ([]*Brand, int64, error) {
	return nil, 0, nil
}

func (r *brandServiceRepo) Update(_ context.Context, id int64, req UpdateBrandReq) (*Brand, error) {
	r.updateCalls++
	r.updatedID = id
	r.updatedReq = req
	b := &Brand{ID: id, Title: "Jack Daniel", Slug: "jack-daniel"}
	if req.Title != nil {
		b.Title = *req.Title
	}
	if req.Slug != nil {
		b.Slug = *req.Slug
	}
	return b, nil
}

func (r *brandServiceRepo) Delete(context.Context, int64) error { return nil }

func (r *brandServiceRepo) ExistsByTitle(_ context.Context, title string, excludeID int64) (bool, error) {
	r.excludeIDs = append(r.excludeIDs, excludeID)
	return r.titleConflicts[title], nil
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
	if len(repo.excludeIDs) != 1 || repo.excludeIDs[0] != 0 {
		t.Fatalf("create title exclude IDs = %v; want [0]", repo.excludeIDs)
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

func TestBrandServiceUpdateSameTitleDoesNotConflict(t *testing.T) {
	repo := &brandServiceRepo{}
	title := "Jack Daniel"
	brand, err := NewService(repo).Update(context.Background(), 1, UpdateBrandReq{Title: &title})
	if errors.Is(err, models.ErrAlreadyExists) {
		t.Fatal("same-title PATCH returned ErrAlreadyExists")
	}
	if err != nil {
		t.Fatalf("update same title: %v", err)
	}
	if repo.updatedID != 1 || brand.Title != "Jack Daniel" || repo.updateCalls != 1 {
		t.Fatalf("updated brand = %+v, id = %d, calls = %d", brand, repo.updatedID, repo.updateCalls)
	}
	if len(repo.excludeIDs) != 1 || repo.excludeIDs[0] != 1 {
		t.Fatalf("update title exclude IDs = %v; want [1]", repo.excludeIDs)
	}
}

func TestBrandServiceUpdateToOtherBrandTitleConflicts(t *testing.T) {
	title := "Glenmore"
	repo := &brandServiceRepo{titleConflicts: map[string]bool{title: true}}
	_, err := NewService(repo).Update(context.Background(), 1, UpdateBrandReq{Title: &title})
	if !errors.Is(err, models.ErrAlreadyExists) {
		t.Fatalf("err = %v; want ErrAlreadyExists", err)
	}
	if repo.updateCalls != 0 {
		t.Fatalf("updates = %d; want none on title conflict", repo.updateCalls)
	}
	if len(repo.excludeIDs) != 1 || repo.excludeIDs[0] != 1 {
		t.Fatalf("update title exclude IDs = %v; want [1]", repo.excludeIDs)
	}
}

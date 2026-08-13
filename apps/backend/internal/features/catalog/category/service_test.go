package category

import (
	"context"
	"errors"
	"testing"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

type categoryServiceRepo struct {
	Repository
	category   *Category
	slugErr    error
	gotSlug    string
	calls      int
	nameExists bool
	slugExists bool
	created    *CreateCategoryReq
}

func (r *categoryServiceRepo) GetBySlug(_ context.Context, slug string) (*Category, error) {
	r.calls++
	r.gotSlug = slug
	if r.slugErr != nil {
		return nil, r.slugErr
	}
	return r.category, nil
}

func (r *categoryServiceRepo) ExistsByName(_ context.Context, _ string, _ int64) (bool, error) {
	return r.nameExists, nil
}

func (r *categoryServiceRepo) ExistsBySlug(_ context.Context, _ string, _ int64) (bool, error) {
	return r.slugExists, nil
}

func (r *categoryServiceRepo) Create(_ context.Context, req CreateCategoryReq) (*Category, error) {
	r.created = &req
	return r.category, nil
}

func TestCategoryServiceGetBySlugNormalizesCanonicalSlug(t *testing.T) {
	slug := "exact-slug"
	repo := &categoryServiceRepo{category: &Category{ID: 9, Slug: &slug}}

	category, err := NewService(repo, nil).GetBySlug(context.Background(), "  Exact--Slug  ")
	if err != nil {
		t.Fatalf("get by slug: %v", err)
	}
	if repo.gotSlug != slug || category.ID != 9 {
		t.Fatalf("slug = %q, category = %+v", repo.gotSlug, category)
	}
}

func TestNormalizePublicSlugKeepsUnicodeAndRemovesPathSeparators(t *testing.T) {
	for input, want := range map[string]string{
		"  Single / Malt? ": "single-malt",
		"ویسکی / ویژه":      "ویسکی-ویژه",
		"---":               "",
	} {
		if got := normalizePublicSlug(input); got != want {
			t.Errorf("normalizePublicSlug(%q) = %q; want %q", input, got, want)
		}
	}
}

func TestCategoryServiceCreateNormalizesAndGuardsSlugIdentity(t *testing.T) {
	repo := &categoryServiceRepo{category: &Category{ID: 12}}
	rawSlug := "  Whisky / Single--Malt?  "

	if _, err := NewService(repo, nil).Create(context.Background(), CreateCategoryReq{
		Title: "  Whisky  ",
		Slug:  &rawSlug,
	}); err != nil {
		t.Fatalf("create category: %v", err)
	}
	if repo.created == nil || repo.created.Title != "Whisky" || repo.created.Slug == nil || *repo.created.Slug != "whisky-single-malt" {
		t.Fatalf("normalized create request = %+v", repo.created)
	}

	conflictRepo := &categoryServiceRepo{slugExists: true}
	if _, err := NewService(conflictRepo, nil).Create(context.Background(), CreateCategoryReq{
		Title: "Another",
		Slug:  &rawSlug,
	}); !errors.Is(err, models.ErrAlreadyExists) {
		t.Fatalf("duplicate slug error = %v; want ErrAlreadyExists", err)
	}
	if conflictRepo.created != nil {
		t.Fatal("duplicate slug reached repository create")
	}
}

func TestCategoryServiceGetBySlugMapsMissingAndBlankToNotFound(t *testing.T) {
	repo := &categoryServiceRepo{slugErr: models.ErrNotFound}
	svc := NewService(repo, nil)

	if _, err := svc.GetBySlug(context.Background(), "missing"); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("missing error = %v; want ErrNotFound", err)
	}
	if _, err := svc.GetBySlug(context.Background(), " \t\n "); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("blank error = %v; want ErrNotFound", err)
	}
	if repo.calls != 1 || repo.gotSlug != "missing" {
		t.Fatalf("repository calls = %d, slug = %q; blank slug must not reach repository", repo.calls, repo.gotSlug)
	}
}

func TestCategoryServiceGetBySlugMapsRepositoryFailure(t *testing.T) {
	repo := &categoryServiceRepo{slugErr: errors.New("database unavailable")}

	if _, err := NewService(repo, nil).GetBySlug(context.Background(), "spirits"); !errors.Is(err, apperr.ErrInternal) {
		t.Fatalf("repository error = %v; want ErrInternal", err)
	}
}

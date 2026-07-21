package services

import (
	"context"
	"errors"
	"testing"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
)

type productServiceRepo struct {
	repositories.ProductRepository
	product      *models.Product
	slugErr      error
	stock        map[int64]int
	stockErr     error
	gotSlug      string
	getAllCalls  int
	getAllFilter models.ProductFilter
}

func (r *productServiceRepo) GetBySlug(_ context.Context, slug string) (*models.Product, error) {
	r.gotSlug = slug
	if r.slugErr != nil {
		return nil, r.slugErr
	}
	return r.product, nil
}

func (r *productServiceRepo) GetVariantAvailableStock(_ context.Context, _ int64) (map[int64]int, error) {
	return r.stock, r.stockErr
}

func (r *productServiceRepo) GetAll(_ context.Context, filter models.ProductFilter) ([]*models.ProductListItem, int64, error) {
	r.getAllCalls++
	r.getAllFilter = filter
	return []*models.ProductListItem{}, 0, nil
}

func TestProductServiceGetBySlugTrimsAndPreservesExactSlug(t *testing.T) {
	slug := "Exact-Slug"
	repo := &productServiceRepo{product: &models.Product{ID: 3, Slug: &slug, IsActive: true}}

	product, err := NewProductService(repo).GetBySlug(context.Background(), "  "+slug+"  ")
	if err != nil {
		t.Fatalf("get by slug: %v", err)
	}
	if repo.gotSlug != slug || product.ID != 3 {
		t.Fatalf("slug = %q, product = %+v", repo.gotSlug, product)
	}
}

func TestProductServiceGetBySlugMapsMissingAndRejectsEmpty(t *testing.T) {
	repo := &productServiceRepo{slugErr: models.ErrNotFound}
	svc := NewProductService(repo)

	if _, err := svc.GetBySlug(context.Background(), "missing"); !errors.Is(err, apperr.ErrProductNotFound) {
		t.Fatalf("missing error = %v; want ErrProductNotFound", err)
	}
	if _, err := svc.GetBySlug(context.Background(), " \t\n "); !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("blank error = %v; want ErrInvalidRequest", err)
	}
	if repo.gotSlug != "missing" {
		t.Fatalf("blank slug reached repository as %q", repo.gotSlug)
	}
}

func TestProductServiceReturnsBatchVariantAvailability(t *testing.T) {
	repo := &productServiceRepo{stock: map[int64]int{4: 0, 5: 7}}

	stock, err := NewProductService(repo).GetVariantAvailableStock(context.Background(), 2)
	if err != nil {
		t.Fatalf("get availability: %v", err)
	}
	if stock[4] != 0 || stock[5] != 7 {
		t.Fatalf("stock = %#v", stock)
	}
}

func TestProductServiceRequiresCategoryForDescendantFilter(t *testing.T) {
	repo := &productServiceRepo{}
	svc := NewProductService(repo)
	filter := models.ProductFilter{
		BaseFilter:         models.BaseFilter{PaginationParams: models.PaginationParams{Page: 1, Limit: 12}},
		IncludeDescendants: true,
	}

	if _, _, err := svc.GetAll(context.Background(), filter); !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("descendant filter without category error = %v; want ErrInvalidRequest", err)
	}
	if repo.getAllCalls != 0 {
		t.Fatalf("repository calls = %d; want 0", repo.getAllCalls)
	}

	categoryID := int64(7)
	filter.CategoryID = &categoryID
	if _, _, err := svc.GetAll(context.Background(), filter); err != nil {
		t.Fatalf("descendant filter with category: %v", err)
	}
	if repo.getAllCalls != 1 || !repo.getAllFilter.IncludeDescendants || repo.getAllFilter.CategoryID == nil || *repo.getAllFilter.CategoryID != categoryID {
		t.Fatalf("forwarded filter = %+v, calls = %d", repo.getAllFilter, repo.getAllCalls)
	}
}

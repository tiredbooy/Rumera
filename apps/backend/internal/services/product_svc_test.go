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
	product       *models.Product
	adminProduct  *models.Product
	slugErr       error
	stock         map[int64]int
	stockErr      error
	gotSlug       string
	getAllCalls   int
	getAllFilter  models.ProductFilter
	slugExists    bool
	codeExists    bool
	slugExcludeID int64
	codeExcludeID int64
	updateCalls   int
	updateID      int64
	updateReq     models.UpdateProductReq
	syncCalls     int
	syncProductID int64
	syncTagIDs    []int64
	deleteErr     error
	deleteID      int64
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

func (r *productServiceRepo) GetByIDForAdmin(context.Context, int64) (*models.Product, error) {
	if r.adminProduct == nil {
		return nil, models.ErrNotFound
	}
	return r.adminProduct, nil
}

func (r *productServiceRepo) ExistsBySlug(_ context.Context, _ string, excludeID int64) (bool, error) {
	r.slugExcludeID = excludeID
	return r.slugExists, nil
}

func (r *productServiceRepo) ExistsByCode(_ context.Context, _ string, excludeID int64) (bool, error) {
	r.codeExcludeID = excludeID
	return r.codeExists, nil
}

func (r *productServiceRepo) Update(_ context.Context, id int64, req models.UpdateProductReq) (*models.Product, error) {
	r.updateCalls++
	r.updateID = id
	r.updateReq = req
	return &models.Product{ID: id}, nil
}

func (r *productServiceRepo) SyncTags(_ context.Context, productID int64, tagIDs []int64) error {
	r.syncCalls++
	r.syncProductID = productID
	r.syncTagIDs = append([]int64(nil), tagIDs...)
	return nil
}

func (r *productServiceRepo) Delete(_ context.Context, id int64) error {
	r.deleteID = id
	return r.deleteErr
}

func TestProductServiceGetBySlugTrimsAndPreservesExactSlug(t *testing.T) {
	slug := "Exact-Slug"
	repo := &productServiceRepo{product: &models.Product{ID: 3, Slug: &slug, IsActive: true}}

	product, err := NewProductService(repo, nil, nil).GetBySlug(context.Background(), "  "+slug+"  ")
	if err != nil {
		t.Fatalf("get by slug: %v", err)
	}
	if repo.gotSlug != slug || product.ID != 3 {
		t.Fatalf("slug = %q, product = %+v", repo.gotSlug, product)
	}
}

func TestProductServiceGetBySlugMapsMissingAndRejectsEmpty(t *testing.T) {
	repo := &productServiceRepo{slugErr: models.ErrNotFound}
	svc := NewProductService(repo, nil, nil)

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

	stock, err := NewProductService(repo, nil, nil).GetVariantAvailableStock(context.Background(), 2)
	if err != nil {
		t.Fatalf("get availability: %v", err)
	}
	if stock[4] != 0 || stock[5] != 7 {
		t.Fatalf("stock = %#v", stock)
	}
}

func TestProductServiceRequiresCategoryForDescendantFilter(t *testing.T) {
	repo := &productServiceRepo{}
	svc := NewProductService(repo, nil, nil)
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

func TestProductServiceGetByIDForAdminIncludesDraft(t *testing.T) {
	repo := &productServiceRepo{adminProduct: &models.Product{ID: 7, Title: "Draft", IsActive: false}}

	product, err := NewProductService(repo, nil, nil).GetByIDForAdmin(context.Background(), 7)
	if err != nil || product.ID != 7 || product.IsActive {
		t.Fatalf("admin draft = %+v, %v", product, err)
	}
}

func TestProductServiceUpdateExcludesCurrentIdentityAndPersistsTags(t *testing.T) {
	slug, code := "same-slug", "SAME-CODE"
	repo := &productServiceRepo{}
	svc := NewProductService(repo, nil, nil)

	_, err := svc.Update(context.Background(), 42, models.UpdateProductReq{
		Slug: &slug, Code: &code, TagIDs: []int64{3, 5},
	})
	if err != nil {
		t.Fatalf("update unchanged identity: %v", err)
	}
	if repo.slugExcludeID != 42 || repo.codeExcludeID != 42 {
		t.Fatalf("identity exclusion = slug %d, code %d; want 42", repo.slugExcludeID, repo.codeExcludeID)
	}
	if repo.updateCalls != 1 || repo.updateID != 42 {
		t.Fatalf("update calls/id = %d/%d; want 1/42", repo.updateCalls, repo.updateID)
	}
	if repo.syncCalls != 1 || repo.syncProductID != 42 || len(repo.syncTagIDs) != 2 || repo.syncTagIDs[0] != 3 || repo.syncTagIDs[1] != 5 {
		t.Fatalf("tag sync = calls %d, product %d, tags %v", repo.syncCalls, repo.syncProductID, repo.syncTagIDs)
	}
}

func TestProductServiceUpdateRejectsIdentityOwnedByAnotherProduct(t *testing.T) {
	slug := "already-owned"
	repo := &productServiceRepo{slugExists: true}

	_, err := NewProductService(repo, nil, nil).Update(
		context.Background(), 42, models.UpdateProductReq{Slug: &slug},
	)
	if !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("conflicting update error = %v; want ErrConflict", err)
	}
	if repo.slugExcludeID != 42 || repo.updateCalls != 0 {
		t.Fatalf("exclusion/update calls = %d/%d; want 42/0", repo.slugExcludeID, repo.updateCalls)
	}
}

func TestProductServiceDeleteMapsProtectedHistoryToConflict(t *testing.T) {
	repo := &productServiceRepo{deleteErr: models.ErrProductHasHistory}

	err := NewProductService(repo, nil, nil).Delete(context.Background(), 42)

	if !errors.Is(err, apperr.ErrProductHasHistory) {
		t.Fatalf("delete error = %v; want ErrProductHasHistory", err)
	}
	if repo.deleteID != 42 {
		t.Fatalf("deleted id = %d; want 42", repo.deleteID)
	}
}

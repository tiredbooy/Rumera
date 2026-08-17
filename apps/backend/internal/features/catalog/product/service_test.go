package product

import (
	"context"
	"errors"
	"testing"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

type productServiceRepo struct {
	Repository
	product       *Product
	adminProduct  *Product
	slugErr       error
	stock         map[int64]int
	stockErr      error
	gotSlug       string
	getAllCalls   int
	getAllFilter  ProductFilter
	slugExists    bool
	codeExists    bool
	slugExcludeID int64
	codeExcludeID int64
	updateCalls   int
	updateID      int64
	updateReq     UpdateProductReq
	syncCalls     int
	syncProductID int64
	syncTagIDs    []int64
	deleteErr     error
	deleteID      int64
	createCalls   int
	createReq     CreateProductReq
}

func (r *productServiceRepo) GetBySlug(_ context.Context, slug string) (*Product, error) {
	r.gotSlug = slug
	if r.slugErr != nil {
		return nil, r.slugErr
	}
	return r.product, nil
}

func (r *productServiceRepo) GetVariantAvailableStock(_ context.Context, _ int64) (map[int64]int, error) {
	return r.stock, r.stockErr
}

func (r *productServiceRepo) GetAll(_ context.Context, filter ProductFilter) ([]*models.ProductListItem, int64, error) {
	r.getAllCalls++
	r.getAllFilter = filter
	return []*models.ProductListItem{}, 0, nil
}

func (r *productServiceRepo) GetByIDForAdmin(context.Context, int64) (*Product, error) {
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

func (r *productServiceRepo) Update(_ context.Context, id int64, req UpdateProductReq) (*Product, error) {
	r.updateCalls++
	r.updateID = id
	r.updateReq = req
	return &Product{ID: id}, nil
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

func (r *productServiceRepo) Create(_ context.Context, req CreateProductReq) (*Product, error) {
	r.createCalls++
	r.createReq = req
	return &Product{ID: 1, Title: req.Title, Slug: req.Slug, IsActive: true}, nil
}

func TestProductServiceGetBySlugNormalizesCanonicalSlug(t *testing.T) {
	slug := "exact-slug"
	repo := &productServiceRepo{product: &Product{ID: 3, Slug: &slug, IsActive: true}}

	product, err := NewService(repo, nil, nil).GetBySlug(context.Background(), "  Exact--Slug  ")
	if err != nil {
		t.Fatalf("get by slug: %v", err)
	}
	if repo.gotSlug != slug || product.ID != 3 {
		t.Fatalf("slug = %q, product = %+v", repo.gotSlug, product)
	}
}

func TestProductServiceGetBySlugMapsMissingAndRejectsEmpty(t *testing.T) {
	repo := &productServiceRepo{slugErr: models.ErrNotFound}
	svc := NewService(repo, nil, nil)

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

	stock, err := NewService(repo, nil, nil).GetVariantAvailableStock(context.Background(), 2)
	if err != nil {
		t.Fatalf("get availability: %v", err)
	}
	if stock[4] != 0 || stock[5] != 7 {
		t.Fatalf("stock = %#v", stock)
	}
}

func TestProductServiceRequiresCategoryForDescendantFilter(t *testing.T) {
	repo := &productServiceRepo{}
	svc := NewService(repo, nil, nil)
	filter := ProductFilter{
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
	repo := &productServiceRepo{adminProduct: &Product{ID: 7, Title: "Draft", IsActive: false}}

	product, err := NewService(repo, nil, nil).GetByIDForAdmin(context.Background(), 7)
	if err != nil || product.ID != 7 || product.IsActive {
		t.Fatalf("admin draft = %+v, %v", product, err)
	}
}

func TestProductServiceUpdateExcludesCurrentIdentityAndPersistsTags(t *testing.T) {
	slug, code := "same-slug", "SAME-CODE"
	repo := &productServiceRepo{}
	svc := NewService(repo, nil, nil)

	_, err := svc.Update(context.Background(), 42, UpdateProductReq{
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

	_, err := NewService(repo, nil, nil).Update(
		context.Background(), 42, UpdateProductReq{Slug: &slug},
	)
	if !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("conflicting update error = %v; want ErrConflict", err)
	}
	if repo.slugExcludeID != 42 || repo.updateCalls != 0 {
		t.Fatalf("exclusion/update calls = %d/%d; want 42/0", repo.slugExcludeID, repo.updateCalls)
	}
}

func TestProductServiceCreateSlugifiesAndRequiresSlug(t *testing.T) {
	repo := &productServiceRepo{}
	raw := "  Highland / Single--Malt?  "

	created, err := NewService(repo, nil, nil).Create(context.Background(), CreateProductReq{
		Title: "Highland Single Malt",
		Slug:  &raw,
	})
	if err != nil {
		t.Fatalf("create with slug: %v", err)
	}
	if repo.createCalls != 1 || repo.createReq.Slug == nil || *repo.createReq.Slug != "highland-single-malt" {
		t.Fatalf("create request = %+v", repo.createReq)
	}
	if created.Slug == nil || *created.Slug != "highland-single-malt" {
		t.Fatalf("created slug = %+v", created.Slug)
	}

	missingRepo := &productServiceRepo{}
	_, err = NewService(missingRepo, nil, nil).Create(context.Background(), CreateProductReq{Title: "Draft"})
	assertProductSlugValidation(t, err, errMsgActiveProductNeedsSlug)
	if missingRepo.createCalls != 0 {
		t.Fatal("create without slug reached repository")
	}

	garbage := "---"
	garbageRepo := &productServiceRepo{}
	_, err = NewService(garbageRepo, nil, nil).Create(context.Background(), CreateProductReq{
		Title: "Draft",
		Slug:  &garbage,
	})
	assertProductSlugValidation(t, err, errMsgInvalidPublicSlug)
	if garbageRepo.createCalls != 0 {
		t.Fatal("create with invalid slug reached repository")
	}
}

func TestProductServiceUpdateSlugifiesSubmittedSlug(t *testing.T) {
	repo := &productServiceRepo{}
	raw := "  Whisky / Cask?  "

	_, err := NewService(repo, nil, nil).Update(context.Background(), 42, UpdateProductReq{Slug: &raw})
	if err != nil {
		t.Fatalf("update slug: %v", err)
	}
	if repo.updateCalls != 1 || repo.updateReq.Slug == nil || *repo.updateReq.Slug != "whisky-cask" {
		t.Fatalf("update request = %+v", repo.updateReq)
	}
}

func TestProductServiceUpdateActivateWithoutSlugRejected(t *testing.T) {
	active := true
	repo := &productServiceRepo{adminProduct: &Product{ID: 42, Title: "Draft", IsActive: false}}

	_, err := NewService(repo, nil, nil).Update(context.Background(), 42, UpdateProductReq{IsActive: &active})
	assertProductSlugValidation(t, err, errMsgActiveProductNeedsSlug)
	if repo.updateCalls != 0 {
		t.Fatal("activate without slug reached repository")
	}

	slug := "existing-slug"
	okRepo := &productServiceRepo{adminProduct: &Product{ID: 42, Slug: &slug, IsActive: false}}
	if _, err := NewService(okRepo, nil, nil).Update(context.Background(), 42, UpdateProductReq{IsActive: &active}); err != nil {
		t.Fatalf("activate with existing slug: %v", err)
	}
	if okRepo.updateCalls != 1 {
		t.Fatalf("update calls = %d; want 1", okRepo.updateCalls)
	}

	inactive := false
	draftRepo := &productServiceRepo{}
	if _, err := NewService(draftRepo, nil, nil).Update(context.Background(), 42, UpdateProductReq{IsActive: &inactive}); err != nil {
		t.Fatalf("deactivate without slug: %v", err)
	}
	if draftRepo.updateCalls != 1 {
		t.Fatalf("deactivate update calls = %d; want 1", draftRepo.updateCalls)
	}
}

func TestProductServiceUpdateRejectsEmptySlug(t *testing.T) {
	empty := "   "
	repo := &productServiceRepo{}

	_, err := NewService(repo, nil, nil).Update(context.Background(), 42, UpdateProductReq{Slug: &empty})
	assertProductSlugValidation(t, err, errMsgInvalidPublicSlug)
	if repo.updateCalls != 0 {
		t.Fatal("empty slug reached repository")
	}
}

func assertProductSlugValidation(t *testing.T, err error, want string) {
	t.Helper()
	if !errors.Is(err, apperr.ErrValidation) {
		t.Fatalf("error = %v; want ErrValidation", err)
	}
	fields, ok := apperr.Fields(err)
	if !ok || len(fields["slug"]) == 0 || fields["slug"][0] != want {
		t.Fatalf("slug fields = %#v; want %q", fields, want)
	}
}

func TestProductServiceDeleteMapsProtectedHistoryToConflict(t *testing.T) {
	repo := &productServiceRepo{deleteErr: models.ErrProductHasHistory}

	err := NewService(repo, nil, nil).Delete(context.Background(), 42)

	if !errors.Is(err, apperr.ErrProductHasHistory) {
		t.Fatalf("delete error = %v; want ErrProductHasHistory", err)
	}
	if repo.deleteID != 42 {
		t.Fatalf("deleted id = %d; want 42", repo.deleteID)
	}
}

package recipes

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/tiredbooy/internal/mocks"
	"github.com/tiredbooy/internal/models"
)

type recipeBeginnerStub struct{ tx pgx.Tx }

func (b recipeBeginnerStub) Begin(context.Context) (pgx.Tx, error) { return b.tx, nil }

// minimalRepoStub implements Repository for atomicity service tests.
type minimalRepoStub struct {
	txRepo            Repository
	withTxCalls       int
	create            func(*RecipeReq) (*Recipe, error)
	createIngredients func(int64, []*RecipeIngredientReq) error
	assignProducts    func(int64, []*RecipeProductReq) error
	assignTags        func(int64, []int64) error
	slugExists        func(string) (bool, error)
}

func (r *minimalRepoStub) WithTx(pgx.Tx) Repository {
	r.withTxCalls++
	if r.txRepo != nil {
		return r.txRepo
	}
	return r
}

func (r *minimalRepoStub) GetByID(context.Context, int64) (*Recipe, error) {
	return nil, models.ErrNotFound
}
func (r *minimalRepoStub) GetBySlug(context.Context, string) (*Recipe, error) {
	return nil, models.ErrNotFound
}
func (r *minimalRepoStub) GetPublishedBySlug(context.Context, string) (*Recipe, error) {
	return nil, models.ErrNotFound
}
func (r *minimalRepoStub) List(context.Context, RecipeFilter) ([]*Recipe, int64, error) {
	return nil, 0, nil
}
func (r *minimalRepoStub) Create(_ context.Context, req *RecipeReq) (*Recipe, error) {
	if r.create != nil {
		return r.create(req)
	}
	return &Recipe{ID: 1, Title: req.Title, Slug: req.Slug, Status: req.Status}, nil
}
func (r *minimalRepoStub) Update(context.Context, int64, *RecipeUpdateReq) (*Recipe, error) {
	return nil, models.ErrNotFound
}
func (r *minimalRepoStub) Delete(context.Context, int64) error { return nil }
func (r *minimalRepoStub) IncrementViewCount(context.Context, int64) error {
	return nil
}
func (r *minimalRepoStub) PublishedSitemap(context.Context) ([]*RecipeSitemapItem, error) {
	return nil, nil
}
func (r *minimalRepoStub) SlugExists(_ context.Context, slug string) (bool, error) {
	if r.slugExists != nil {
		return r.slugExists(slug)
	}
	return false, nil
}
func (r *minimalRepoStub) GetIngredientsByRecipeID(context.Context, int64) ([]*RecipeIngredient, error) {
	return nil, nil
}
func (r *minimalRepoStub) CreateIngredient(context.Context, int64, *RecipeIngredientReq) (*RecipeIngredient, error) {
	return nil, nil
}
func (r *minimalRepoStub) CreateIngredients(_ context.Context, id int64, reqs []*RecipeIngredientReq) ([]*RecipeIngredient, error) {
	if r.createIngredients != nil {
		if err := r.createIngredients(id, reqs); err != nil {
			return nil, err
		}
	}
	return nil, nil
}
func (r *minimalRepoStub) UpdateIngredient(context.Context, int64, *RecipeIngredientReq) (*RecipeIngredient, error) {
	return nil, nil
}
func (r *minimalRepoStub) DeleteIngredient(context.Context, int64) error { return nil }
func (r *minimalRepoStub) DeleteIngredientsByRecipeID(context.Context, int64) error {
	return nil
}
func (r *minimalRepoStub) GetProductsByRecipeID(context.Context, int64) ([]*RecipeProduct, error) {
	return nil, nil
}
func (r *minimalRepoStub) GetShoppableProducts(context.Context, int64) ([]*ShoppableProduct, error) {
	return nil, nil
}
func (r *minimalRepoStub) AssignProducts(_ context.Context, id int64, reqs []*RecipeProductReq) error {
	if r.assignProducts != nil {
		return r.assignProducts(id, reqs)
	}
	return nil
}
func (r *minimalRepoStub) RemoveProducts(context.Context, int64) error { return nil }
func (r *minimalRepoStub) GetRecipeCardsByProductID(context.Context, int64, int) ([]*Recipe, error) {
	return nil, nil
}
func (r *minimalRepoStub) GetTagsByRecipeID(context.Context, int64) ([]*RecipeTagInfo, error) {
	return nil, nil
}
func (r *minimalRepoStub) GetTagIDsByRecipeID(context.Context, int64) ([]int64, error) {
	return nil, nil
}
func (r *minimalRepoStub) AssignTags(_ context.Context, id int64, ids []int64) error {
	if r.assignTags != nil {
		return r.assignTags(id, ids)
	}
	return nil
}
func (r *minimalRepoStub) RemoveTags(context.Context, int64) error { return nil }

func TestRecipeCreateRollsBackWhenRelationFailsOnTxRepo(t *testing.T) {
	tx := &mocks.FakeTx{}
	wantErr := errors.New("product assignment failed")
	txRepo := &minimalRepoStub{
		create: func(req *RecipeReq) (*Recipe, error) {
			return &Recipe{ID: 77, Title: req.Title, Slug: req.Slug, Status: req.Status}, nil
		},
		assignProducts: func(int64, []*RecipeProductReq) error { return wantErr },
	}
	root := &minimalRepoStub{txRepo: txRepo}
	svc := NewService(root, recipeBeginnerStub{tx: tx}, nil)

	_, err := svc.Create(context.Background(), &RecipeReq{
		Title:  "Old Fashioned",
		Slug:   "old-fashioned",
		Status: RecipeStatusDraft,
		Products: []*RecipeProductReq{
			{ProductVariantID: 9},
		},
	})
	if !errors.Is(err, wantErr) {
		t.Fatalf("Create error = %v, want relation failure", err)
	}
	if root.withTxCalls != 1 {
		t.Fatalf("WithTx calls = %d, want 1", root.withTxCalls)
	}
	if tx.Committed || !tx.RolledBack {
		t.Fatalf("tx state committed=%v rolledBack=%v", tx.Committed, tx.RolledBack)
	}
}

func TestRecipeCreateCommitsWhenRelationsSucceed(t *testing.T) {
	tx := &mocks.FakeTx{}
	txRepo := &minimalRepoStub{
		create: func(req *RecipeReq) (*Recipe, error) {
			return &Recipe{ID: 3, Title: req.Title, Slug: req.Slug, Status: req.Status}, nil
		},
	}
	// hydrate needs GetIngredients etc. on root after commit — hydrate uses s.repo not txRepo
	root := &minimalRepoStub{
		txRepo: txRepo,
		// hydrate after commit loads from root
	}
	// Override GetByID on root for hydrate path if needed — hydrate uses getIngredients on s.repo
	svc := NewService(root, recipeBeginnerStub{tx: tx}, nil)

	// Create will call hydrate(ctx, func() (*Recipe, error) { return recipe, nil })
	// which still uses s.repo for relations — empty is fine
	result, err := svc.Create(context.Background(), &RecipeReq{
		Title:  "Negroni",
		Slug:   "negroni",
		Status: RecipeStatusDraft,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if result == nil || result.ID != 3 {
		t.Fatalf("result = %+v", result)
	}
	if !tx.Committed {
		t.Fatal("expected commit")
	}
	if root.withTxCalls != 1 {
		t.Fatalf("WithTx calls = %d, want 1", root.withTxCalls)
	}
}

package recipes

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/tiredbooy/internal/mocks"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

type recipeBeginnerStub struct{ tx pgx.Tx }

func (b recipeBeginnerStub) Begin(context.Context) (pgx.Tx, error) { return b.tx, nil }

// minimalRepoStub implements Repository for atomicity service tests.
type minimalRepoStub struct {
	txRepo            Repository
	withTxCalls       int
	getByID           func(int64) (*Recipe, error)
	create            func(*RecipeReq) (*Recipe, error)
	update            func(int64, *RecipeUpdateReq) (*Recipe, error)
	createIngredients func(int64, []*RecipeIngredientReq) error
	assignProducts    func(int64, []*RecipeProductReq) error
	assignTags        func(int64, []int64) error
	slugExists        func(string) (bool, error)

	// Slug redirect record (CE-7). Both maps are shared by the root and tx stubs
	// so a rename made under a transaction is visible to resolve assertions.
	redirects map[string]int64 // retired slug -> recipe id
	slugs     map[int64]string // recipe id -> current slug
}

func (r *minimalRepoStub) WithTx(pgx.Tx) Repository {
	r.withTxCalls++
	if r.txRepo != nil {
		return r.txRepo
	}
	return r
}

func (r *minimalRepoStub) GetByID(_ context.Context, id int64) (*Recipe, error) {
	if r.getByID != nil {
		return r.getByID(id)
	}
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
func (r *minimalRepoStub) Update(_ context.Context, id int64, req *RecipeUpdateReq) (*Recipe, error) {
	if r.update != nil {
		return r.update(id, req)
	}
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

func (r *minimalRepoStub) RecordSlugRedirect(_ context.Context, fromSlug string, recipeID int64) error {
	if r.redirects == nil {
		r.redirects = map[string]int64{}
	}
	r.redirects[fromSlug] = recipeID
	return nil
}

func (r *minimalRepoStub) ReleaseSlugRedirect(_ context.Context, slug string) error {
	delete(r.redirects, slug)
	return nil
}

// ResolveSlugRedirect mirrors the SQL: the record holds the recipe id, so the
// answer is always that recipe's current slug — one hop, never a chain.
func (r *minimalRepoStub) ResolveSlugRedirect(_ context.Context, fromSlug string) (string, error) {
	id, ok := r.redirects[fromSlug]
	if !ok {
		return "", models.ErrNotFound
	}
	slug := r.slugs[id]
	if slug == "" || slug == fromSlug {
		return "", models.ErrNotFound
	}
	return slug, nil
}

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

func TestRecipeCreateExplicitSlugConflictIs409(t *testing.T) {
	tx := &mocks.FakeTx{}
	txRepo := &minimalRepoStub{
		slugExists: func(string) (bool, error) { return true, nil },
		create: func(*RecipeReq) (*Recipe, error) {
			t.Fatal("Create must not insert after a taken slug")
			return nil, nil
		},
	}
	svc := NewService(&minimalRepoStub{txRepo: txRepo}, recipeBeginnerStub{tx: tx}, nil)

	_, err := svc.Create(context.Background(), &RecipeReq{
		Title: "Old Fashioned",
		Slug:  "old-fashioned",
	})
	if !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("Create error = %v, want conflict", err)
	}
	if tx.Committed {
		t.Fatal("conflict must not commit")
	}
}

func TestRecipeCreateUniqueViolationIs409(t *testing.T) {
	tx := &mocks.FakeTx{}
	txRepo := &minimalRepoStub{
		create: func(*RecipeReq) (*Recipe, error) {
			return nil, fmt.Errorf("creating recipe: %w", models.ErrConflict)
		},
	}
	svc := NewService(&minimalRepoStub{txRepo: txRepo}, recipeBeginnerStub{tx: tx}, nil)

	_, err := svc.Create(context.Background(), &RecipeReq{
		Title: "Old Fashioned",
		Slug:  "old-fashioned",
	})
	if !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("Create error = %v, want conflict", err)
	}
	if tx.Committed {
		t.Fatal("unique violation must not commit")
	}
}

func TestRecipeCreateDoesNotTreatSlugLookupErrorAsFree(t *testing.T) {
	tx := &mocks.FakeTx{}
	lookupErr := errors.New("slug lookup failed")
	var createdSlug string
	txRepo := &minimalRepoStub{
		slugExists: func(string) (bool, error) { return false, lookupErr },
		create: func(req *RecipeReq) (*Recipe, error) {
			createdSlug = req.Slug
			return &Recipe{ID: 1, Title: req.Title, Slug: req.Slug}, nil
		},
	}
	svc := NewService(&minimalRepoStub{txRepo: txRepo}, recipeBeginnerStub{tx: tx}, nil)

	_, err := svc.Create(context.Background(), &RecipeReq{Title: "Old Fashioned"})
	if !errors.Is(err, lookupErr) {
		t.Fatalf("Create error = %v, want slug lookup failure", err)
	}
	if createdSlug != "" {
		t.Fatalf("create ran with slug %q after lookup error", createdSlug)
	}
	if tx.Committed {
		t.Fatal("lookup error must not commit")
	}
}

func TestRecipeCreateSuffixesGeneratedSlugUnderLock(t *testing.T) {
	tx := &mocks.FakeTx{}
	var persisted string
	txRepo := &minimalRepoStub{
		slugExists: func(slug string) (bool, error) {
			return slug == "old-fashioned", nil
		},
		create: func(req *RecipeReq) (*Recipe, error) {
			persisted = req.Slug
			return &Recipe{ID: 8, Title: req.Title, Slug: req.Slug, Status: req.Status}, nil
		},
	}
	root := &minimalRepoStub{
		txRepo: txRepo,
		slugExists: func(string) (bool, error) {
			t.Fatal("slug check must run on the tx repo after the advisory lock")
			return false, nil
		},
	}
	svc := NewService(root, recipeBeginnerStub{tx: tx}, nil)

	result, err := svc.Create(context.Background(), &RecipeReq{Title: "Old Fashioned"})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if persisted != "old-fashioned-2" || result.Slug != persisted {
		t.Fatalf("persisted/result slugs = %q/%q", persisted, result.Slug)
	}
	if !tx.Committed {
		t.Fatal("expected commit")
	}
}

func TestRecipeUpdateSlugConflictIs409(t *testing.T) {
	tx := &mocks.FakeTx{}
	taken := "negroni"
	txRepo := &minimalRepoStub{
		getByID: func(int64) (*Recipe, error) {
			return &Recipe{ID: 4, Slug: "old-fashioned"}, nil
		},
		slugExists: func(slug string) (bool, error) { return slug == taken, nil },
		update: func(int64, *RecipeUpdateReq) (*Recipe, error) {
			t.Fatal("Update must not write a colliding slug")
			return nil, nil
		},
	}
	svc := NewService(&minimalRepoStub{txRepo: txRepo}, recipeBeginnerStub{tx: tx}, nil)

	_, err := svc.Update(context.Background(), 4, &RecipeUpdateReq{Slug: &taken})
	if !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("Update error = %v, want conflict", err)
	}
	if tx.Committed {
		t.Fatal("conflict must not commit")
	}
}

func TestRecipeUpdateKeepsOwnSlug(t *testing.T) {
	tx := &mocks.FakeTx{}
	own := "old-fashioned"
	txRepo := &minimalRepoStub{
		getByID: func(int64) (*Recipe, error) {
			return &Recipe{ID: 4, Title: "Old Fashioned", Slug: own}, nil
		},
		slugExists: func(slug string) (bool, error) { return slug == own, nil },
		update: func(_ int64, req *RecipeUpdateReq) (*Recipe, error) {
			return &Recipe{ID: 4, Title: "Old Fashioned", Slug: *req.Slug}, nil
		},
	}
	svc := NewService(&minimalRepoStub{txRepo: txRepo}, recipeBeginnerStub{tx: tx}, nil)

	result, err := svc.Update(context.Background(), 4, &RecipeUpdateReq{Slug: &own})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if result.Slug != own {
		t.Fatalf("slug = %q, want own slug", result.Slug)
	}
	if !tx.Committed {
		t.Fatal("expected commit")
	}
}

func TestRecipeUpdateUniqueViolationIs409(t *testing.T) {
	tx := &mocks.FakeTx{}
	next := "old-fashioned-2"
	txRepo := &minimalRepoStub{
		getByID: func(int64) (*Recipe, error) {
			return &Recipe{ID: 4, Slug: "old-fashioned"}, nil
		},
		slugExists: func(string) (bool, error) { return false, nil },
		update: func(int64, *RecipeUpdateReq) (*Recipe, error) {
			return nil, fmt.Errorf("updating recipe: %w", models.ErrConflict)
		},
	}
	svc := NewService(&minimalRepoStub{txRepo: txRepo}, recipeBeginnerStub{tx: tx}, nil)

	_, err := svc.Update(context.Background(), 4, &RecipeUpdateReq{Slug: &next})
	if !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("Update error = %v, want conflict", err)
	}
	if tx.Committed {
		t.Fatal("unique violation must not commit")
	}
}

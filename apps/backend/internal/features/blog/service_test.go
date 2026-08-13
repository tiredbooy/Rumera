package blog

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/tiredbooy/internal/mocks"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

type blogBeginnerStub struct{ tx pgx.Tx }

func (b blogBeginnerStub) Begin(context.Context) (pgx.Tx, error) { return b.tx, nil }

type blogRepositoryStub struct {
	txRepo                Repository
	getByID               func(int64) (*Blog, error)
	create                func(*BlogReq) (*Blog, error)
	update                func(int64, *BlogUpdateReq) (*Blog, error)
	assignCategories      func(int64, []int64) error
	assignProducts        func(int64, []int64) error
	assignTags            func(int64, []int64) error
	getCategories         func(int64) ([]*BlogCategory, error)
	slugExists            func(string) (bool, error)
	removeCategoriesCalls int
	removeProductsCalls   int
	removeTagsCalls       int
	withTxCalls           int
}

type blogCategoryRepositoryStub struct {
	updateErr   error
	updateCalls int
}

func (r *blogCategoryRepositoryStub) GetByID(context.Context, int64) (*BlogCategory, error) {
	return nil, models.ErrNotFound
}

func (r *blogCategoryRepositoryStub) GetAll(context.Context) ([]*BlogCategory, error) {
	return nil, nil
}

func (r *blogCategoryRepositoryStub) Create(context.Context, *BlogCategoryReq) (*BlogCategory, error) {
	return nil, nil
}

func (r *blogCategoryRepositoryStub) Update(_ context.Context, id int64, _ *BlogCategoryUpdateReq) (*BlogCategory, error) {
	r.updateCalls++
	if r.updateErr != nil {
		return nil, r.updateErr
	}
	return &BlogCategory{ID: id}, nil
}

func (r *blogCategoryRepositoryStub) Delete(context.Context, int64) error { return nil }

func (r *blogRepositoryStub) WithTx(pgx.Tx) Repository {
	r.withTxCalls++
	if r.txRepo != nil {
		return r.txRepo
	}
	return r
}

func (r *blogRepositoryStub) GetByID(_ context.Context, id int64) (*Blog, error) {
	if r.getByID != nil {
		return r.getByID(id)
	}
	return &Blog{ID: id}, nil
}

func (r *blogRepositoryStub) GetBySlug(context.Context, string) (*Blog, error) {
	return nil, models.ErrNotFound
}

func (r *blogRepositoryStub) GetPublishedBySlug(context.Context, string) (*Blog, error) {
	return nil, models.ErrNotFound
}

func (r *blogRepositoryStub) GetAll(context.Context) ([]*Blog, error) { return nil, nil }

func (r *blogRepositoryStub) List(context.Context, BlogFilter) ([]*Blog, int64, error) {
	return nil, 0, nil
}

func (r *blogRepositoryStub) Create(_ context.Context, req *BlogReq) (*Blog, error) {
	if r.create != nil {
		return r.create(req)
	}
	return &Blog{ID: 1, Title: req.Title, Slug: req.Slug, Content: req.Content, Status: req.Status}, nil
}

func (r *blogRepositoryStub) Update(_ context.Context, id int64, req *BlogUpdateReq) (*Blog, error) {
	if r.update != nil {
		return r.update(id, req)
	}
	return &Blog{ID: id}, nil
}

func (r *blogRepositoryStub) SoftDelete(context.Context, int64) error { return nil }
func (r *blogRepositoryStub) IncrementReads(context.Context, int64) error {
	return nil
}
func (r *blogRepositoryStub) SlugExists(_ context.Context, slug string) (bool, error) {
	if r.slugExists != nil {
		return r.slugExists(slug)
	}
	return false, nil
}

func (r *blogRepositoryStub) AssignCategories(_ context.Context, id int64, ids []int64) error {
	if r.assignCategories != nil {
		return r.assignCategories(id, ids)
	}
	return nil
}

func (r *blogRepositoryStub) RemoveCategories(context.Context, int64) error {
	r.removeCategoriesCalls++
	return nil
}

func (r *blogRepositoryStub) GetCategoriesByBlogID(_ context.Context, id int64) ([]*BlogCategory, error) {
	if r.getCategories != nil {
		return r.getCategories(id)
	}
	return []*BlogCategory{}, nil
}

func (r *blogRepositoryStub) AssignProducts(_ context.Context, id int64, ids []int64) error {
	if r.assignProducts != nil {
		return r.assignProducts(id, ids)
	}
	return nil
}

func (r *blogRepositoryStub) RemoveProducts(context.Context, int64) error {
	r.removeProductsCalls++
	return nil
}

func (r *blogRepositoryStub) GetProductIDsByBlogID(context.Context, int64) ([]int64, error) {
	return []int64{}, nil
}

func (r *blogRepositoryStub) AssignTags(_ context.Context, id int64, ids []int64) error {
	if r.assignTags != nil {
		return r.assignTags(id, ids)
	}
	return nil
}

func (r *blogRepositoryStub) RemoveTags(context.Context, int64) error {
	r.removeTagsCalls++
	return nil
}

func (r *blogRepositoryStub) GetTagIDsByBlogID(context.Context, int64) ([]int64, error) {
	return []int64{}, nil
}

func TestBlogCreateRollsBackRelationFailureThroughTransactionalRepository(t *testing.T) {
	tx := &mocks.FakeTx{}
	wantErr := errors.New("category assignment failed")
	txRepo := &blogRepositoryStub{
		create: func(req *BlogReq) (*Blog, error) {
			return &Blog{ID: 41, Title: req.Title, Slug: req.Slug, Content: req.Content, Status: req.Status}, nil
		},
		assignCategories: func(int64, []int64) error { return wantErr },
	}
	rootRepo := &blogRepositoryStub{txRepo: txRepo}
	service := NewService(rootRepo, blogBeginnerStub{tx: tx}, nil)

	_, err := service.Create(context.Background(), &BlogReq{
		Title:       "  راهنمای مزه‌کردن  ",
		Content:     "<p>متن</p>",
		CategoryIDs: []int64{3, 3},
	})
	if !errors.Is(err, wantErr) {
		t.Fatalf("Create error = %v, want relation failure", err)
	}
	if rootRepo.withTxCalls != 1 {
		t.Fatalf("WithTx calls = %d, want 1", rootRepo.withTxCalls)
	}
	if tx.Committed || !tx.RolledBack {
		t.Fatalf("transaction state = committed %v, rolled back %v", tx.Committed, tx.RolledBack)
	}
}

func TestBlogUpdatePublishesAndClearsNullableFieldsAtomically(t *testing.T) {
	tx := &mocks.FakeTx{}
	current := &Blog{
		ID:      9,
		Title:   "Draft",
		Slug:    "draft",
		Content: "<p>Draft</p>",
		Status:  BlogStatusDraft,
	}
	updated := *current
	txRepo := &blogRepositoryStub{
		update: func(_ int64, req *BlogUpdateReq) (*Blog, error) {
			if !req.Excerpt.Set || req.Excerpt.Value != nil {
				t.Fatal("explicit excerpt clear was not preserved")
			}
			if !req.PublishedAt.Set || req.PublishedAt.Value == nil {
				t.Fatal("publishing did not set published_at")
			}
			updated.Status = *req.Status
			updated.PublishedAt = req.PublishedAt.Value
			return &updated, nil
		},
	}
	getCalls := 0
	rootRepo := &blogRepositoryStub{
		txRepo: txRepo,
		getByID: func(int64) (*Blog, error) {
			getCalls++
			if getCalls == 1 {
				return current, nil
			}
			return &updated, nil
		},
	}
	service := NewService(rootRepo, blogBeginnerStub{tx: tx}, nil)
	status := BlogStatusPublished

	result, err := service.Update(context.Background(), 9, &BlogUpdateReq{
		Status:      &status,
		Excerpt:     models.NullablePatch[string]{Set: true},
		CategoryIDs: []int64{},
		ProductIDs:  []int64{},
		TagIDs:      []int64{},
	})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if result.Status != BlogStatusPublished || result.PublishedAt == nil {
		t.Fatalf("updated result = %+v, want published timestamp", result)
	}
	if !tx.Committed {
		t.Fatal("transaction was not committed")
	}
	if txRepo.removeCategoriesCalls != 1 || txRepo.removeProductsCalls != 1 || txRepo.removeTagsCalls != 1 {
		t.Fatalf("relation clears = categories %d products %d tags %d", txRepo.removeCategoriesCalls, txRepo.removeProductsCalls, txRepo.removeTagsCalls)
	}
}

func TestBlogCategoryUpdateRejectsSelfParent(t *testing.T) {
	id := int64(7)
	err := normalizeBlogCategoryUpdate(id, &BlogCategoryUpdateReq{
		ParentID: models.NullablePatch[int64]{Set: true, Value: &id},
	})
	if !errors.Is(err, apperr.ErrValidation) {
		t.Fatalf("self-parent error = %v, want validation", err)
	}
	fields, ok := apperr.Fields(err)
	if !ok || len(fields["parent_id"]) == 0 {
		t.Fatalf("validation fields = %#v, want parent_id", fields)
	}
}

func TestNormalizedRelationIDsRejectsInvalidAndDeduplicates(t *testing.T) {
	ids, err := normalizedRelationIDs("tag_ids", []int64{4, 2, 4})
	if err != nil {
		t.Fatalf("normalizedRelationIDs: %v", err)
	}
	if len(ids) != 2 || ids[0] != 4 || ids[1] != 2 {
		t.Fatalf("normalized ids = %v, want [4 2]", ids)
	}
	if _, err := normalizedRelationIDs("tag_ids", []int64{0}); !errors.Is(err, apperr.ErrValidation) {
		t.Fatalf("invalid ID error = %v, want validation", err)
	}
}

func TestPublishedAtPreservesFirstPublicationTime(t *testing.T) {
	first := time.Date(2026, time.July, 1, 12, 0, 0, 0, time.UTC)
	tx := &mocks.FakeTx{}
	current := &Blog{ID: 5, Slug: "post", Status: BlogStatusPublished, PublishedAt: &first}
	txRepo := &blogRepositoryStub{
		update: func(_ int64, req *BlogUpdateReq) (*Blog, error) {
			if req.PublishedAt.Value == nil || !req.PublishedAt.Value.Equal(first) {
				t.Fatalf("published_at = %v, want %v", req.PublishedAt.Value, first)
			}
			return current, nil
		},
	}
	rootRepo := &blogRepositoryStub{txRepo: txRepo, getByID: func(int64) (*Blog, error) { return current, nil }}
	service := NewService(rootRepo, blogBeginnerStub{tx: tx}, nil)
	status := BlogStatusPublished

	_, err := service.Update(context.Background(), 5, &BlogUpdateReq{
		Status:      &status,
		PublishedAt: models.NullablePatch[time.Time]{Set: true},
	})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
}

func TestBlogCreatePreservesUnicodeSlug(t *testing.T) {
	tx := &mocks.FakeTx{}
	var persistedSlug string
	txRepo := &blogRepositoryStub{
		create: func(req *BlogReq) (*Blog, error) {
			persistedSlug = req.Slug
			return &Blog{
				ID: 14, AuthorID: req.AuthorID, Title: req.Title, Slug: req.Slug,
				Content: req.Content, Status: req.Status,
			}, nil
		},
		slugExists: func(slug string) (bool, error) {
			if slug != "راهنمای-انتخاب-نوشیدنی" {
				t.Fatalf("slug check = %q", slug)
			}
			return false, nil
		},
	}
	rootRepo := &blogRepositoryStub{txRepo: txRepo}
	service := NewService(rootRepo, blogBeginnerStub{tx: tx}, nil)

	result, err := service.Create(context.Background(), &BlogReq{
		AuthorID: 2,
		Title:    "راهنمای انتخاب نوشیدنی",
		Slug:     " راهنمای انتخاب نوشیدنی ",
		Content:  "<p>متن</p>",
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if persistedSlug != "راهنمای-انتخاب-نوشیدنی" || result.Slug != persistedSlug {
		t.Fatalf("persisted/result slugs = %q/%q", persistedSlug, result.Slug)
	}
}

func TestBlogCreateSuffixesReservedUnicodeSlug(t *testing.T) {
	tx := &mocks.FakeTx{}
	var persistedSlug string
	txRepo := &blogRepositoryStub{
		create: func(req *BlogReq) (*Blog, error) {
			persistedSlug = req.Slug
			return &Blog{ID: 15, Title: req.Title, Slug: req.Slug, Content: req.Content}, nil
		},
		slugExists: func(slug string) (bool, error) {
			return slug == "راهنما", nil
		},
	}
	rootRepo := &blogRepositoryStub{txRepo: txRepo}
	service := NewService(rootRepo, blogBeginnerStub{tx: tx}, nil)

	result, err := service.Create(context.Background(), &BlogReq{
		Title: "راهنما", Content: "<p>متن</p>",
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if persistedSlug != "راهنما-2" || result.Slug != persistedSlug {
		t.Fatalf("persisted/result slugs = %q/%q", persistedSlug, result.Slug)
	}
}

func TestBlogCreateRollsBackWhenTransactionalHydrationFails(t *testing.T) {
	tx := &mocks.FakeTx{}
	wantErr := errors.New("category hydration failed")
	txRepo := &blogRepositoryStub{
		create: func(req *BlogReq) (*Blog, error) {
			return &Blog{ID: 22, Title: req.Title, Slug: req.Slug, Content: req.Content}, nil
		},
		getCategories: func(int64) ([]*BlogCategory, error) {
			return nil, wantErr
		},
	}
	service := NewService(
		&blogRepositoryStub{txRepo: txRepo},
		blogBeginnerStub{tx: tx},
		nil,
	)

	_, err := service.Create(context.Background(), &BlogReq{
		Title: "عنوان", Content: "<p>متن</p>",
	})
	if !errors.Is(err, wantErr) {
		t.Fatalf("Create error = %v, want hydration error", err)
	}
	if tx.Committed || !tx.RolledBack {
		t.Fatalf("transaction state = committed %v, rolled back %v", tx.Committed, tx.RolledBack)
	}
}

func TestBlogCategoryUpdateRejectsDescendantParent(t *testing.T) {
	parentID := int64(9)
	repo := &blogCategoryRepositoryStub{updateErr: models.ErrHierarchyCycle}
	service := NewCategoryService(repo)

	_, err := service.Update(context.Background(), 4, &BlogCategoryUpdateReq{
		ParentID: models.NullablePatch[int64]{Set: true, Value: &parentID},
	})
	if !errors.Is(err, apperr.ErrValidation) {
		t.Fatalf("Update error = %v, want validation", err)
	}
	fields, ok := apperr.Fields(err)
	if !ok || len(fields["parent_id"]) == 0 || repo.updateCalls != 1 {
		t.Fatalf("fields/update calls = %#v/%d", fields, repo.updateCalls)
	}
}

func TestBlogUpdateRejectsOversizedMetaTitle(t *testing.T) {
	metaTitle := strings.Repeat("ژ", 256)
	err := normalizeBlogUpdate(&BlogUpdateReq{
		MetaTitle: models.NullablePatch[string]{Set: true, Value: &metaTitle},
	})
	if !errors.Is(err, apperr.ErrValidation) {
		t.Fatalf("normalizeBlogUpdate error = %v, want validation", err)
	}
	fields, ok := apperr.Fields(err)
	if !ok || len(fields["meta_title"]) == 0 {
		t.Fatalf("validation fields = %#v, want meta_title", fields)
	}
}

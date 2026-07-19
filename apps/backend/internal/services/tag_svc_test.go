package services

import (
	"context"
	"errors"
	"testing"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
)

type tagServiceRepo struct {
	repositories.TagRepository
	createdReq     models.CreateTagReq
	updatedReq     models.UpdateTagReq
	updatedID      int64
	titleConflicts map[string]bool
	slugConflicts  map[string]bool
	createErr      error
	getErr         error
	updateErr      error
	deleteErr      error
	current        *models.Tag
	updateCalls    int
	excludeIDs     []int64
}

func (r *tagServiceRepo) ExistsByTitle(_ context.Context, title string, excludeID int64) (bool, error) {
	r.excludeIDs = append(r.excludeIDs, excludeID)
	return r.titleConflicts[title], nil
}

func (r *tagServiceRepo) ExistsBySlug(_ context.Context, slug string, excludeID int64) (bool, error) {
	r.excludeIDs = append(r.excludeIDs, excludeID)
	return r.slugConflicts[slug], nil
}

func (r *tagServiceRepo) Create(_ context.Context, req models.CreateTagReq) (*models.Tag, error) {
	r.createdReq = req
	if r.createErr != nil {
		return nil, r.createErr
	}
	return &models.Tag{ID: 1, Title: req.Title, Slug: req.Slug, Description: req.Description}, nil
}

func (r *tagServiceRepo) GetByID(_ context.Context, id int64) (*models.Tag, error) {
	if r.getErr != nil {
		return nil, r.getErr
	}
	if r.current != nil {
		current := *r.current
		return &current, nil
	}
	return &models.Tag{ID: id, Title: "old title", Slug: "old-slug"}, nil
}

func (r *tagServiceRepo) Update(_ context.Context, id int64, req models.UpdateTagReq) (*models.Tag, error) {
	r.updateCalls++
	r.updatedID = id
	r.updatedReq = req
	if r.updateErr != nil {
		return nil, r.updateErr
	}
	tag, _ := r.GetByID(context.Background(), id)
	if req.Title != nil {
		tag.Title = *req.Title
	}
	if req.Slug != nil {
		tag.Slug = *req.Slug
	}
	if req.Description.Set {
		tag.Description = req.Description.Value
	}
	return tag, nil
}

func (r *tagServiceRepo) Delete(context.Context, int64) error {
	return r.deleteErr
}

func TestTagServiceCreateDerivesUnicodeSlug(t *testing.T) {
	repo := &tagServiceRepo{}
	tag, err := NewTagService(repo).Create(context.Background(), models.CreateTagReq{Title: "  نوشیدنی ویژه  "})
	if err != nil {
		t.Fatalf("create tag: %v", err)
	}
	if tag.Title != "نوشیدنی ویژه" || tag.Slug != "نوشیدنی-ویژه" {
		t.Fatalf("created tag = %+v", tag)
	}
	if repo.createdReq.Slug != "نوشیدنی-ویژه" {
		t.Fatalf("persisted slug = %q", repo.createdReq.Slug)
	}
}

func TestTagServiceCreateNormalizesAndChecksSlugConflict(t *testing.T) {
	repo := &tagServiceRepo{slugConflicts: map[string]bool{"summer-sale": true}}
	_, err := NewTagService(repo).Create(context.Background(), models.CreateTagReq{
		Title: "Summer",
		Slug:  " Summer  Sale ",
	})
	if !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("err = %v; want ErrConflict", err)
	}
}

func TestTagServiceCreateMapsDatabaseConflict(t *testing.T) {
	repo := &tagServiceRepo{createErr: models.ErrConflict}
	_, err := NewTagService(repo).Create(context.Background(), models.CreateTagReq{Title: "Gift", Slug: "gift"})
	if !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("err = %v; want ErrConflict", err)
	}
}

func TestTagServiceUpdateExcludesCurrentRowAndClearsDescription(t *testing.T) {
	repo := &tagServiceRepo{}
	title := "  هدیه ویژه "
	slug := " Gift  Set "
	req := models.UpdateTagReq{Title: &title, Slug: &slug}
	req.Description.Set = true

	tag, err := NewTagService(repo).Update(context.Background(), 9, req)
	if err != nil {
		t.Fatalf("update tag: %v", err)
	}
	if repo.updatedID != 9 || tag.Title != "هدیه ویژه" || tag.Slug != "gift-set" {
		t.Fatalf("updated tag = %+v, request = %+v", tag, repo.updatedReq)
	}
	if !repo.updatedReq.Description.Set || repo.updatedReq.Description.Value != nil {
		t.Fatalf("description patch = %+v; want clear", repo.updatedReq.Description)
	}
	for _, excludeID := range repo.excludeIDs {
		if excludeID != 9 {
			t.Fatalf("exclude ID = %d; want 9", excludeID)
		}
	}
}

func TestTagServiceUpdateAndDeleteMapNotFound(t *testing.T) {
	title := "missing"
	repo := &tagServiceRepo{updateErr: models.ErrNotFound, deleteErr: models.ErrNotFound}
	svc := NewTagService(repo)

	if _, err := svc.Update(context.Background(), 10, models.UpdateTagReq{Title: &title}); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("update err = %v; want ErrNotFound", err)
	}
	if err := svc.Delete(context.Background(), 10); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("delete err = %v; want ErrNotFound", err)
	}
}

func TestTagServiceUpdateChecksExistenceBeforeConflicts(t *testing.T) {
	title := "duplicate"
	repo := &tagServiceRepo{
		getErr:         models.ErrNotFound,
		titleConflicts: map[string]bool{title: true},
	}

	_, err := NewTagService(repo).Update(
		context.Background(),
		99,
		models.UpdateTagReq{Title: &title},
	)
	if !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("err = %v; want ErrNotFound", err)
	}
	if len(repo.excludeIDs) != 0 || repo.updateCalls != 0 {
		t.Fatalf("conflict checks = %v, updates = %d; want none", repo.excludeIDs, repo.updateCalls)
	}
}

func TestTagServiceUpdateSupportsDescriptionOnlyAndNoOpPatches(t *testing.T) {
	description := "new description"
	repo := &tagServiceRepo{current: &models.Tag{ID: 4, Title: "Gift", Slug: "gift"}}
	req := models.UpdateTagReq{}
	req.Description.Set = true
	req.Description.Value = &description

	tag, err := NewTagService(repo).Update(context.Background(), 4, req)
	if err != nil {
		t.Fatalf("description-only update: %v", err)
	}
	if tag.Title != "Gift" || tag.Slug != "gift" || tag.Description == nil || *tag.Description != description {
		t.Fatalf("updated tag = %+v", tag)
	}

	repo.updateCalls = 0
	tag, err = NewTagService(repo).Update(context.Background(), 4, models.UpdateTagReq{})
	if err != nil || tag.Title != "Gift" || repo.updateCalls != 0 {
		t.Fatalf("no-op tag = %+v, updates = %d, err = %v", tag, repo.updateCalls, err)
	}
}

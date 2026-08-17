package blog

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

// MediaCleaner is the subset of media lifecycle used when blog images change.
type MediaCleaner interface {
	CleanupURLs(ctx context.Context, values ...*string)
}

// ── Blog Category Service ─────────────────────────────────────────────────────

type CategoryService interface {
	Create(ctx context.Context, req *BlogCategoryReq) (*BlogCategory, error)
	GetByID(ctx context.Context, id int64) (*BlogCategory, error)
	GetAll(ctx context.Context) ([]*BlogCategory, error)
	Update(ctx context.Context, id int64, req *BlogCategoryUpdateReq) (*BlogCategory, error)
	Delete(ctx context.Context, id int64) error
}

type categoryService struct {
	repo CategoryRepository
}

func NewCategoryService(repo CategoryRepository) CategoryService {
	return &categoryService{repo: repo}
}

func (s *categoryService) Create(ctx context.Context, req *BlogCategoryReq) (*BlogCategory, error) {
	if err := normalizeBlogCategoryCreate(req); err != nil {
		return nil, err
	}
	category, err := s.repo.Create(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("categoryService.Create: %w", err)
	}
	return category, nil
}

func (s *categoryService) GetByID(ctx context.Context, id int64) (*BlogCategory, error) {
	category, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("categoryService.GetByID: %w", err)
	}
	return category, nil
}

func (s *categoryService) GetAll(ctx context.Context) ([]*BlogCategory, error) {
	categories, err := s.repo.GetAll(ctx)
	if err != nil {
		return nil, fmt.Errorf("categoryService.GetAll: %w", err)
	}
	return categories, nil
}

func (s *categoryService) Update(ctx context.Context, id int64, req *BlogCategoryUpdateReq) (*BlogCategory, error) {
	if err := normalizeBlogCategoryUpdate(id, req); err != nil {
		return nil, err
	}
	category, err := s.repo.Update(ctx, id, req)
	if err != nil {
		if errors.Is(err, models.ErrHierarchyCycle) {
			return nil, blogFieldError("parent_id", "category parent cannot be one of its descendants")
		}
		return nil, fmt.Errorf("categoryService.Update: %w", err)
	}
	return category, nil
}

func (s *categoryService) Delete(ctx context.Context, id int64) error {
	if err := s.repo.Delete(ctx, id); err != nil {
		return fmt.Errorf("categoryService.Delete: %w", err)
	}
	return nil
}

// ── Blog Service ──────────────────────────────────────────────────────────────

type Service interface {
	Create(ctx context.Context, req *BlogReq) (*BlogDetailResponse, error)
	GetByID(ctx context.Context, id int64) (*BlogDetailResponse, error)
	GetBySlug(ctx context.Context, slug string) (*BlogDetailResponse, error)
	GetPublishedBySlug(ctx context.Context, slug string) (*BlogDetailResponse, error)
	GetAll(ctx context.Context) ([]*Blog, error)
	List(ctx context.Context, filter BlogFilter) ([]*Blog, int64, error)
	Update(ctx context.Context, id int64, req *BlogUpdateReq) (*BlogDetailResponse, error)
	Delete(ctx context.Context, id int64) error
	RecordRead(ctx context.Context, id int64) error
}

type pgxBeginner interface {
	Begin(ctx context.Context) (pgx.Tx, error)
}

type service struct {
	repo  Repository
	db    pgxBeginner
	media MediaCleaner
}

const blogSlugWriteLockKey int64 = 7278134300002

func NewService(repo Repository, db pgxBeginner, media MediaCleaner) Service {
	return &service{repo: repo, db: db, media: media}
}

// ── Reads ─────────────────────────────────────────────────────────────────────

func (s *service) GetAll(ctx context.Context) ([]*Blog, error) {
	blogs, err := s.repo.GetAll(ctx)
	if err != nil {
		return nil, fmt.Errorf("service.GetAll: %w", err)
	}
	return blogs, nil
}

// List returns a paginated, filtered slice of blogs plus the total count. The
// public handler forces status='published' and LiveOnly (hide future
// published_at); admin callers may pass any status and still see schedules.
func (s *service) List(ctx context.Context, filter BlogFilter) ([]*Blog, int64, error) {
	blogs, total, err := s.repo.List(ctx, filter)
	if err != nil {
		return nil, 0, fmt.Errorf("service.List: %w", err)
	}
	return blogs, total, nil
}

func (s *service) GetByID(ctx context.Context, id int64) (*BlogDetailResponse, error) {
	return s.hydrate(ctx, func() (*Blog, error) {
		return s.repo.GetByID(ctx, id)
	})
}

// GetBySlug is the admin read: it returns drafts/archived posts too.
func (s *service) GetBySlug(ctx context.Context, slug string) (*BlogDetailResponse, error) {
	return s.hydrate(ctx, func() (*Blog, error) {
		return s.repo.GetBySlug(ctx, slug)
	})
}

// GetPublishedBySlug is the public storefront read: unpublished or not-yet-
// scheduled posts 404.
func (s *service) GetPublishedBySlug(ctx context.Context, slug string) (*BlogDetailResponse, error) {
	if slug == "" {
		return nil, apperr.ErrInvalidRequest
	}
	return s.hydrate(ctx, func() (*Blog, error) {
		blog, err := s.repo.GetPublishedBySlug(ctx, slug)
		if err != nil {
			return nil, err
		}
		if !isPubliclyLive(blog.Status, blog.PublishedAt, time.Now().UTC()) {
			return nil, models.ErrNotFound
		}
		return blog, nil
	})
}

func (s *service) RecordRead(ctx context.Context, id int64) error {
	if err := s.repo.IncrementReads(ctx, id); err != nil {
		return fmt.Errorf("service.RecordRead: %w", err)
	}
	return nil
}

// ── Writes ────────────────────────────────────────────────────────────────────

func (s *service) Create(ctx context.Context, req *BlogReq) (*BlogDetailResponse, error) {
	if err := normalizeBlogCreate(req); err != nil {
		return nil, err
	}
	if err := normalizeCreateMediaURL(&req.ImageURL); err != nil {
		return nil, err
	}
	if err := normalizeCreateImageAlt(&req.ImageAlt); err != nil {
		return nil, err
	}
	generatedSlug := strings.TrimSpace(req.Slug) == ""
	applyBlogCreateDefaults(req)
	if !generatedSlug && req.Slug == "" {
		return nil, blogFieldError("slug", "journal slug must contain a letter or number")
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("service.Create: begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	txRepo := s.repo.WithTx(tx)
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, blogSlugWriteLockKey); err != nil {
		return nil, fmt.Errorf("service.Create: lock slug writes: %w", err)
	}
	if generatedSlug {
		req.Slug, err = uniqueBlogSlug(ctx, txRepo, req.Title)
		if err != nil {
			return nil, fmt.Errorf("service.Create: %w", err)
		}
	} else if err = assertBlogSlugFree(ctx, txRepo, req.Slug); err != nil {
		return nil, err
	}

	blog, err := txRepo.Create(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("service.Create: %w", err)
	}

	if err = syncBlogRelations(ctx, txRepo, blog.ID, req.CategoryIDs, req.ProductIDs, req.TagIDs); err != nil {
		return nil, fmt.Errorf("service.Create: %w", err)
	}
	result, err := hydrateBlog(ctx, txRepo, blog)
	if err != nil {
		return nil, fmt.Errorf("service.Create: %w", err)
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("service.Create: commit: %w", err)
	}

	return result, nil
}

func (s *service) Update(ctx context.Context, id int64, req *BlogUpdateReq) (*BlogDetailResponse, error) {
	current, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("service.Update preflight: %w", err)
	}
	if err := normalizeBlogUpdate(req); err != nil {
		return nil, err
	}

	var mediaBefore *Blog
	if req.ImageURL.Set || req.ImageAlt.Set {
		mediaBefore = current
		req.ExpectedImageURL = mediaExpectation(current.ImageURL)
		if err := normalizeMediaURLPatch(&req.ImageURL, current.ImageURL); err != nil {
			return nil, err
		}
		if err := normalizeImageAltPatch(&req.ImageAlt); err != nil {
			return nil, err
		}
	}

	// Normalise / guard the slug if it is being changed.
	if req.Slug != nil {
		normalized := slugify(*req.Slug)
		if normalized == "" {
			return nil, apperr.ErrInvalidRequest
		}
		req.Slug = &normalized
	}

	// A published post always has a publication timestamp. Preserve an existing
	// first-published time and stamp now only when the post has never gone live.
	targetStatus := current.Status
	if req.Status != nil {
		targetStatus = *req.Status
	}
	if targetStatus == BlogStatusPublished &&
		((req.PublishedAt.Set && req.PublishedAt.Value == nil) || (!req.PublishedAt.Set && current.PublishedAt == nil)) {
		publishedAt := current.PublishedAt
		if publishedAt == nil {
			now := time.Now().UTC()
			publishedAt = &now
		}
		req.PublishedAt = models.NullablePatch[time.Time]{Set: true, Value: publishedAt}
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("service.Update: begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	txRepo := s.repo.WithTx(tx)
	if req.Slug != nil {
		if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, blogSlugWriteLockKey); err != nil {
			return nil, fmt.Errorf("service.Update: lock slug writes: %w", err)
		}
		exists, slugErr := txRepo.SlugExists(ctx, *req.Slug)
		if slugErr != nil {
			return nil, fmt.Errorf("service.Update: %w", slugErr)
		}
		// Allow keeping the same slug on the same post.
		if exists && current.Slug != *req.Slug {
			return nil, apperr.WithFields(apperr.ErrConflict, map[string][]string{
				"slug": {"slug is already used by another journal post"},
			})
		}
	}

	blog, err := txRepo.Update(ctx, id, req)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("service.Update: %w", err)
	}

	// nil = caller didn't send this relation → leave it alone
	// []int64{} = caller sent an empty list → remove all
	if req.CategoryIDs != nil {
		if err = txRepo.RemoveCategories(ctx, id); err != nil {
			return nil, fmt.Errorf("service.Update: remove categories: %w", err)
		}
		if err = txRepo.AssignCategories(ctx, id, req.CategoryIDs); err != nil {
			return nil, fmt.Errorf("service.Update: assign categories: %w", err)
		}
	}
	if req.ProductIDs != nil {
		if err = txRepo.RemoveProducts(ctx, id); err != nil {
			return nil, fmt.Errorf("service.Update: remove products: %w", err)
		}
		if err = txRepo.AssignProducts(ctx, id, req.ProductIDs); err != nil {
			return nil, fmt.Errorf("service.Update: assign products: %w", err)
		}
	}
	if req.TagIDs != nil {
		if err = txRepo.RemoveTags(ctx, id); err != nil {
			return nil, fmt.Errorf("service.Update: remove tags: %w", err)
		}
		if err = txRepo.AssignTags(ctx, id, req.TagIDs); err != nil {
			return nil, fmt.Errorf("service.Update: assign tags: %w", err)
		}
	}
	result, err := hydrateBlog(ctx, txRepo, blog)
	if err != nil {
		return nil, fmt.Errorf("service.Update: %w", err)
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("service.Update: commit: %w", err)
	}
	if mediaBefore != nil && !sameMediaURL(mediaBefore.ImageURL, blog.ImageURL) {
		s.media.CleanupURLs(ctx, mediaBefore.ImageURL)
	}

	return result, nil
}

func (s *service) Delete(ctx context.Context, id int64) error {
	current, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrNotFound
		}
		return fmt.Errorf("service.Delete media: %w", err)
	}
	if err := s.repo.SoftDelete(ctx, id); err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrNotFound
		}
		return fmt.Errorf("service.Delete: %w", err)
	}
	s.media.CleanupURLs(ctx, current.ImageURL)
	return nil
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func (s *service) hydrate(ctx context.Context, load func() (*Blog, error)) (*BlogDetailResponse, error) {
	blog, err := load()
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("service.hydrate: %w", err)
	}

	return hydrateBlog(ctx, s.repo, blog)
}

func hydrateBlog(ctx context.Context, repo Repository, blog *Blog) (*BlogDetailResponse, error) {
	categories, err := repo.GetCategoriesByBlogID(ctx, blog.ID)
	if err != nil {
		return nil, fmt.Errorf("service.hydrate: categories: %w", err)
	}

	productIDs, err := repo.GetProductIDsByBlogID(ctx, blog.ID)
	if err != nil {
		return nil, fmt.Errorf("service.hydrate: products: %w", err)
	}

	tagIDs, err := repo.GetTagIDsByBlogID(ctx, blog.ID)
	if err != nil {
		return nil, fmt.Errorf("service.hydrate: tags: %w", err)
	}

	// Map []*BlogCategory → []BlogCategoryResponse
	catResponses := make([]BlogCategoryResponse, len(categories))
	for i, c := range categories {
		catResponses[i] = BlogCategoryResponse{
			ID:          c.ID,
			Name:        c.Name,
			Description: c.Description,
			Slug:        c.Slug,
			ParentID:    c.ParentID,
			CreatedAt:   c.CreatedAt,
			UpdatedAt:   c.UpdatedAt,
		}
	}

	return &BlogDetailResponse{
		BlogResponse: BlogResponse{
			ID:              blog.ID,
			AuthorID:        blog.AuthorID,
			Title:           blog.Title,
			Slug:            blog.Slug,
			Content:         blog.Content,
			Excerpt:         blog.Excerpt,
			ImageURL:        blog.ImageURL,
			ImageAlt:        blog.ImageAlt,
			TimeToRead:      blog.TimeToRead,
			TotalReads:      blog.TotalReads,
			Status:          blog.Status,
			IsFeatured:      blog.IsFeatured,
			MetaTitle:       blog.MetaTitle,
			MetaDescription: blog.MetaDescription,
			PublishedAt:     blog.PublishedAt,
			CreatedAt:       blog.CreatedAt,
			UpdatedAt:       blog.UpdatedAt,
		},
		Categories: catResponses,
		ProductIDs: productIDs,
		TagIDs:     tagIDs,
	}, nil
}

// applyBlogCreateDefaults normalises scalar defaults before the transaction;
// generated slug allocation happens under the transaction-scoped slug lock.
func applyBlogCreateDefaults(req *BlogReq) {
	if req.Status == "" {
		req.Status = BlogStatusDraft
	}
	if req.TimeToRead <= 0 {
		req.TimeToRead = 1
	}
	if req.Status == BlogStatusPublished && req.PublishedAt == nil {
		now := time.Now().UTC()
		req.PublishedAt = &now
	}
	if strings.TrimSpace(req.Slug) != "" {
		req.Slug = slugify(req.Slug)
	}
}

func assertBlogSlugFree(ctx context.Context, repo Repository, slug string) error {
	exists, err := repo.SlugExists(ctx, slug)
	if err != nil {
		return fmt.Errorf("service.assertSlugFree: %w", err)
	}
	if exists {
		return apperr.ErrConflict
	}
	return nil
}

// uniqueBlogSlug derives a URL-safe slug from the title and appends a numeric suffix
// until it is free, so creation never fails on a slug collision.
func uniqueBlogSlug(ctx context.Context, repo Repository, title string) (string, error) {
	base := slugify(title)
	if base == "" {
		base = "post"
	}
	slug := base
	for i := 2; ; i++ {
		exists, err := repo.SlugExists(ctx, slug)
		if err != nil {
			return "", err
		}
		if !exists {
			return slug, nil
		}
		slug = base + "-" + strconv.Itoa(i)
	}
}

func syncBlogRelations(ctx context.Context, repo Repository, blogID int64, categoryIDs, productIDs, tagIDs []int64) error {
	if err := repo.AssignCategories(ctx, blogID, categoryIDs); err != nil {
		return fmt.Errorf("assign categories: %w", err)
	}
	if err := repo.AssignProducts(ctx, blogID, productIDs); err != nil {
		return fmt.Errorf("assign products: %w", err)
	}
	if err := repo.AssignTags(ctx, blogID, tagIDs); err != nil {
		return fmt.Errorf("assign tags: %w", err)
	}
	return nil
}

func normalizeBlogCategoryCreate(req *BlogCategoryReq) error {
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return blogFieldError("name", "category name is required")
	}
	req.Description = normalizedOptionalText(req.Description)
	req.Slug = normalizedOptionalSlug(req.Slug)
	return nil
}

func normalizeBlogCategoryUpdate(id int64, req *BlogCategoryUpdateReq) error {
	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			return blogFieldError("name", "category name is required")
		}
		req.Name = &name
	}
	normalizeTextPatch(&req.Description, false)
	normalizeTextPatch(&req.Slug, true)
	if req.Slug.Value != nil && utf8.RuneCountInString(*req.Slug.Value) > 255 {
		return blogFieldError("slug", "category slug must be at most 255 characters")
	}
	if req.ParentID.Set && req.ParentID.Value != nil {
		if *req.ParentID.Value <= 0 || *req.ParentID.Value == id {
			return blogFieldError("parent_id", "category cannot be its own parent")
		}
	}
	return nil
}

func normalizeBlogCreate(req *BlogReq) error {
	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		return blogFieldError("title", "journal title is required")
	}
	if strings.TrimSpace(req.Content) == "" || strings.TrimSpace(req.Content) == "<p></p>" {
		return blogFieldError("content", "journal content is required")
	}
	req.Excerpt = normalizedOptionalText(req.Excerpt)
	req.MetaTitle = normalizedOptionalText(req.MetaTitle)
	req.MetaDescription = normalizedOptionalText(req.MetaDescription)
	var err error
	if req.CategoryIDs, err = normalizedRelationIDs("category_ids", req.CategoryIDs); err != nil {
		return err
	}
	if req.ProductIDs, err = normalizedRelationIDs("product_ids", req.ProductIDs); err != nil {
		return err
	}
	if req.TagIDs, err = normalizedRelationIDs("tag_ids", req.TagIDs); err != nil {
		return err
	}
	return nil
}

func normalizeBlogUpdate(req *BlogUpdateReq) error {
	if req.Title != nil {
		title := strings.TrimSpace(*req.Title)
		if title == "" {
			return blogFieldError("title", "journal title is required")
		}
		req.Title = &title
	}
	if req.Content != nil && (strings.TrimSpace(*req.Content) == "" || strings.TrimSpace(*req.Content) == "<p></p>") {
		return blogFieldError("content", "journal content is required")
	}
	normalizeTextPatch(&req.Excerpt, false)
	normalizeTextPatch(&req.MetaTitle, false)
	normalizeTextPatch(&req.MetaDescription, false)
	if req.MetaTitle.Value != nil && utf8.RuneCountInString(*req.MetaTitle.Value) > 255 {
		return blogFieldError("meta_title", "meta title must be at most 255 characters")
	}
	var err error
	if req.CategoryIDs != nil {
		if req.CategoryIDs, err = normalizedRelationIDs("category_ids", req.CategoryIDs); err != nil {
			return err
		}
	}
	if req.ProductIDs != nil {
		if req.ProductIDs, err = normalizedRelationIDs("product_ids", req.ProductIDs); err != nil {
			return err
		}
	}
	if req.TagIDs != nil {
		if req.TagIDs, err = normalizedRelationIDs("tag_ids", req.TagIDs); err != nil {
			return err
		}
	}
	return nil
}

func normalizedOptionalText(value *string) *string {
	if value == nil {
		return nil
	}
	normalized := strings.TrimSpace(*value)
	if normalized == "" {
		return nil
	}
	return &normalized
}

func normalizedOptionalSlug(value *string) *string {
	if value == nil {
		return nil
	}
	normalized := slugify(*value)
	if normalized == "" {
		return nil
	}
	return &normalized
}

func normalizeTextPatch(patch *models.NullablePatch[string], slug bool) {
	if !patch.Set || patch.Value == nil {
		return
	}
	value := strings.TrimSpace(*patch.Value)
	if slug {
		value = slugify(value)
	}
	if value == "" {
		patch.Value = nil
		return
	}
	patch.Value = &value
}

func normalizedRelationIDs(field string, ids []int64) ([]int64, error) {
	if ids == nil {
		return nil, nil
	}
	seen := make(map[int64]struct{}, len(ids))
	normalized := make([]int64, 0, len(ids))
	for _, id := range ids {
		if id <= 0 {
			return nil, blogFieldError(field, "relation IDs must be positive")
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		normalized = append(normalized, id)
	}
	return normalized, nil
}

func blogFieldError(field, message string) error {
	return apperr.WithFields(apperr.ErrValidation, map[string][]string{
		field: {message},
	})
}

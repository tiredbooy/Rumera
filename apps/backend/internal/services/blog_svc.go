// internal/services/blog_service.go
package services

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
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
)

// ── Blog Category Service ─────────────────────────────────────────────────────

type BlogCategoryService interface {
	Create(ctx context.Context, req *models.BlogCategoryReq) (*models.BlogCategory, error)
	GetByID(ctx context.Context, id int64) (*models.BlogCategory, error)
	GetAll(ctx context.Context) ([]*models.BlogCategory, error)
	Update(ctx context.Context, id int64, req *models.BlogCategoryUpdateReq) (*models.BlogCategory, error)
	Delete(ctx context.Context, id int64) error
}

type blogCategoryService struct {
	repo repositories.BlogCategoryRepository
}

func NewBlogCategoryService(repo repositories.BlogCategoryRepository) BlogCategoryService {
	return &blogCategoryService{repo: repo}
}

func (s *blogCategoryService) Create(ctx context.Context, req *models.BlogCategoryReq) (*models.BlogCategory, error) {
	if err := normalizeBlogCategoryCreate(req); err != nil {
		return nil, err
	}
	category, err := s.repo.Create(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("blogCategoryService.Create: %w", err)
	}
	return category, nil
}

func (s *blogCategoryService) GetByID(ctx context.Context, id int64) (*models.BlogCategory, error) {
	category, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("blogCategoryService.GetByID: %w", err)
	}
	return category, nil
}

func (s *blogCategoryService) GetAll(ctx context.Context) ([]*models.BlogCategory, error) {
	categories, err := s.repo.GetAll(ctx)
	if err != nil {
		return nil, fmt.Errorf("blogCategoryService.GetAll: %w", err)
	}
	return categories, nil
}

func (s *blogCategoryService) Update(ctx context.Context, id int64, req *models.BlogCategoryUpdateReq) (*models.BlogCategory, error) {
	if err := normalizeBlogCategoryUpdate(id, req); err != nil {
		return nil, err
	}
	category, err := s.repo.Update(ctx, id, req)
	if err != nil {
		if errors.Is(err, models.ErrHierarchyCycle) {
			return nil, blogFieldError("parent_id", "category parent cannot be one of its descendants")
		}
		return nil, fmt.Errorf("blogCategoryService.Update: %w", err)
	}
	return category, nil
}

func (s *blogCategoryService) Delete(ctx context.Context, id int64) error {
	if err := s.repo.Delete(ctx, id); err != nil {
		return fmt.Errorf("blogCategoryService.Delete: %w", err)
	}
	return nil
}

// ── Blog Service ──────────────────────────────────────────────────────────────

type BlogService interface {
	Create(ctx context.Context, req *models.BlogReq) (*models.BlogDetailResponse, error)
	GetByID(ctx context.Context, id int64) (*models.BlogDetailResponse, error)
	GetBySlug(ctx context.Context, slug string) (*models.BlogDetailResponse, error)
	GetPublishedBySlug(ctx context.Context, slug string) (*models.BlogDetailResponse, error)
	GetAll(ctx context.Context) ([]*models.Blog, error)
	List(ctx context.Context, filter models.BlogFilter) ([]*models.Blog, int64, error)
	Update(ctx context.Context, id int64, req *models.BlogUpdateReq) (*models.BlogDetailResponse, error)
	Delete(ctx context.Context, id int64) error
	RecordRead(ctx context.Context, id int64) error
}

type pgxBeginner interface {
	Begin(ctx context.Context) (pgx.Tx, error)
}

type blogService struct {
	repo  repositories.BlogRepository
	db    pgxBeginner
	media *MediaLifecycleService
}

const blogSlugWriteLockKey int64 = 7278134300002

func NewBlogService(repo repositories.BlogRepository, db pgxBeginner, media *MediaLifecycleService) BlogService {
	return &blogService{repo: repo, db: db, media: media}
}

// ── Reads ─────────────────────────────────────────────────────────────────────

func (s *blogService) GetAll(ctx context.Context) ([]*models.Blog, error) {
	blogs, err := s.repo.GetAll(ctx)
	if err != nil {
		return nil, fmt.Errorf("blogService.GetAll: %w", err)
	}
	return blogs, nil
}

// List returns a paginated, filtered slice of blogs plus the total count. The
// public handler forces status='published'; admin callers may pass any status.
func (s *blogService) List(ctx context.Context, filter models.BlogFilter) ([]*models.Blog, int64, error) {
	blogs, total, err := s.repo.List(ctx, filter)
	if err != nil {
		return nil, 0, fmt.Errorf("blogService.List: %w", err)
	}
	return blogs, total, nil
}

func (s *blogService) GetByID(ctx context.Context, id int64) (*models.BlogDetailResponse, error) {
	return s.hydrate(ctx, func() (*models.Blog, error) {
		return s.repo.GetByID(ctx, id)
	})
}

// GetBySlug is the admin read: it returns drafts/archived posts too.
func (s *blogService) GetBySlug(ctx context.Context, slug string) (*models.BlogDetailResponse, error) {
	return s.hydrate(ctx, func() (*models.Blog, error) {
		return s.repo.GetBySlug(ctx, slug)
	})
}

// GetPublishedBySlug is the public storefront read: unpublished posts 404.
func (s *blogService) GetPublishedBySlug(ctx context.Context, slug string) (*models.BlogDetailResponse, error) {
	if slug == "" {
		return nil, apperr.ErrInvalidRequest
	}
	return s.hydrate(ctx, func() (*models.Blog, error) {
		return s.repo.GetPublishedBySlug(ctx, slug)
	})
}

func (s *blogService) RecordRead(ctx context.Context, id int64) error {
	if err := s.repo.IncrementReads(ctx, id); err != nil {
		return fmt.Errorf("blogService.RecordRead: %w", err)
	}
	return nil
}

// ── Writes ────────────────────────────────────────────────────────────────────

func (s *blogService) Create(ctx context.Context, req *models.BlogReq) (*models.BlogDetailResponse, error) {
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
		return nil, fmt.Errorf("blogService.Create: begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	txRepo := s.repo.WithTx(tx)
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, blogSlugWriteLockKey); err != nil {
		return nil, fmt.Errorf("blogService.Create: lock slug writes: %w", err)
	}
	if generatedSlug {
		req.Slug, err = uniqueBlogSlug(ctx, txRepo, req.Title)
		if err != nil {
			return nil, fmt.Errorf("blogService.Create: %w", err)
		}
	} else if err = assertBlogSlugFree(ctx, txRepo, req.Slug); err != nil {
		return nil, err
	}

	blog, err := txRepo.Create(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("blogService.Create: %w", err)
	}

	if err = syncBlogRelations(ctx, txRepo, blog.ID, req.CategoryIDs, req.ProductIDs, req.TagIDs); err != nil {
		return nil, fmt.Errorf("blogService.Create: %w", err)
	}
	result, err := hydrateBlog(ctx, txRepo, blog)
	if err != nil {
		return nil, fmt.Errorf("blogService.Create: %w", err)
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("blogService.Create: commit: %w", err)
	}

	return result, nil
}

func (s *blogService) Update(ctx context.Context, id int64, req *models.BlogUpdateReq) (*models.BlogDetailResponse, error) {
	current, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("blogService.Update preflight: %w", err)
	}
	if err := normalizeBlogUpdate(req); err != nil {
		return nil, err
	}

	var mediaBefore *models.Blog
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
	if targetStatus == models.BlogStatusPublished &&
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
		return nil, fmt.Errorf("blogService.Update: begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	txRepo := s.repo.WithTx(tx)
	if req.Slug != nil {
		if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, blogSlugWriteLockKey); err != nil {
			return nil, fmt.Errorf("blogService.Update: lock slug writes: %w", err)
		}
		exists, slugErr := txRepo.SlugExists(ctx, *req.Slug)
		if slugErr != nil {
			return nil, fmt.Errorf("blogService.Update: %w", slugErr)
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
		return nil, fmt.Errorf("blogService.Update: %w", err)
	}

	// nil = caller didn't send this relation → leave it alone
	// []int64{} = caller sent an empty list → remove all
	if req.CategoryIDs != nil {
		if err = txRepo.RemoveCategories(ctx, id); err != nil {
			return nil, fmt.Errorf("blogService.Update: remove categories: %w", err)
		}
		if err = txRepo.AssignCategories(ctx, id, req.CategoryIDs); err != nil {
			return nil, fmt.Errorf("blogService.Update: assign categories: %w", err)
		}
	}
	if req.ProductIDs != nil {
		if err = txRepo.RemoveProducts(ctx, id); err != nil {
			return nil, fmt.Errorf("blogService.Update: remove products: %w", err)
		}
		if err = txRepo.AssignProducts(ctx, id, req.ProductIDs); err != nil {
			return nil, fmt.Errorf("blogService.Update: assign products: %w", err)
		}
	}
	if req.TagIDs != nil {
		if err = txRepo.RemoveTags(ctx, id); err != nil {
			return nil, fmt.Errorf("blogService.Update: remove tags: %w", err)
		}
		if err = txRepo.AssignTags(ctx, id, req.TagIDs); err != nil {
			return nil, fmt.Errorf("blogService.Update: assign tags: %w", err)
		}
	}
	result, err := hydrateBlog(ctx, txRepo, blog)
	if err != nil {
		return nil, fmt.Errorf("blogService.Update: %w", err)
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("blogService.Update: commit: %w", err)
	}
	if mediaBefore != nil && !sameMediaURL(mediaBefore.ImageURL, blog.ImageURL) {
		s.media.CleanupURLs(ctx, mediaBefore.ImageURL)
	}

	return result, nil
}

func (s *blogService) Delete(ctx context.Context, id int64) error {
	current, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrNotFound
		}
		return fmt.Errorf("blogService.Delete media: %w", err)
	}
	if err := s.repo.SoftDelete(ctx, id); err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrNotFound
		}
		return fmt.Errorf("blogService.Delete: %w", err)
	}
	s.media.CleanupURLs(ctx, current.ImageURL)
	return nil
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func (s *blogService) hydrate(ctx context.Context, load func() (*models.Blog, error)) (*models.BlogDetailResponse, error) {
	blog, err := load()
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("blogService.hydrate: %w", err)
	}

	return hydrateBlog(ctx, s.repo, blog)
}

func hydrateBlog(ctx context.Context, repo repositories.BlogRepository, blog *models.Blog) (*models.BlogDetailResponse, error) {
	categories, err := repo.GetCategoriesByBlogID(ctx, blog.ID)
	if err != nil {
		return nil, fmt.Errorf("blogService.hydrate: categories: %w", err)
	}

	productIDs, err := repo.GetProductIDsByBlogID(ctx, blog.ID)
	if err != nil {
		return nil, fmt.Errorf("blogService.hydrate: products: %w", err)
	}

	tagIDs, err := repo.GetTagIDsByBlogID(ctx, blog.ID)
	if err != nil {
		return nil, fmt.Errorf("blogService.hydrate: tags: %w", err)
	}

	// Map []*BlogCategory → []BlogCategoryResponse
	catResponses := make([]models.BlogCategoryResponse, len(categories))
	for i, c := range categories {
		catResponses[i] = models.BlogCategoryResponse{
			ID:          c.ID,
			Name:        c.Name,
			Description: c.Description,
			Slug:        c.Slug,
			ParentID:    c.ParentID,
			CreatedAt:   c.CreatedAt,
			UpdatedAt:   c.UpdatedAt,
		}
	}

	return &models.BlogDetailResponse{
		BlogResponse: models.BlogResponse{
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
func applyBlogCreateDefaults(req *models.BlogReq) {
	if req.Status == "" {
		req.Status = models.BlogStatusDraft
	}
	if req.TimeToRead <= 0 {
		req.TimeToRead = 1
	}
	if req.Status == models.BlogStatusPublished && req.PublishedAt == nil {
		now := time.Now().UTC()
		req.PublishedAt = &now
	}
	if strings.TrimSpace(req.Slug) != "" {
		req.Slug = slugify(req.Slug)
	}
}

func assertBlogSlugFree(ctx context.Context, repo repositories.BlogRepository, slug string) error {
	exists, err := repo.SlugExists(ctx, slug)
	if err != nil {
		return fmt.Errorf("blogService.assertSlugFree: %w", err)
	}
	if exists {
		return apperr.ErrConflict
	}
	return nil
}

// uniqueBlogSlug derives a URL-safe slug from the title and appends a numeric suffix
// until it is free, so creation never fails on a slug collision.
func uniqueBlogSlug(ctx context.Context, repo repositories.BlogRepository, title string) (string, error) {
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

func syncBlogRelations(ctx context.Context, repo repositories.BlogRepository, blogID int64, categoryIDs, productIDs, tagIDs []int64) error {
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

func normalizeBlogCategoryCreate(req *models.BlogCategoryReq) error {
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return blogFieldError("name", "category name is required")
	}
	req.Description = normalizedOptionalText(req.Description)
	req.Slug = normalizedOptionalSlug(req.Slug)
	return nil
}

func normalizeBlogCategoryUpdate(id int64, req *models.BlogCategoryUpdateReq) error {
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

func normalizeBlogCreate(req *models.BlogReq) error {
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

func normalizeBlogUpdate(req *models.BlogUpdateReq) error {
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

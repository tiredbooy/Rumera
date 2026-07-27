// internal/services/blog_service.go
package services

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

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
	Update(ctx context.Context, id int64, req *models.BlogCategoryReq) (*models.BlogCategory, error)
	Delete(ctx context.Context, id int64) error
}

type blogCategoryService struct {
	repo repositories.BlogCategoryRepository
}

func NewBlogCategoryService(repo repositories.BlogCategoryRepository) BlogCategoryService {
	return &blogCategoryService{repo: repo}
}

func (s *blogCategoryService) Create(ctx context.Context, req *models.BlogCategoryReq) (*models.BlogCategory, error) {
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

func (s *blogCategoryService) Update(ctx context.Context, id int64, req *models.BlogCategoryReq) (*models.BlogCategory, error) {
	category, err := s.repo.Update(ctx, id, req)
	if err != nil {
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
	if err := normalizeCreateMediaURL(&req.ImageURL); err != nil {
		return nil, err
	}
	if err := normalizeCreateImageAlt(&req.ImageAlt); err != nil {
		return nil, err
	}
	s.applyCreateDefaults(ctx, req)

	if err := s.assertSlugFree(ctx, req.Slug); err != nil {
		return nil, err
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("blogService.Create: begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	blog, err := s.repo.Create(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("blogService.Create: %w", err)
	}

	if err = s.syncRelations(ctx, blog.ID, req.CategoryIDs, req.ProductIDs, req.TagIDs); err != nil {
		return nil, fmt.Errorf("blogService.Create: %w", err)
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("blogService.Create: commit: %w", err)
	}

	return s.hydrate(ctx, func() (*models.Blog, error) { return blog, nil })
}

func (s *blogService) Update(ctx context.Context, id int64, req *models.BlogUpdateReq) (*models.BlogDetailResponse, error) {
	var mediaBefore *models.Blog
	if req.ImageURL.Set || req.ImageAlt.Set {
		current, err := s.repo.GetByID(ctx, id)
		if err != nil {
			if errors.Is(err, models.ErrNotFound) {
				return nil, apperr.ErrNotFound
			}
			return nil, fmt.Errorf("blogService.Update media preflight: %w", err)
		}
		mediaBefore = current
		if req.ImageURL.Set || req.ImageAlt.Set {
			req.ExpectedImageURL = mediaExpectation(current.ImageURL)
		}
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
		exists, err := s.repo.SlugExists(ctx, normalized)
		if err != nil {
			return nil, fmt.Errorf("blogService.Update: %w", err)
		}
		// Allow keeping the same slug on the same post.
		if exists {
			if current, gErr := s.repo.GetByID(ctx, id); gErr == nil && current.Slug != normalized {
				return nil, apperr.ErrConflict
			}
		}
	}

	// Auto-stamp published_at the first time a post goes live.
	if req.Status != nil && *req.Status == models.BlogStatusPublished && req.PublishedAt == nil {
		if current, err := s.repo.GetByID(ctx, id); err == nil && current.PublishedAt == nil {
			now := time.Now().UTC()
			req.PublishedAt = &now
		}
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("blogService.Update: begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	blog, err := s.repo.Update(ctx, id, req)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("blogService.Update: %w", err)
	}

	// nil = caller didn't send this relation → leave it alone
	// []int64{} = caller sent an empty list → remove all
	if req.CategoryIDs != nil {
		if err = s.repo.RemoveCategories(ctx, id); err != nil {
			return nil, fmt.Errorf("blogService.Update: remove categories: %w", err)
		}
		if err = s.repo.AssignCategories(ctx, id, req.CategoryIDs); err != nil {
			return nil, fmt.Errorf("blogService.Update: assign categories: %w", err)
		}
	}
	if req.ProductIDs != nil {
		if err = s.repo.RemoveProducts(ctx, id); err != nil {
			return nil, fmt.Errorf("blogService.Update: remove products: %w", err)
		}
		if err = s.repo.AssignProducts(ctx, id, req.ProductIDs); err != nil {
			return nil, fmt.Errorf("blogService.Update: assign products: %w", err)
		}
	}
	if req.TagIDs != nil {
		if err = s.repo.RemoveTags(ctx, id); err != nil {
			return nil, fmt.Errorf("blogService.Update: remove tags: %w", err)
		}
		if err = s.repo.AssignTags(ctx, id, req.TagIDs); err != nil {
			return nil, fmt.Errorf("blogService.Update: assign tags: %w", err)
		}
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("blogService.Update: commit: %w", err)
	}
	if mediaBefore != nil && !sameMediaURL(mediaBefore.ImageURL, blog.ImageURL) {
		s.media.CleanupURLs(ctx, mediaBefore.ImageURL)
	}

	return s.hydrate(ctx, func() (*models.Blog, error) { return blog, nil })
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

	categories, err := s.repo.GetCategoriesByBlogID(ctx, blog.ID)
	if err != nil {
		return nil, fmt.Errorf("blogService.hydrate: categories: %w", err)
	}

	productIDs, err := s.repo.GetProductIDsByBlogID(ctx, blog.ID)
	if err != nil {
		return nil, fmt.Errorf("blogService.hydrate: products: %w", err)
	}

	tagIDs, err := s.repo.GetTagIDsByBlogID(ctx, blog.ID)
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

// applyCreateDefaults normalises the request before insert: it defaults the
// status to draft, derives a unique slug from the title when none is supplied
// (so creation never fails on a missing/colliding slug), and stamps published_at
// the moment a post is created already published.
func (s *blogService) applyCreateDefaults(ctx context.Context, req *models.BlogReq) {
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
	if strings.TrimSpace(req.Slug) == "" {
		req.Slug = s.uniqueSlug(ctx, req.Title)
	} else {
		req.Slug = slugify(req.Slug)
	}
}

func (s *blogService) assertSlugFree(ctx context.Context, slug string) error {
	exists, err := s.repo.SlugExists(ctx, slug)
	if err != nil {
		return fmt.Errorf("blogService.assertSlugFree: %w", err)
	}
	if exists {
		return apperr.ErrConflict
	}
	return nil
}

// uniqueSlug derives a URL-safe slug from the title and appends a numeric suffix
// until it is free, so creation never fails on a slug collision.
func (s *blogService) uniqueSlug(ctx context.Context, title string) string {
	base := slugify(title)
	if base == "" {
		base = "post"
	}
	slug := base
	for i := 2; ; i++ {
		exists, err := s.repo.SlugExists(ctx, slug)
		if err != nil || !exists {
			return slug
		}
		slug = base + "-" + strconv.Itoa(i)
	}
}

func (s *blogService) syncRelations(ctx context.Context, blogID int64, categoryIDs, productIDs, tagIDs []int64) error {
	if err := s.repo.AssignCategories(ctx, blogID, categoryIDs); err != nil {
		return fmt.Errorf("assign categories: %w", err)
	}
	if err := s.repo.AssignProducts(ctx, blogID, productIDs); err != nil {
		return fmt.Errorf("assign products: %w", err)
	}
	if err := s.repo.AssignTags(ctx, blogID, tagIDs); err != nil {
		return fmt.Errorf("assign tags: %w", err)
	}
	return nil
}

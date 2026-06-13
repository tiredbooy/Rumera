// internal/services/blog_service.go
package services

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
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
	GetAll(ctx context.Context) ([]*models.Blog, error)
	Update(ctx context.Context, id int64, req *models.BlogUpdateReq) (*models.BlogDetailResponse, error)
	Delete(ctx context.Context, id int64) error
	RecordRead(ctx context.Context, id int64) error
}

type pgxBeginner interface {
	Begin(ctx context.Context) (pgx.Tx, error)
}

type blogService struct {
	repo repositories.BlogRepository
	db   pgxBeginner
}

func NewBlogService(repo repositories.BlogRepository, db pgxBeginner) BlogService {
	return &blogService{repo: repo, db: db}
}

// ── Reads ─────────────────────────────────────────────────────────────────────

func (s *blogService) GetAll(ctx context.Context) ([]*models.Blog, error) {
	blogs, err := s.repo.GetAll(ctx)
	if err != nil {
		return nil, fmt.Errorf("blogService.GetAll: %w", err)
	}
	return blogs, nil
}

func (s *blogService) GetByID(ctx context.Context, id int64) (*models.BlogDetailResponse, error) {
	return s.hydrate(ctx, func() (*models.Blog, error) {
		return s.repo.GetByID(ctx, id)
	})
}

func (s *blogService) GetBySlug(ctx context.Context, slug string) (*models.BlogDetailResponse, error) {
	return s.hydrate(ctx, func() (*models.Blog, error) {
		return s.repo.GetBySlug(ctx, slug)
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
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("blogService.Update: begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	blog, err := s.repo.Update(ctx, id, req)
	if err != nil {
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

	return s.hydrate(ctx, func() (*models.Blog, error) { return blog, nil })
}

func (s *blogService) Delete(ctx context.Context, id int64) error {
	if err := s.repo.SoftDelete(ctx, id); err != nil {
		return fmt.Errorf("blogService.Delete: %w", err)
	}
	return nil
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func (s *blogService) hydrate(ctx context.Context, load func() (*models.Blog, error)) (*models.BlogDetailResponse, error) {
	blog, err := load()
	if err != nil {
		return nil, err
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
			TimeToRead:      blog.TimeToRead,
			TotalReads:      blog.TotalReads,
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

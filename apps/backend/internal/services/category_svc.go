package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
)

type CategoryService interface {
	Create(ctx context.Context, req models.CreateCategoryReq) (*models.Category, error)
	GetByID(ctx context.Context, id int64) (*models.Category, error)
	GetBySlug(ctx context.Context, slug string) (*models.Category, error)
	GetAll(ctx context.Context, filter models.CategoryFilter) ([]*models.Category, int64, error)
	GetTree(ctx context.Context) ([]*models.CategoryTree, error)
	GetChildren(ctx context.Context, parentID int64) ([]*models.Category, error)
	GetFeatured(ctx context.Context) ([]*models.Category, error)
	Update(ctx context.Context, id int64, req models.UpdateCategoryReq) (*models.Category, error)
	Delete(ctx context.Context, id int64) error
}

type categoryService struct {
	repo  repositories.CategoryRepository
	media *MediaLifecycleService
}

func NewCategoryService(repo repositories.CategoryRepository, media *MediaLifecycleService) CategoryService {
	return &categoryService{repo: repo, media: media}
}

// ── Writes ────────────────────────────────────────────────────────────────────

func (s *categoryService) Create(ctx context.Context, req models.CreateCategoryReq) (*models.Category, error) {
	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		return nil, apperr.ErrInvalidRequest
	}

	// Duplicate title guard
	exists, err := s.repo.ExistsByName(ctx, req.Title, 0)
	if err != nil {
		return nil, fmt.Errorf("categoryService.Create: check title: %w", err)
	}
	if exists {
		return nil, models.ErrAlreadyExists
	}
	if req.Slug != nil {
		rawSlug := strings.TrimSpace(*req.Slug)
		if rawSlug == "" {
			req.Slug = nil
		} else {
			slug := normalizePublicSlug(rawSlug)
			if slug == "" {
				return nil, apperr.ErrInvalidRequest
			}
			slugExists, err := s.repo.ExistsBySlug(ctx, slug, 0)
			if err != nil {
				return nil, fmt.Errorf("categoryService.Create: check slug: %w", err)
			}
			if slugExists {
				return nil, models.ErrAlreadyExists
			}
			req.Slug = &slug
		}
	}

	// Validate parent exists when provided
	if req.ParentID != nil {
		parentExists, err := s.repo.ExistsByID(ctx, *req.ParentID)
		if err != nil {
			return nil, fmt.Errorf("categoryService.Create: check parent: %w", err)
		}
		if !parentExists {
			return nil, models.ErrNotFound
		}
	}

	// Only one "large" homepage card at a time — this is a layout rule, not
	// a DB constraint, so it's enforced here rather than with a CHECK.
	if req.CardSize != nil && *req.CardSize == "large" {
		if err := s.assertNoOtherLargeCard(ctx, nil); err != nil {
			return nil, err
		}
	}

	category, err := s.repo.Create(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("categoryService.Create: %w", err)
	}
	return category, nil
}

func (s *categoryService) Update(ctx context.Context, id int64, req models.UpdateCategoryReq) (*models.Category, error) {
	// Ensure the category being updated actually exists
	current, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("categoryService.Update: %w", err)
	}

	// Duplicate title guard (only when title is being changed)
	if req.Title != nil {
		title := strings.TrimSpace(*req.Title)
		if title == "" {
			return nil, apperr.ErrInvalidRequest
		}
		req.Title = &title
		exists, err := s.repo.ExistsByName(ctx, title, id)
		if err != nil {
			return nil, fmt.Errorf("categoryService.Update: check title: %w", err)
		}
		if exists {
			return nil, models.ErrAlreadyExists
		}
	}
	if req.Slug.Set && req.Slug.Value != nil {
		slug := normalizePublicSlug(*req.Slug.Value)
		if slug == "" || utf8.RuneCountInString(slug) > 255 {
			return nil, apperr.ErrInvalidRequest
		}
		exists, err := s.repo.ExistsBySlug(ctx, slug, id)
		if err != nil {
			return nil, fmt.Errorf("categoryService.Update: check slug: %w", err)
		}
		if exists {
			return nil, models.ErrAlreadyExists
		}
		req.Slug.Value = &slug
	}

	// Validate new parent exists when provided, and guard against
	// a category being set as its own parent
	if req.ParentID.Set && req.ParentID.Value != nil {
		parentID := *req.ParentID.Value
		if parentID <= 0 || parentID == id {
			return nil, models.ErrInvalidState
		}
		parentExists, err := s.repo.ExistsByID(ctx, parentID)
		if err != nil {
			return nil, fmt.Errorf("categoryService.Update: check parent: %w", err)
		}
		if !parentExists {
			return nil, models.ErrNotFound
		}
	}

	// Only one "large" homepage card at a time.
	if req.CardSize != nil && *req.CardSize == "large" {
		if err := s.assertNoOtherLargeCard(ctx, &id); err != nil {
			return nil, err
		}
	}

	category, err := s.repo.Update(ctx, id, req)
	if err != nil {
		return nil, fmt.Errorf("categoryService.Update: %w", err)
	}
	if !sameMediaURL(current.ImageURL, category.ImageURL) {
		s.media.CleanupURLs(ctx, current.ImageURL)
	}
	return category, nil
}

func (s *categoryService) Delete(ctx context.Context, id int64) error {
	// Block deletion if this category has children — the schema has no
	// ON DELETE CASCADE so we'd orphan them silently otherwise
	children, err := s.repo.GetChildren(ctx, id)
	if err != nil {
		return fmt.Errorf("categoryService.Delete: check children: %w", err)
	}
	if len(children) > 0 {
		return models.ErrHasChildren
	}
	current, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("categoryService.Delete: load media: %w", err)
	}

	if err := s.repo.Delete(ctx, id); err != nil {
		return fmt.Errorf("categoryService.Delete: %w", err)
	}
	s.media.CleanupURLs(ctx, current.ImageURL)
	return nil
}

// ── Reads ─────────────────────────────────────────────────────────────────────

func (s *categoryService) GetByID(ctx context.Context, id int64) (*models.Category, error) {
	category, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("categoryService.GetByID: %w", err)
	}
	return category, nil
}

func (s *categoryService) GetBySlug(ctx context.Context, slug string) (*models.Category, error) {
	slug = normalizePublicSlug(slug)
	if slug == "" {
		return nil, apperr.ErrNotFound
	}

	category, err := s.repo.GetBySlug(ctx, slug)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}
	return category, nil
}

func (s *categoryService) GetAll(ctx context.Context, filter models.CategoryFilter) ([]*models.Category, int64, error) {
	categories, total, err := s.repo.GetAll(ctx, filter)
	if err != nil {
		return nil, 0, fmt.Errorf("categoryService.GetAll: %w", err)
	}
	return categories, total, nil
}

func (s *categoryService) GetChildren(ctx context.Context, parentID int64) ([]*models.Category, error) {
	children, err := s.repo.GetChildren(ctx, parentID)
	if err != nil {
		return nil, fmt.Errorf("categoryService.GetChildren: %w", err)
	}
	return children, nil
}

func (s *categoryService) GetFeatured(ctx context.Context) ([]*models.Category, error) {
	categories, err := s.repo.GetFeatured(ctx)
	if err != nil {
		return nil, fmt.Errorf("categoryService.GetFeatured: %w", err)
	}
	return categories, nil
}

func (s *categoryService) GetTree(ctx context.Context) ([]*models.CategoryTree, error) {
	flat, err := s.repo.GetTree(ctx)
	if err != nil {
		return nil, fmt.Errorf("categoryService.GetTree: %w", err)
	}
	return buildTree(flat), nil
}

// ── Business rules ────────────────────────────────────────────────────────────

// assertNoOtherLargeCard enforces "at most one large homepage card" at a
// time. excludeID is nil on create, or the id being updated on update, so a
// category doesn't conflict with its own existing "large" row.
func (s *categoryService) assertNoOtherLargeCard(ctx context.Context, excludeID *int64) error {
	featured, err := s.repo.GetFeatured(ctx)
	if err != nil {
		return fmt.Errorf("categoryService: check large card: %w", err)
	}
	for _, c := range featured {
		if c.CardSize != "large" {
			continue
		}
		if excludeID != nil && c.ID == *excludeID {
			continue
		}
		return models.ErrInvalidState
	}
	return nil
}

// ── Tree builder ──────────────────────────────────────────────────────────────
func buildTree(flat []*models.Category) []*models.CategoryTree {
	// Always return a non-nil slice so the JSON envelope serialises as `[]`
	// (not `null`); clients iterate over this directly and a null breaks them.
	if len(flat) == 0 {
		return []*models.CategoryTree{}
	}

	// Step 1 — allocate a tree node for every category
	nodes := make(map[int64]*models.CategoryTree, len(flat))
	for _, c := range flat {
		nodes[c.ID] = &models.CategoryTree{
			ID:          c.ID,
			Title:       c.Title,
			Description: c.Description,
			Slug:        c.Slug,
			ImageURL:    c.ImageURL,
		}
	}

	// Step 2 — attach each node to its parent; collect roots
	roots := make([]*models.CategoryTree, 0, len(flat))
	for _, c := range flat {
		node := nodes[c.ID]
		if c.ParentID == nil {
			roots = append(roots, node)
		} else {
			if parent, ok := nodes[*c.ParentID]; ok {
				parent.Children = append(parent.Children, node)
			}
			// If the parent isn't in the map the row is orphaned — skip it
			// rather than panicking; the DB should enforce referential integrity.
		}
	}

	return roots
}

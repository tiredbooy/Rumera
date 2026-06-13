package services

import (
	"context"
	"fmt"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
)

type CategoryService interface {
	Create(ctx context.Context, req models.CreateCategoryReq) (*models.Category, error)
	GetByID(ctx context.Context, id int64) (*models.Category, error)
	GetAll(ctx context.Context, filter models.CategoryFilter) ([]*models.Category, int64, error)
	GetTree(ctx context.Context) ([]*models.CategoryTree, error)
	GetChildren(ctx context.Context, parentID int64) ([]*models.Category, error)
	Update(ctx context.Context, id int64, req models.UpdateCategoryReq) (*models.Category, error)
	Delete(ctx context.Context, id int64) error
}

type categoryService struct {
	repo repositories.CategoryRepository
}

func NewCategoryService(repo repositories.CategoryRepository) CategoryService {
	return &categoryService{repo: repo}
}

// ── Writes ────────────────────────────────────────────────────────────────────

func (s *categoryService) Create(ctx context.Context, req models.CreateCategoryReq) (*models.Category, error) {
	// Duplicate name guard
	exists, err := s.repo.ExistsByName(ctx, req.Name)
	if err != nil {
		return nil, fmt.Errorf("categoryService.Create: check name: %w", err)
	}
	if exists {
		return nil, models.ErrAlreadyExists
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

	category, err := s.repo.Create(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("categoryService.Create: %w", err)
	}
	return category, nil
}

func (s *categoryService) Update(ctx context.Context, id int64, req models.UpdateCategoryReq) (*models.Category, error) {
	// Ensure the category being updated actually exists
	if _, err := s.repo.GetByID(ctx, id); err != nil {
		return nil, fmt.Errorf("categoryService.Update: %w", err)
	}

	// Duplicate name guard (only when name is being changed)
	if req.Name != nil {
		exists, err := s.repo.ExistsByName(ctx, *req.Name)
		if err != nil {
			return nil, fmt.Errorf("categoryService.Update: check name: %w", err)
		}
		if exists {
			return nil, models.ErrAlreadyExists
		}
	}

	// Validate new parent exists when provided, and guard against
	// a category being set as its own parent
	if req.ParentID != nil {
		if *req.ParentID == id {
			return nil, models.ErrInvalidState
		}
		parentExists, err := s.repo.ExistsByID(ctx, *req.ParentID)
		if err != nil {
			return nil, fmt.Errorf("categoryService.Update: check parent: %w", err)
		}
		if !parentExists {
			return nil, models.ErrNotFound
		}
	}

	category, err := s.repo.Update(ctx, id, req)
	if err != nil {
		return nil, fmt.Errorf("categoryService.Update: %w", err)
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

	if err := s.repo.Delete(ctx, id); err != nil {
		return fmt.Errorf("categoryService.Delete: %w", err)
	}
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

func (s *categoryService) GetTree(ctx context.Context) ([]*models.CategoryTree, error) {
	flat, err := s.repo.GetTree(ctx)
	if err != nil {
		return nil, fmt.Errorf("categoryService.GetTree: %w", err)
	}
	return buildTree(flat), nil
}

// ── Tree builder ──────────────────────────────────────────────────────────────
func buildTree(flat []*models.Category) []*models.CategoryTree {
	if len(flat) == 0 {
		return nil
	}

	// Step 1 — allocate a tree node for every category
	nodes := make(map[int64]*models.CategoryTree, len(flat))
	for _, c := range flat {
		nodes[c.ID] = &models.CategoryTree{
			ID:          c.ID,
			Name:        c.Name,
			Description: c.Description,
			Slug:        c.Slug,
		}
	}

	// Step 2 — attach each node to its parent; collect roots
	var roots []*models.CategoryTree
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

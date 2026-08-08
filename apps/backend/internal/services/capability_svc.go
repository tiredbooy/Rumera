package services

import (
	"context"
	"sort"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
)

type CapabilityService struct {
	repo repositories.CapabilityRepository
}

func NewCapabilityService(repo repositories.CapabilityRepository) *CapabilityService {
	return &CapabilityService{repo: repo}
}

// PermissionsForRole returns the capability set for a panel role.
// Admin always receives the full known catalogue (superuser), even if the row
// is empty — fail open for admin, fail closed for staff.
func (s *CapabilityService) PermissionsForRole(ctx context.Context, role string) ([]string, error) {
	if !models.IsPanelRole(role) {
		return []string{}, nil
	}
	if s == nil || s.repo == nil {
		if role == models.UserRoleAdmin {
			return models.AllKnownPermissions(), nil
		}
		return []string{}, nil
	}
	perms, err := s.repo.GetByRole(ctx, role)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	if role == models.UserRoleAdmin && len(perms) == 0 {
		return models.AllKnownPermissions(), nil
	}
	return dedupeSort(perms), nil
}

func (s *CapabilityService) HasPermission(ctx context.Context, role, permission string) (bool, error) {
	if role == models.UserRoleAdmin {
		// Admin is superuser for the panel surface.
		return models.IsKnownPermission(permission) || permission == "", nil
	}
	if !models.IsPanelRole(role) {
		return false, nil
	}
	perms, err := s.PermissionsForRole(ctx, role)
	if err != nil {
		return false, err
	}
	for _, p := range perms {
		if p == permission {
			return true, nil
		}
	}
	return false, nil
}

func (s *CapabilityService) ListMatrix(ctx context.Context) ([]models.RoleCapabilities, error) {
	if s == nil || s.repo == nil {
		return []models.RoleCapabilities{
			{Role: models.UserRoleAdmin, Permissions: models.AllKnownPermissions()},
			{Role: models.UserRoleStaff, Permissions: []string{}},
		}, nil
	}
	items, err := s.repo.ListPanelRoles(ctx)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	// Ensure both panel roles appear even if a seed is missing.
	have := map[string]bool{}
	for i := range items {
		items[i].Permissions = dedupeSort(items[i].Permissions)
		have[items[i].Role] = true
	}
	if !have[models.UserRoleAdmin] {
		items = append(items, models.RoleCapabilities{
			Role: models.UserRoleAdmin, Permissions: models.AllKnownPermissions(),
		})
	}
	if !have[models.UserRoleStaff] {
		items = append(items, models.RoleCapabilities{
			Role: models.UserRoleStaff, Permissions: []string{},
		})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].Role < items[j].Role })
	return items, nil
}

func (s *CapabilityService) Replace(ctx context.Context, role string, permissions []string) (*models.RoleCapabilities, error) {
	if role != models.UserRoleAdmin && role != models.UserRoleStaff {
		return nil, apperr.ErrInvalidRequest
	}
	// Admin row may be edited for documentation/UI, but enforcement still treats
	// admin as superuser. Staff must only receive known permissions.
	clean := make([]string, 0, len(permissions))
	seen := map[string]struct{}{}
	for _, p := range permissions {
		if !models.IsKnownPermission(p) {
			return nil, apperr.ErrInvalidRequest
		}
		if _, ok := seen[p]; ok {
			continue
		}
		seen[p] = struct{}{}
		clean = append(clean, p)
	}
	// Never empty admin of all capabilities in storage — keep at least roles:manage
	// so an operator cannot lock every admin out of recovery UI.
	if role == models.UserRoleAdmin && len(clean) == 0 {
		clean = models.AllKnownPermissions()
	}
	if err := s.repo.Replace(ctx, role, clean); err != nil {
		return nil, apperr.ErrInternal
	}
	return &models.RoleCapabilities{Role: role, Permissions: dedupeSort(clean)}, nil
}

func dedupeSort(in []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(in))
	for _, p := range in {
		if p == "" {
			continue
		}
		if _, ok := seen[p]; ok {
			continue
		}
		seen[p] = struct{}{}
		out = append(out, p)
	}
	sort.Strings(out)
	return out
}

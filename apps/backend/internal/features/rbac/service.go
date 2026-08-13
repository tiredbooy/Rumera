package rbac

import (
	"context"
	"sort"

	"github.com/tiredbooy/pkg/apperr"
)

// Service enforces and exposes panel role capabilities.
type Service struct {
	repo Repository
}

// NewService constructs a capability service. repo may be nil in tests;
// admin still fails open to the full catalogue, staff fails closed.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// PermissionsForRole returns the capability set for a panel role.
// Admin always receives the full known catalogue (superuser), even if the row
// is empty — fail open for admin, fail closed for staff.
func (s *Service) PermissionsForRole(ctx context.Context, role string) ([]string, error) {
	if !IsPanelRole(role) {
		return []string{}, nil
	}
	if s == nil || s.repo == nil {
		if role == RoleAdmin {
			return AllKnownPermissions(), nil
		}
		return []string{}, nil
	}
	perms, err := s.repo.GetByRole(ctx, role)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	if role == RoleAdmin && len(perms) == 0 {
		return AllKnownPermissions(), nil
	}
	return dedupeSort(perms), nil
}

// HasPermission reports whether role includes permission.
func (s *Service) HasPermission(ctx context.Context, role, permission string) (bool, error) {
	if role == RoleAdmin {
		// Admin is superuser for the panel surface.
		return IsKnownPermission(permission) || permission == "", nil
	}
	if !IsPanelRole(role) {
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

// ListMatrix returns capability rows for both panel roles.
func (s *Service) ListMatrix(ctx context.Context) ([]RoleCapabilities, error) {
	if s == nil || s.repo == nil {
		return []RoleCapabilities{
			{Role: RoleAdmin, Permissions: AllKnownPermissions()},
			{Role: RoleStaff, Permissions: []string{}},
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
	if !have[RoleAdmin] {
		items = append(items, RoleCapabilities{
			Role: RoleAdmin, Permissions: AllKnownPermissions(),
		})
	}
	if !have[RoleStaff] {
		items = append(items, RoleCapabilities{
			Role: RoleStaff, Permissions: []string{},
		})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].Role < items[j].Role })
	return items, nil
}

// Replace overwrites the capability set for a panel role.
func (s *Service) Replace(ctx context.Context, role string, permissions []string) (*RoleCapabilities, error) {
	if role != RoleAdmin && role != RoleStaff {
		return nil, apperr.ErrInvalidRequest
	}
	// Admin row may be edited for documentation/UI, but enforcement still treats
	// admin as superuser. Staff must only receive known permissions.
	clean := make([]string, 0, len(permissions))
	seen := map[string]struct{}{}
	for _, p := range permissions {
		if !IsKnownPermission(p) {
			return nil, apperr.ErrInvalidRequest
		}
		if _, ok := seen[p]; ok {
			continue
		}
		seen[p] = struct{}{}
		clean = append(clean, p)
	}
	// Never empty admin of all capabilities in storage — keep full catalogue
	// so an operator cannot lock every admin out of recovery UI.
	if role == RoleAdmin && len(clean) == 0 {
		clean = AllKnownPermissions()
	}
	if err := s.repo.Replace(ctx, role, clean); err != nil {
		return nil, apperr.ErrInternal
	}
	return &RoleCapabilities{Role: role, Permissions: dedupeSort(clean)}, nil
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

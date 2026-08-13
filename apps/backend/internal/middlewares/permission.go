package middlewares

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/pkg/response"
)

// PermissionChecker looks up whether a panel role includes a capability.
// Implemented by features/rbac.Service.
type PermissionChecker interface {
	HasPermission(ctx context.Context, role, permission string) (bool, error)
}

// panelSuperuserRole is the full-access admin role string (users.role = admin).
// Kept as a literal so this package does not import features/rbac.
const panelSuperuserRole = "admin"

// RequirePermission guards a route (or group) so the caller's live role must
// hold at least one of the listed capabilities. Admin is always allowed
// (superuser). Must run after Auth. An empty permission list denies everyone
// except admin. A nil checker fails closed for non-admin roles.
func RequirePermission(checker PermissionChecker, permissions ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role := Role(c)
		if role == panelSuperuserRole {
			c.Next()
			return
		}
		if checker == nil || len(permissions) == 0 {
			abort(c, response.ErrInsufficientPermissions)
			return
		}
		for _, perm := range permissions {
			if perm == "" {
				continue
			}
			ok, err := checker.HasPermission(c.Request.Context(), role, perm)
			if err != nil {
				abort(c, response.ErrInternalError)
				return
			}
			if ok {
				c.Next()
				return
			}
		}
		abort(c, response.ErrInsufficientPermissions)
	}
}

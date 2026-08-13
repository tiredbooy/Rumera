package middlewares

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/features/rbac"
)

type permStub struct {
	// role → set of granted permissions
	grants map[string]map[string]bool
	err    error
}

func (s permStub) HasPermission(_ context.Context, role, permission string) (bool, error) {
	if s.err != nil {
		return false, s.err
	}
	return s.grants[role][permission], nil
}

func TestRequirePermission(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name       string
		role       string
		checker    PermissionChecker
		perms      []string
		wantStatus int
	}{
		{
			name:       "admin superuser always allowed",
			role:       rbac.RoleAdmin,
			checker:    nil,
			perms:      []string{rbac.PermProductsWrite},
			wantStatus: http.StatusOK,
		},
		{
			name:       "admin allowed even with empty permission list",
			role:       rbac.RoleAdmin,
			checker:    nil,
			perms:      nil,
			wantStatus: http.StatusOK,
		},
		{
			name: "staff with grant allowed",
			role: rbac.RoleStaff,
			checker: permStub{grants: map[string]map[string]bool{
				rbac.RoleStaff: {rbac.PermProductsRead: true},
			}},
			perms:      []string{rbac.PermProductsRead},
			wantStatus: http.StatusOK,
		},
		{
			name: "staff without grant denied",
			role: rbac.RoleStaff,
			checker: permStub{grants: map[string]map[string]bool{
				rbac.RoleStaff: {rbac.PermOrdersRead: true},
			}},
			perms:      []string{rbac.PermProductsRead},
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "staff with nil checker denied",
			role:       rbac.RoleStaff,
			checker:    nil,
			perms:      []string{rbac.PermProductsRead},
			wantStatus: http.StatusForbidden,
		},
		{
			name: "staff matches any listed permission",
			role: rbac.RoleStaff,
			checker: permStub{grants: map[string]map[string]bool{
				rbac.RoleStaff: {rbac.PermProductsWrite: true},
			}},
			perms:      []string{rbac.PermProductsRead, rbac.PermProductsWrite},
			wantStatus: http.StatusOK,
		},
		{
			name:       "customer denied",
			role:       "customer",
			checker:    permStub{grants: map[string]map[string]bool{}},
			perms:      []string{rbac.PermProductsRead},
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "empty role denied for non-admin path",
			role:       "",
			checker:    permStub{grants: map[string]map[string]bool{}},
			perms:      []string{rbac.PermProductsRead},
			wantStatus: http.StatusForbidden,
		},
		{
			name: "staff checker error is internal not allow",
			role: rbac.RoleStaff,
			checker: permStub{
				grants: map[string]map[string]bool{},
				err:    context.DeadlineExceeded,
			},
			perms:      []string{rbac.PermProductsRead},
			wantStatus: http.StatusInternalServerError,
		},
		{
			name: "empty permission strings only deny staff",
			role: rbac.RoleStaff,
			checker: permStub{grants: map[string]map[string]bool{
				rbac.RoleStaff: {rbac.PermProductsRead: true},
			}},
			perms:      []string{"", ""},
			wantStatus: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := gin.New()
			router.GET("/x", func(c *gin.Context) {
				c.Set(ctxKeyRole, tt.role)
				c.Next()
			}, RequirePermission(tt.checker, tt.perms...), func(c *gin.Context) {
				c.Status(http.StatusOK)
			})

			req := httptest.NewRequest(http.MethodGet, "/x", nil)
			res := httptest.NewRecorder()
			router.ServeHTTP(res, req)

			if res.Code != tt.wantStatus {
				t.Fatalf("status = %d, body = %s; want %d", res.Code, res.Body.String(), tt.wantStatus)
			}
		})
	}
}

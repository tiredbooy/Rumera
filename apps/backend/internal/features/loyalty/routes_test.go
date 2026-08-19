package loyalty

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/features/rbac"
	mw "github.com/tiredbooy/internal/middlewares"
)

// capsStub is the live capability lookup the composer hands to RequirePermission.
type capsStub struct{ granted map[string]bool }

func (c capsStub) HasPermission(_ context.Context, role, permission string) (bool, error) {
	if role != rbac.RoleStaff {
		return false, nil
	}
	return c.granted[permission], nil
}

// adminEngine mirrors registerAdmin's composition for the loyalty feature:
// read ORs the specialist grant in, programme write stays customers:write,
// and adjust is loyalty:adjust alone. reached reports whether the request got
// past the capability gate on the adjust group.
func adminEngine(role string, perms ...string) (*gin.Engine, *bool) {
	gin.SetMode(gin.TestMode)
	granted := map[string]bool{}
	for _, p := range perms {
		granted[p] = true
	}
	caps := capsStub{granted: granted}

	engine := gin.New()
	admin := engine.Group("/admin")
	admin.Use(func(c *gin.Context) { c.Set("role", role); c.Next() })
	with := func(perms ...string) *gin.RouterGroup {
		g := admin.Group("")
		g.Use(mw.RequirePermission(caps, perms...))
		return g
	}
	reached := false
	adjust := with(rbac.PermLoyaltyAdjust)
	adjust.Use(func(c *gin.Context) { reached = true; c.Next() })

	RegisterAdmin(
		with(rbac.PermCustomersRead, rbac.PermCustomersWrite, rbac.PermLoyaltyAdjust),
		with(rbac.PermCustomersWrite),
		adjust,
		&Handler{},
		nil,
	)
	return engine, &reached
}

func postAdjust(t *testing.T, engine *gin.Engine) *httptest.ResponseRecorder {
	t.Helper()
	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(
		http.MethodPost,
		"/admin/users/5b2c0000-0000-0000-0000-000000000010/loyalty/adjust",
		strings.NewReader(`{"delta":1000,"idempotency_key":"mint-0001"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	engine.ServeHTTP(recorder, req)
	return recorder
}

// L-8: correcting a phone number must not also mint points. The gate is the
// route, not the button — a hidden button with a live endpoint is no permission.
func TestAdminAdjustRejectsCustomersWriteOnly(t *testing.T) {
	engine, reached := adminEngine(rbac.RoleStaff, rbac.PermCustomersRead, rbac.PermCustomersWrite)

	recorder := postAdjust(t, engine)

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("status = %d body=%s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), `"code":"INSUFFICIENT_PERMISSIONS"`) {
		t.Fatalf("body = %s", recorder.Body.String())
	}
	if *reached {
		t.Fatal("customers:write reached the adjust handler")
	}
}

// The other half of L-8: a loyalty specialist is grantable on its own — the
// section reads and the mint both open with no customers:write.
func TestLoyaltySpecialistNeedsNoCustomersWrite(t *testing.T) {
	engine, reached := adminEngine(rbac.RoleStaff, rbac.PermLoyaltyAdjust)

	if recorder := postAdjust(t, engine); recorder.Code == http.StatusForbidden {
		t.Fatalf("adjust status = %d body=%s", recorder.Code, recorder.Body.String())
	}
	if !*reached {
		t.Fatal("loyalty:adjust did not reach the adjust handler")
	}

	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/admin/loyalty/members", nil))
	if recorder.Code == http.StatusForbidden {
		t.Fatalf("members status = %d body=%s", recorder.Code, recorder.Body.String())
	}
}

// Programme rates stay on customers:write (unchanged by L-8), and the mint
// stays shut for that same caller.
func TestProgrammeWriteStaysOnCustomersWrite(t *testing.T) {
	engine, _ := adminEngine(rbac.RoleStaff, rbac.PermCustomersWrite)

	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPut, "/admin/loyalty/programme", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	engine.ServeHTTP(recorder, req)

	if recorder.Code == http.StatusForbidden {
		t.Fatalf("programme status = %d body=%s", recorder.Code, recorder.Body.String())
	}
}

// loyalty:adjust must be grantable through the roles matrix, not just declared.
func TestLoyaltyAdjustIsInTheCatalogue(t *testing.T) {
	if !rbac.IsKnownPermission(rbac.PermLoyaltyAdjust) {
		t.Fatal("loyalty:adjust missing from AllKnownPermissions")
	}
}

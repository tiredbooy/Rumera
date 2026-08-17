package users

import (
	"testing"

	"github.com/gin-gonic/gin"
)

func TestAdminBanCapabilityIsNotCustomersWrite(t *testing.T) {
	if AdminBanCapability != "customers:ban" {
		t.Fatalf("AdminBanCapability = %q; want customers:ban", AdminBanCapability)
	}
	if AdminBanCapability == "customers:write" {
		t.Fatal("ban must not alias customers:write")
	}
}

func TestRegisterAdminMountsBanAndUnban(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	admin := r.Group("/admin")
	RegisterAdmin(admin.Group(""), admin.Group(""), admin.Group(""), &Handler{})

	want := map[string]bool{
		"POST /admin/users/:userID/ban":   false,
		"POST /admin/users/:userID/unban": false,
		"POST /admin/users":               false,
		"PATCH /admin/users/:userID":      false,
	}
	for _, route := range r.Routes() {
		key := route.Method + " " + route.Path
		if _, ok := want[key]; ok {
			want[key] = true
		}
	}
	for route, found := range want {
		if !found {
			t.Errorf("expected route %s", route)
		}
	}
}

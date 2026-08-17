package routes

import (
	"testing"

	"github.com/gin-gonic/gin"
	config "github.com/tiredbooy/configs"
	"github.com/tiredbooy/internal/handlers"
	"github.com/tiredbooy/pkg/token"
	"go.uber.org/zap"
)

// TestSetupRegistersWithoutPanic ensures the full route tree registers cleanly —
// gin panics at registration time on wildcard/static conflicts, so this guards
// against those without needing a database.
func TestSetupRegistersWithoutPanic(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := &handlers.Handler{}
	jwt := token.NewManager(&config.Config{JWTSecret: "test"}, zap.NewNop())

	defer func() {
		if rec := recover(); rec != nil {
			t.Fatalf("route registration panicked: %v", rec)
		}
	}()

	nop := func(c *gin.Context) { c.Next() }
	Setup(r, h, jwt, nil, nop, nop)

	if len(r.Routes()) == 0 {
		t.Fatal("expected routes to be registered")
	}

	// Spot-check representative paths across identity, catalogue, commerce,
	// content, and analytics. Zero path changes is a BE-040 non-negotiable.
	want := map[string]bool{
		// Health / media transform
		"GET /health":     false,
		"GET /media/*key": false,

		// Identity / RBAC
		"GET /api/v1/admin/roles":                false,
		"GET /api/v1/admin/capabilities":         false,
		"PUT /api/v1/admin/capabilities/:role":   false,
		"GET /api/v1/admin/users":                false,
		"POST /api/v1/admin/users":               false,
		"GET /api/v1/admin/users/:userID/audit":  false,
		"POST /api/v1/admin/users/:userID/ban":   false,
		"POST /api/v1/admin/users/:userID/unban": false,
		"PATCH /api/v1/auth/me":                  false,

		// Catalogue
		"GET /api/v1/categories/slug/:slug":                    false,
		"GET /api/v1/categories/:id":                           false,
		"GET /api/v1/brands/slug/:slug":                        false,
		"GET /api/v1/products/slug/:slug":                      false,
		"GET /api/v1/admin/products/:id":                       false,
		"POST /api/v1/admin/products/aggregate":                false,
		"PUT /api/v1/admin/products/:id/aggregate":             false,
		"GET /api/v1/admin/option-types":                       false,
		"POST /api/v1/admin/option-types/:optionTypeID/values": false,
		"PUT /api/v1/admin/variants/:id/options":               false,

		// Content / media
		"PUT /api/v1/admin/hero-slides/order":                  false,
		"POST /api/v1/admin/uploads/:ownerType/:ownerID/:role": false,
		"POST /api/v1/admin/products/:id/images/url":           false,
		"GET /api/v1/admin/blogs":                              false,
		"GET /api/v1/admin/blog-categories":                    false,
		"GET /api/v1/admin/blog-categories/:id":                false,

		// Commerce
		"GET /api/v1/admin/inventory":                               false,
		"GET /api/v1/admin/inventory/movements":                     false,
		"GET /api/v1/admin/inventory/variants/:variantID":           false,
		"POST /api/v1/admin/inventory/variants/:variantID/adjust":   false,
		"PATCH /api/v1/admin/inventory/variants/:variantID/reorder": false,
		"GET /api/v1/cart":    false,
		"POST /api/v1/orders": false,

		// Analytics
		"GET /api/v1/admin/analytics/revenue/summary":      false,
		"GET /api/v1/admin/analytics/products/top-revenue": false,
		"GET /api/v1/admin/analytics/search/top-terms":     false,
		"GET /api/v1/admin/analytics/events/breakdown":     false,
	}
	for _, route := range r.Routes() {
		key := route.Method + " " + route.Path
		if _, ok := want[key]; ok {
			want[key] = true
		}
	}
	for route, found := range want {
		if !found {
			t.Errorf("expected route %s to be registered", route)
		}
	}
}

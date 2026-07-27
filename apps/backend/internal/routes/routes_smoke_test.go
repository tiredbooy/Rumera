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

	Setup(r, h, jwt, nil, func(c *gin.Context) { c.Next() })

	if len(r.Routes()) == 0 {
		t.Fatal("expected routes to be registered")
	}
	want := map[string]bool{
		"GET /api/v1/categories/slug/:slug":                    false,
		"GET /api/v1/categories/:id":                           false,
		"GET /api/v1/products/slug/:slug":                      false,
		"GET /api/v1/admin/products/:id":                       false,
		"POST /api/v1/admin/products/aggregate":                false,
		"PUT /api/v1/admin/products/:id/aggregate":             false,
		"GET /api/v1/admin/option-types":                       false,
		"POST /api/v1/admin/option-types/:optionTypeID/values": false,
		"PUT /api/v1/admin/variants/:id/options":               false,
		"PUT /api/v1/admin/hero-slides/order":                  false,
		"POST /api/v1/admin/uploads/:ownerType/:ownerID/:role": false,
		"POST /api/v1/admin/products/:id/images/url":           false,
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

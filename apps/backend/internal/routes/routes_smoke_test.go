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
}

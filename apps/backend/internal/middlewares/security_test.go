package middlewares

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestCORS_OPTIONSAllowHeadersIncludesIdempotencyKey(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(CORS([]string{"https://store.example"}))
	r.POST("/orders", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodOptions, "/orders", nil)
	req.Header.Set("Origin", "https://store.example")
	req.Header.Set("Access-Control-Request-Method", "POST")
	req.Header.Set("Access-Control-Request-Headers", "Authorization, Content-Type, Idempotency-Key")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNoContent {
		t.Fatalf("OPTIONS: got %d, want 204", w.Code)
	}
	allow := w.Header().Get("Access-Control-Allow-Headers")
	if !strings.Contains(allow, "Idempotency-Key") {
		t.Fatalf("Allow-Headers %q missing Idempotency-Key", allow)
	}
}

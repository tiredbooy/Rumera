package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestRegisterPublicThrottlesRefreshLogoutValidate(t *testing.T) {
	gin.SetMode(gin.TestMode)

	paths := []struct {
		method, path string
	}{
		{http.MethodPost, "/api/v1/auth/refresh"},
		{http.MethodPost, "/api/v1/auth/logout"},
		{http.MethodGet, "/api/v1/auth/password/validate"},
	}

	for _, tc := range paths {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			r := gin.New()
			RegisterPublic(r.Group("/api/v1"), &Handler{}, nil, nil)

			do := func() int {
				w := httptest.NewRecorder()
				req := httptest.NewRequest(tc.method, tc.path, nil)
				req.RemoteAddr = "203.0.113.10:1234"
				r.ServeHTTP(w, req)
				return w.Code
			}

			for i := 1; i <= 10; i++ {
				if code := do(); code == http.StatusTooManyRequests {
					t.Fatalf("hit %d: got 429, want under the 10/min cap", i)
				}
			}
			if code := do(); code != http.StatusTooManyRequests {
				t.Fatalf("hit 11: got %d, want 429", code)
			}
		})
	}
}

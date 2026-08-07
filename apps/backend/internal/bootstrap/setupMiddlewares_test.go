package bootstrap

import (
	"compress/gzip"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	config "github.com/tiredbooy/configs"
	"github.com/tiredbooy/pkg/metrics"
	"go.uber.org/zap"
)

func TestMetricsEndpointIsCompressedOnlyOnce(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	setupMiddlewares(router, &config.Config{MediaMaxUploadMB: 15}, zap.NewNop())
	router.GET("/metrics", gin.WrapH(metrics.Handler()))

	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	req.Header.Set("Accept-Encoding", "gzip")
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("GET /metrics status = %d, want 200", res.Code)
	}
	if got := res.Header().Get("Content-Encoding"); got != "gzip" {
		t.Fatalf("Content-Encoding = %q, want gzip", got)
	}

	reader, err := gzip.NewReader(res.Body)
	if err != nil {
		t.Fatalf("open gzip response: %v", err)
	}
	decompressed, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("read gzip response: %v", err)
	}
	if err := reader.Close(); err != nil {
		t.Fatalf("close gzip response: %v", err)
	}

	if len(decompressed) >= 2 && decompressed[0] == 0x1f && decompressed[1] == 0x8b {
		t.Fatal("metrics response remains gzip-compressed after one decompression")
	}
	if !strings.Contains(string(decompressed), "go_gc_duration_seconds") {
		t.Fatal("decompressed response is not Prometheus text exposition")
	}
}

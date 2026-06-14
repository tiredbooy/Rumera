package middleware

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel/trace"
)

func init() { gin.SetMode(gin.TestMode) }

func TestTraceID_NoSpan(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("GET", "/", nil)

	if got := traceID(c); got != "" {
		t.Fatalf("traceID with no active span = %q; want empty", got)
	}
}

func TestTraceID_WithSpan(t *testing.T) {
	tid, err := trace.TraceIDFromHex("0102030405060708090a0b0c0d0e0f10")
	if err != nil {
		t.Fatalf("build trace id: %v", err)
	}
	sid, err := trace.SpanIDFromHex("0102030405060708")
	if err != nil {
		t.Fatalf("build span id: %v", err)
	}
	sc := trace.NewSpanContext(trace.SpanContextConfig{TraceID: tid, SpanID: sid})

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	req := httptest.NewRequest("GET", "/", nil)
	c.Request = req.WithContext(trace.ContextWithSpanContext(req.Context(), sc))

	if got := traceID(c); got != tid.String() {
		t.Fatalf("traceID = %q; want %q", got, tid.String())
	}
}

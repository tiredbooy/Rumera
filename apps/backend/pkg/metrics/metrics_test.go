package metrics

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// scrape renders the current /metrics output as a string.
func scrape(t *testing.T) string {
	t.Helper()
	rec := httptest.NewRecorder()
	Handler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("/metrics status = %d, want 200", rec.Code)
	}
	return rec.Body.String()
}

func TestObserveHTTP_ExposedOnScrape(t *testing.T) {
	ObserveHTTP(http.MethodGet, "/api/v1/products/:id", 200, 12*time.Millisecond)

	body := scrape(t)
	for _, want := range []string{
		`http_requests_total{method="GET",route="/api/v1/products/:id",status="200"}`,
		"http_request_duration_seconds_bucket",
		`route="/api/v1/products/:id"`,
	} {
		if !strings.Contains(body, want) {
			t.Errorf("scrape missing %q\n---\n%s", want, body)
		}
	}
}

func TestIncCache_ExposedOnScrape(t *testing.T) {
	IncCache(CacheHit)
	IncCache(CacheMiss)
	IncCache(CacheError)

	body := scrape(t)
	for _, result := range []string{CacheHit, CacheMiss, CacheError} {
		if !strings.Contains(body, `cache_requests_total{result="`+result+`"}`) {
			t.Errorf("scrape missing cache_requests_total for result=%q", result)
		}
	}
}

func TestRegisterQueueDepth_ExposedOnScrape(t *testing.T) {
	depth := 7
	RegisterQueueDepth("events", func() int { return depth }, 10_000)

	body := scrape(t)
	if !strings.Contains(body, `analytics_queue_depth{queue="events"} 7`) {
		t.Errorf("queue depth gauge missing or wrong value\n---\n%s", body)
	}
	if !strings.Contains(body, `analytics_queue_capacity{queue="events"} 10000`) {
		t.Errorf("queue capacity gauge missing or wrong value\n---\n%s", body)
	}

	// Gauge reflects live state at scrape time, not registration time.
	depth = 42
	if !strings.Contains(scrape(t), `analytics_queue_depth{queue="events"} 42`) {
		t.Error("queue depth gauge did not reflect updated live value")
	}
}

func TestRegister_DuplicateIsTolerated(t *testing.T) {
	// Registering the same queue collectors twice must not panic (init-safety).
	RegisterQueueDepth("dup", func() int { return 1 }, 2)
	RegisterQueueDepth("dup", func() int { return 1 }, 2)
}

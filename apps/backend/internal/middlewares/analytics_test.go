package middlewares

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/tiredbooy/internal/analytics"
)

func TestResolveEventTypeUsesV1Routes(t *testing.T) {
	cases := []struct {
		method string
		path   string
		want   string
	}{
		{"GET", "/api/v1/products/:id", "product_viewed"},
		{"GET", "/api/v1/products/slug/:slug", "product_viewed"},
		{"GET", "/api/v1/products/:id/reviews", "page_viewed"},
		{"GET", "/api/v1/search", "search_performed"},
		{"POST", "/api/v1/orders", "order_created"},
		{"POST", "/api/v1/cart", "cart_updated"},
		{"GET", "/api/v1/recipes/:id", "recipe_viewed"},
	}
	for _, tc := range cases {
		got := resolveEventType(tc.method, tc.path)
		if got != tc.want {
			t.Fatalf("%s %s: got %q, want %q", tc.method, tc.path, got, tc.want)
		}
	}
}

func TestBuildEventStorefrontProductSearch(t *testing.T) {
	event := buildEvent(
		"GET",
		"/api/v1/products",
		"/api/v1/products?search=whisky",
		"",
		"Mozilla/5.0",
		map[string][]string{"search": {"whisky"}},
		[16]byte{1},
		[16]byte{2},
		nil,
		0,
		map[string]any{"query": "whisky", "results_count": int64(3)},
	)
	if event.EventType != analytics.EventSearchPerformed {
		t.Fatalf("event type = %q, want search_performed", event.EventType)
	}
	if event.Payload["query"] != "whisky" {
		t.Fatalf("query = %#v", event.Payload["query"])
	}
	n, ok := event.Payload["results_count"].(int64)
	if !ok || n != 3 {
		t.Fatalf("results_count = %#v, want int64(3)", event.Payload["results_count"])
	}
}

func TestBuildEventProductSearchDoesNotInventResultsCount(t *testing.T) {
	event := buildEvent(
		"GET",
		"/api/v1/products",
		"/api/v1/products?search=whisky",
		"",
		"Mozilla/5.0",
		map[string][]string{"search": {"whisky"}},
		[16]byte{1},
		[16]byte{2},
		nil,
		0,
		nil,
	)
	if event.EventType != analytics.EventSearchPerformed {
		t.Fatalf("event type = %q, want search_performed", event.EventType)
	}
	if event.Payload["query"] != "whisky" {
		t.Fatalf("query = %#v", event.Payload["query"])
	}
	if _, ok := event.Payload["results_count"]; ok {
		t.Fatalf("must not invent results_count = %#v", event.Payload["results_count"])
	}
}

func TestBuildEventProductListWithoutSearchIsPageView(t *testing.T) {
	event := buildEvent(
		"GET",
		"/api/v1/products",
		"/api/v1/products",
		"",
		"Mozilla/5.0",
		map[string][]string{},
		[16]byte{1},
		[16]byte{2},
		nil,
		0,
		nil,
	)
	if event.EventType != "page_viewed" {
		t.Fatalf("event type = %q, want page_viewed", event.EventType)
	}
}

func TestBuildEventAttachesCatalogProductID(t *testing.T) {
	event := buildEvent(
		"GET",
		"/api/v1/products/:id",
		"/api/v1/products/12",
		"",
		"Mozilla/5.0",
		map[string][]string{},
		[16]byte{1},
		[16]byte{2},
		nil,
		12,
		nil,
	)
	if event.EventType != "product_viewed" {
		t.Fatalf("event type = %q, want product_viewed", event.EventType)
	}
	id, ok := event.Payload["product_id"].(int64)
	if !ok || id != 12 {
		t.Fatalf("payload product_id = %#v, want int64(12)", event.Payload["product_id"])
	}
}

func TestAnalyticsPersistsSidDidCookies(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(Analytics(analytics.NewQueue(nil)))
	r.GET("/ping", func(c *gin.Context) { c.Status(http.StatusNoContent) })

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/ping", nil))

	sid := cookieValue(w, analytics.SessionCookieName)
	did := cookieValue(w, analytics.DeviceCookieName)
	if _, err := uuid.Parse(sid); err != nil {
		t.Fatalf("sid Set-Cookie = %q: %v", sid, err)
	}
	if _, err := uuid.Parse(did); err != nil {
		t.Fatalf("did Set-Cookie = %q: %v", did, err)
	}
	if sid == did {
		t.Fatal("sid and did must be distinct")
	}
}

func TestAnalyticsReusesIncomingSidDid(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(Analytics(analytics.NewQueue(nil)))
	r.GET("/ping", func(c *gin.Context) { c.Status(http.StatusNoContent) })

	sid := "11111111-1111-1111-1111-111111111111"
	did := "22222222-2222-2222-2222-222222222222"
	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	req.AddCookie(&http.Cookie{Name: analytics.SessionCookieName, Value: sid})
	req.AddCookie(&http.Cookie{Name: analytics.DeviceCookieName, Value: did})

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if got := cookieValue(w, analytics.SessionCookieName); got != sid {
		t.Fatalf("sid = %q, want incoming %q (must not invent)", got, sid)
	}
	if got := cookieValue(w, analytics.DeviceCookieName); got != did {
		t.Fatalf("did = %q, want incoming %q (must not invent)", got, did)
	}
}

func cookieValue(w *httptest.ResponseRecorder, name string) string {
	for _, ck := range w.Result().Cookies() {
		if ck.Name == name {
			return ck.Value
		}
	}
	return ""
}

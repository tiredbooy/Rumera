package middlewares

import "testing"

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

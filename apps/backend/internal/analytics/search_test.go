package analytics

import "testing"

func TestIsStorefrontProductSearch(t *testing.T) {
	t.Parallel()

	cases := []struct {
		method, path, search string
		want                 bool
	}{
		{"GET", "/api/v1/products", "whisky", true},
		{"GET", "/api/products", "ویسکی", true},
		{"GET", "/products", "malt", true},
		{"GET", "/api/v1/products", "  ", false},
		{"GET", "/api/v1/products", "", false},
		{"GET", "/api/v1/products/:id", "whisky", false},
		{"GET", "/api/v1/products/slug/:slug", "whisky", false},
		{"GET", "/api/v1/admin/products", "whisky", false},
		{"GET", "/api/v1/search", "whisky", false},
		{"POST", "/api/v1/products", "whisky", false},
	}
	for _, tc := range cases {
		got := IsStorefrontProductSearch(tc.method, tc.path, tc.search)
		if got != tc.want {
			t.Fatalf("%s %s search=%q: got %v, want %v", tc.method, tc.path, tc.search, got, tc.want)
		}
	}
}

func TestSearchPayload(t *testing.T) {
	t.Parallel()

	got := SearchPayload("whisky", 3)
	if got["query"] != "whisky" {
		t.Fatalf("query = %#v", got["query"])
	}
	n, ok := got["results_count"].(int64)
	if !ok || n != 3 {
		t.Fatalf("results_count = %#v, want int64(3)", got["results_count"])
	}

	zero := SearchPayload("nope", 0)
	if zero["results_count"].(int64) != 0 {
		t.Fatalf("zero-result count = %#v", zero["results_count"])
	}
}

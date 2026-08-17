package analytics

import "strings"

// EventSearchPerformed is the events.event_type for a shopper catalogue search.
const EventSearchPerformed = "search_performed"

// SearchPayload is the events.payload for search_performed.
// resultsCount is the unpaginated match total from a successful list read.
func SearchPayload(query string, resultsCount int64) map[string]any {
	return map[string]any{
		"query":         query,
		"results_count": resultsCount,
	}
}

// IsStorefrontProductSearch reports whether this request is the public
// catalogue search the storefront actually uses (GET /products?search=).
// There is no GET /search. Admin GET /admin/products is excluded.
func IsStorefrontProductSearch(method, path, search string) bool {
	if method != "GET" {
		return false
	}
	if strings.TrimSpace(search) == "" {
		return false
	}
	switch path {
	case "/api/v1/products", "/api/products", "/products":
		return true
	default:
		return false
	}
}

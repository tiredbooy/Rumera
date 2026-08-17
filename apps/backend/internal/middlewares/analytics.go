package middlewares

import (
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mileusna/useragent"
	"github.com/tiredbooy/internal/analytics"
	featanalytics "github.com/tiredbooy/internal/features/analytics"
	"github.com/tiredbooy/pkg/async"
)

const (
	// Context keys handlers may set so the post-request hook can attach
	// catalog identifiers without re-parsing the response body.
	AnalyticsProductIDKey = "analytics_product_id"
	AnalyticsPayloadKey   = "analytics_payload"
)

func Analytics(queue *analytics.Queue) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Persist before c.Next() so Set-Cookie is written with the response.
		// Valid incoming sid/did are reused; missing ones are minted once.
		sidRaw, _ := c.Cookie(analytics.SessionCookieName)
		didRaw, _ := c.Cookie(analytics.DeviceCookieName)
		ids := analytics.ResolveVisitorIDs(sidRaw, didRaw, gin.Mode() == gin.ReleaseMode)
		writeVisitorCookies(c, ids)
		sessionID := ids.SessionID
		deviceID := ids.DeviceID

		c.Next()

		method := c.Request.Method
		path := c.FullPath()
		if path == "" {
			path = c.Request.URL.Path
		}
		rawURL := c.Request.URL.String()
		referrer := c.Request.Referer()
		userAgentStr := c.Request.UserAgent()
		query := c.Request.URL.Query()
		userID, _ := c.Get("userID") // set by auth middleware

		// Capture catalog enrichment before leaving the request goroutine.
		var productID int64
		if raw, ok := c.Get(AnalyticsProductIDKey); ok {
			switch v := raw.(type) {
			case int64:
				productID = v
			case int:
				productID = int64(v)
			}
		}
		if productID <= 0 {
			if id, err := strconv.ParseInt(c.Param("id"), 10, 64); err == nil && id > 0 {
				productID = id
			}
		}
		var extraPayload map[string]any
		if raw, ok := c.Get(AnalyticsPayloadKey); ok {
			if m, ok := raw.(map[string]any); ok {
				extraPayload = m
			}
		}

		async.Go("analytics.capture", func() {
			event := buildEvent(
				method, path, rawURL, referrer,
				userAgentStr, query,
				sessionID, deviceID, userID,
				productID, extraPayload,
			)
			queue.Push(event)
		})
	}
}

func buildEvent(
	method, path, rawURL, referrer,
	userAgentStr string,
	query map[string][]string,
	sessionID, deviceID uuid.UUID,
	rawUserID any,
	productID int64,
	extraPayload map[string]any,
) *featanalytics.EventReq {
	ua := useragent.Parse(userAgentStr)
	deviceType := resolveDeviceType(ua)
	eventType := resolveEventType(method, path)
	searchQuery := searchQueryFromRequest(query, extraPayload)
	if analytics.IsStorefrontProductSearch(method, path, searchQuery) {
		eventType = analytics.EventSearchPerformed
	}

	payload := map[string]any{}
	for k, v := range extraPayload {
		payload[k] = v
	}
	if productID > 0 {
		payload["product_id"] = productID
	}
	if eventType == analytics.EventSearchPerformed && searchQuery != "" {
		if _, ok := payload["query"]; !ok {
			payload["query"] = searchQuery
		}
	}

	event := &featanalytics.EventReq{
		SessionID:   sessionID,
		DeviceID:    &deviceID,
		EventType:   eventType,
		PageURL:     &rawURL,
		DeviceType:  &deviceType,
		OS:          &ua.OS,
		Browser:     &ua.Name,
		UTMSource:   queryParamFromMap(query, "utm_source"),
		UTMMedium:   queryParamFromMap(query, "utm_medium"),
		UTMCampaign: queryParamFromMap(query, "utm_campaign"),
		UTMContent:  queryParamFromMap(query, "utm_content"),
		UTMTerm:     queryParamFromMap(query, "utm_term"),
		Payload:     payload,
	}

	if referrer != "" {
		event.PageReferrer = &referrer
	}

	if uid, ok := rawUserID.(uuid.UUID); ok && uid != (uuid.UUID{}) {
		event.UserID = &uid
	}

	return event
}

func resolveEventType(method, path string) string {
	// FullPath is the Gin route pattern (e.g. /api/v1/products/:id).
	switch {
	case method == "GET" && (strings.HasPrefix(path, "/api/v1/products/") || strings.HasPrefix(path, "/api/products/")):
		// Exclude list-style collections that are not a single product view.
		if strings.Contains(path, "/products/slug/") || pathEndsWithProductID(path) {
			return "product_viewed"
		}
		if strings.HasPrefix(path, "/api/v1/products/") || strings.HasPrefix(path, "/api/products/") {
			// /products/:id and nested product resources share the prefix; only
			// the bare product detail patterns count as views.
			if isProductDetailPath(path) {
				return "product_viewed"
			}
		}
	case method == "GET" && (strings.HasPrefix(path, "/api/v1/recipes/") || strings.HasPrefix(path, "/api/recipes/")):
		return "recipe_viewed"
	case method == "GET" && (strings.HasPrefix(path, "/api/v1/blogs/") || strings.HasPrefix(path, "/api/blogs/")):
		return "blog_viewed"
	case method == "GET" && (strings.HasPrefix(path, "/api/v1/search") || strings.HasPrefix(path, "/api/search")):
		return "search_performed"
	case method == "POST" && (strings.HasPrefix(path, "/api/v1/cart") || strings.HasPrefix(path, "/api/cart")):
		return "cart_updated"
	case method == "POST" && (path == "/api/v1/orders" || path == "/api/orders" ||
		strings.HasPrefix(path, "/api/v1/orders") && !strings.Contains(path[len("/api/v1/orders"):], "/") ||
		strings.HasPrefix(path, "/api/orders") && !strings.Contains(path[len("/api/orders"):], "/")):
		return "order_created"
	}
	return "page_viewed"
}

func isProductDetailPath(path string) bool {
	// Matches /api/v1/products/:id and /api/v1/products/slug/:slug only.
	if strings.Contains(path, "/products/slug/") {
		return true
	}
	return pathEndsWithProductID(path)
}

func pathEndsWithProductID(path string) bool {
	const marker = "/products/"
	idx := strings.LastIndex(path, marker)
	if idx < 0 {
		return false
	}
	rest := path[idx+len(marker):]
	// :id with no further segment (tags, images, variants, reviews, recipes).
	return rest == ":id" || (!strings.Contains(rest, "/") && rest != "")
}

func resolveDeviceType(ua useragent.UserAgent) featanalytics.DeviceType {
	switch {
	case ua.Mobile:
		return featanalytics.DeviceTypeMobile
	case ua.Tablet:
		return featanalytics.DeviceTypeTablet
	case ua.Desktop:
		return featanalytics.DeviceTypeDesktop
	default:
		return featanalytics.DeviceTypeUnknown
	}
}

func writeVisitorCookies(c *gin.Context, ids analytics.VisitorIDs) {
	for _, ck := range ids.Issued {
		c.SetSameSite(ck.SameSite)
		c.SetCookie(ck.Name, ck.Value, ck.MaxAge, ck.Path, ck.Domain, ck.Secure, ck.HttpOnly)
	}
}

func queryParamFromMap(query map[string][]string, key string) *string {
	if vals, ok := query[key]; ok && len(vals) > 0 && vals[0] != "" {
		v := vals[0]
		return &v
	}
	return nil
}

// searchQueryFromRequest prefers the handler payload, then storefront `search`,
// then the unused `q` used by the historical GET /search classifier.
func searchQueryFromRequest(query map[string][]string, extra map[string]any) string {
	if extra != nil {
		if q, ok := extra["query"].(string); ok {
			if s := strings.TrimSpace(q); s != "" {
				return s
			}
		}
	}
	if q := queryParamFromMap(query, "search"); q != nil {
		return strings.TrimSpace(*q)
	}
	if q := queryParamFromMap(query, "q"); q != nil {
		return strings.TrimSpace(*q)
	}
	return ""
}

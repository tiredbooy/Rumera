package middlewares

import (
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mileusna/useragent"
	"github.com/tiredbooy/internal/analytics"
	analyticsmodels "github.com/tiredbooy/internal/models"
)

const (
	sessionCookieName = "sid"
	deviceCookieName  = "did"
	cookieTTL         = 365 * 24 * time.Hour
)

func Analytics(queue *analytics.Queue) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		method := c.Request.Method
		path := c.FullPath()
		rawURL := c.Request.URL.String()
		referrer := c.Request.Referer()
		userAgentStr := c.Request.UserAgent()
		query := c.Request.URL.Query()
		sessionID := getOrCreateCookieID(c, sessionCookieName)
		deviceID := getOrCreateCookieID(c, deviceCookieName)
		userID, _ := c.Get("userID") // set by your auth middleware

		go func() {
			event := buildEvent(
				method, path, rawURL, referrer,
				userAgentStr, query,
				sessionID, deviceID, userID,
			)
			queue.Push(event)
		}()
	}
}

func buildEvent(
	method, path, rawURL, referrer,
	userAgentStr string,
	query map[string][]string,
	sessionID, deviceID uuid.UUID,
	rawUserID any,
) *analyticsmodels.EventReq {
	ua := useragent.Parse(userAgentStr)
	deviceType := resolveDeviceType(ua)
	eventType := resolveEventType(method, path)

	event := &analyticsmodels.EventReq{
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
		Payload:     map[string]any{},
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
	switch {
	case method == "GET" && strings.HasPrefix(path, "/api/products/"):
		return "product_viewed"
	case method == "GET" && strings.HasPrefix(path, "/api/recipes/"):
		return "recipe_viewed"
	case method == "GET" && strings.HasPrefix(path, "/api/blogs/"):
		return "blog_viewed"
	case method == "GET" && strings.HasPrefix(path, "/api/search"):
		return "search_performed"
	case method == "POST" && strings.HasPrefix(path, "/api/cart"):
		return "cart_updated"
	case method == "POST" && strings.HasPrefix(path, "/api/orders"):
		return "order_created"
	default:
		return "page_viewed"
	}
}

func resolveDeviceType(ua useragent.UserAgent) analyticsmodels.DeviceType {
	switch {
	case ua.Mobile:
		return analyticsmodels.DeviceTypeMobile
	case ua.Tablet:
		return analyticsmodels.DeviceTypeTablet
	case ua.Desktop:
		return analyticsmodels.DeviceTypeDesktop
	default:
		return analyticsmodels.DeviceTypeUnknown
	}
}

func getOrCreateCookieID(c *gin.Context, name string) uuid.UUID {
	if val, err := c.Cookie(name); err == nil {
		if id, err := uuid.Parse(val); err == nil {
			return id
		}
	}
	return uuid.New()
}

func queryParamFromMap(query map[string][]string, key string) *string {
	if vals, ok := query[key]; ok && len(vals) > 0 && vals[0] != "" {
		v := vals[0]
		return &v
	}
	return nil
}

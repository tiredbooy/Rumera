package analytics

import "github.com/gin-gonic/gin"

// RegisterPublic is a no-op (analytics dashboards are admin-only).
func RegisterPublic(_ *gin.RouterGroup, _ *Handler) {}

// RegisterCustomer is a no-op.
func RegisterCustomer(_ *gin.RouterGroup, _ *Handler) {}

// RegisterAdmin mounts admin analytics dashboard routes under /admin/analytics.
func RegisterAdmin(a *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	an := a.Group("/analytics")
	an.GET("/revenue/summary", h.RevenueSummary)
	an.GET("/revenue/timeseries", h.RevenueTimeSeries)
	an.GET("/revenue/today", h.RevenueToday)
	an.GET("/products/top-revenue", h.TopProductsByRevenue)
	an.GET("/products/top-views", h.TopProductsByViews)
	an.GET("/products/:productID/summary", h.ProductStatsSummary)
	an.GET("/products/:productID/timeseries", h.ProductStatsTimeSeries)
	an.GET("/search/top-terms", h.TopSearchTerms)
	an.GET("/search/zero-result", h.ZeroResultSearchTerms)
	an.GET("/search/top-converting", h.TopConvertingSearchTerms)
	an.GET("/events/breakdown", h.EventBreakdown)
}

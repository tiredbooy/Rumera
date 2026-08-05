package handlers

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/response"
)

// parseRange reads `from` / `to` RFC3339 query params, defaulting to the last 30
// days when omitted. It writes ErrInvalidQuery and returns ok=false on a
// malformed value.
func (h *Handler) parseRange(c *gin.Context) (from, to time.Time, ok bool) {
	to = time.Now()
	from = to.AddDate(0, 0, -30)

	if raw := c.Query("from"); raw != "" {
		t, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			response.Error(c, response.ErrInvalidQuery)
			return time.Time{}, time.Time{}, false
		}
		from = t
	}
	if raw := c.Query("to"); raw != "" {
		t, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			response.Error(c, response.ErrInvalidQuery)
			return time.Time{}, time.Time{}, false
		}
		to = t
	}
	if from.After(to) {
		response.Error(c, response.ErrInvalidQuery)
		return time.Time{}, time.Time{}, false
	}
	return from, to, true
}

func queryLimit(c *gin.Context, def int) int {
	n, err := strconv.Atoi(c.Query("limit"))
	if err != nil || n <= 0 || n > 100 {
		return def
	}
	return n
}

// ── Revenue ────────────────────────────────────────────────────────────────

// RevenueSummary — GET /admin/analytics/revenue/summary
func (h *Handler) RevenueSummary(c *gin.Context) {
	from, to, ok := h.parseRange(c)
	if !ok {
		return
	}
	summary, err := h.RevenueStats.GetSummary(c.Request.Context(), from, to)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, summary)
}

// RevenueTimeSeries — GET /admin/analytics/revenue/timeseries
func (h *Handler) RevenueTimeSeries(c *gin.Context) {
	from, to, ok := h.parseRange(c)
	if !ok {
		return
	}
	series, err := h.RevenueStats.GetTimeSeries(c.Request.Context(), from, to)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, series)
}

// RevenueToday — GET /admin/analytics/revenue/today
func (h *Handler) RevenueToday(c *gin.Context) {
	today, err := h.RevenueStats.GetToday(c.Request.Context())
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, today)
}

// ── Products ───────────────────────────────────────────────────────────────

// Product analytics keys are catalog BIGINT product IDs (same as /admin/products/:id).

// TopProductsByRevenue — GET /admin/analytics/products/top-revenue
func (h *Handler) TopProductsByRevenue(c *gin.Context) {
	from, to, ok := h.parseRange(c)
	if !ok {
		return
	}
	entries, err := h.ProductStats.TopByRevenue(c.Request.Context(), from, to, queryLimit(c, 10))
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, entries)
}

// TopProductsByViews — GET /admin/analytics/products/top-views
func (h *Handler) TopProductsByViews(c *gin.Context) {
	from, to, ok := h.parseRange(c)
	if !ok {
		return
	}
	entries, err := h.ProductStats.TopByViews(c.Request.Context(), from, to, queryLimit(c, 10))
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, entries)
}

// ProductStatsSummary — GET /admin/analytics/products/:productID/summary
func (h *Handler) ProductStatsSummary(c *gin.Context) {
	productID, ok := h.paramInt64(c, "productID")
	if !ok {
		return
	}
	from, to, ok := h.parseRange(c)
	if !ok {
		return
	}
	summary, err := h.ProductStats.GetSummary(c.Request.Context(), productID, from, to)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, summary)
}

// ProductStatsTimeSeries — GET /admin/analytics/products/:productID/timeseries
func (h *Handler) ProductStatsTimeSeries(c *gin.Context) {
	productID, ok := h.paramInt64(c, "productID")
	if !ok {
		return
	}
	from, to, ok := h.parseRange(c)
	if !ok {
		return
	}
	series, err := h.ProductStats.GetTimeSeries(c.Request.Context(), productID, from, to)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, series)
}

// ── Search ─────────────────────────────────────────────────────────────────

// TopSearchTerms — GET /admin/analytics/search/top-terms
func (h *Handler) TopSearchTerms(c *gin.Context) {
	from, to, ok := h.parseRange(c)
	if !ok {
		return
	}
	terms, err := h.SearchSummary.TopTerms(c.Request.Context(), from, to, queryLimit(c, 20))
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, terms)
}

// ZeroResultSearchTerms — GET /admin/analytics/search/zero-result
func (h *Handler) ZeroResultSearchTerms(c *gin.Context) {
	from, to, ok := h.parseRange(c)
	if !ok {
		return
	}
	terms, err := h.SearchSummary.ZeroResultTerms(c.Request.Context(), from, to, queryLimit(c, 20))
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, terms)
}

// TopConvertingSearchTerms — GET /admin/analytics/search/top-converting
func (h *Handler) TopConvertingSearchTerms(c *gin.Context) {
	from, to, ok := h.parseRange(c)
	if !ok {
		return
	}
	terms, err := h.SearchSummary.TopConvertingTerms(c.Request.Context(), from, to, queryLimit(c, 20))
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, terms)
}

// ── Events ─────────────────────────────────────────────────────────────────

// EventBreakdown — GET /admin/analytics/events/breakdown
func (h *Handler) EventBreakdown(c *gin.Context) {
	from, to, ok := h.parseRange(c)
	if !ok {
		return
	}
	breakdown, err := h.Event.GetEventBreakdown(c.Request.Context(), from, to)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, models.EventBreakdown(breakdown))
}

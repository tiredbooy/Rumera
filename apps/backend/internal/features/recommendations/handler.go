package recommendations

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/platform/httpx"
	"github.com/tiredbooy/pkg/response"
	"github.com/tiredbooy/pkg/validator"
)

// Handler is the HTTP surface for product recommendations.
type Handler struct {
	Recs      Service
	Validator *validator.Validator
}

// NewHandler constructs the recommendations HTTP handler.
func NewHandler(svc Service, v *validator.Validator) *Handler {
	return &Handler{Recs: svc, Validator: v}
}

// ── Public ──────────────────────────────────────────────────────────────────

// Trending — GET /recommendations/trending
func (h *Handler) Trending(c *gin.Context) {
	var q RecommendationQuery
	if !httpx.BindQuery(c, h.Validator, &q) {
		return
	}
	items, err := h.Recs.Trending(c.Request.Context(), q)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, nonNilRecs(items))
}

// Similar — GET /recommendations/products/:id/similar
func (h *Handler) Similar(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	var q RecommendationQuery
	if !httpx.BindQuery(c, h.Validator, &q) {
		return
	}
	items, err := h.Recs.Similar(c.Request.Context(), id, q)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, nonNilRecs(items))
}

// FrequentlyBoughtTogether — GET /recommendations/products/:id/frequently-bought-together
func (h *Handler) FrequentlyBoughtTogether(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	var q RecommendationQuery
	if !httpx.BindQuery(c, h.Validator, &q) {
		return
	}
	items, err := h.Recs.FrequentlyBoughtTogether(c.Request.Context(), id, q)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, nonNilRecs(items))
}

// ── Customer ────────────────────────────────────────────────────────────────

// ForYou — GET /recommendations/for-you
func (h *Handler) ForYou(c *gin.Context) {
	uid, ok := httpx.UID(c)
	if !ok {
		return
	}
	var q RecommendationQuery
	if !httpx.BindQuery(c, h.Validator, &q) {
		return
	}
	items, err := h.Recs.ForYou(c.Request.Context(), uid, q)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, nonNilRecs(items))
}

// RecordInteraction — POST /recommendations/interactions
func (h *Handler) RecordInteraction(c *gin.Context) {
	uid, ok := httpx.UID(c)
	if !ok {
		return
	}
	var req InteractionReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	if err := h.Recs.RecordInteraction(c.Request.Context(), uid, &req); err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.NoContent(c)
}

// GetProfile — GET /recommendations/profile
func (h *Handler) GetProfile(c *gin.Context) {
	uid, ok := httpx.UID(c)
	if !ok {
		return
	}
	profile, err := h.Recs.GetProfile(c.Request.Context(), uid)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, profile)
}

// RecomputeProfile — POST /recommendations/profile/recompute
func (h *Handler) RecomputeProfile(c *gin.Context) {
	uid, ok := httpx.UID(c)
	if !ok {
		return
	}
	profile, err := h.Recs.RecomputeProfile(c.Request.Context(), uid)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, profile)
}

func nonNilRecs(items []*RecommendationItem) []*RecommendationItem {
	if items == nil {
		return []*RecommendationItem{}
	}
	return items
}

// OpsStats — GET /admin/recommendations/stats?window_days=30
func (h *Handler) OpsStats(c *gin.Context) {
	window := 30
	if raw := c.Query("window_days"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n <= 0 || n > 365 {
			response.Error(c, response.ErrInvalidQuery)
			return
		}
		window = n
	}
	stats, err := h.Recs.OpsStats(c.Request.Context(), window)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	if stats.InteractionsByType == nil {
		stats.InteractionsByType = map[string]int64{}
	}
	response.OK(c, stats)
}

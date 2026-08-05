package handlers

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/response"
)

// ── Public ──────────────────────────────────────────────────────────────────

// TrendingRecommendations — GET /recommendations/trending
func (h *Handler) TrendingRecommendations(c *gin.Context) {
	var q models.RecommendationQuery
	if !h.bindQuery(c, &q) {
		return
	}
	items, err := h.Recommendation.Trending(c.Request.Context(), q)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, nonNilRecs(items))
}

// SimilarProducts — GET /recommendations/products/:id/similar
func (h *Handler) SimilarProducts(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	var q models.RecommendationQuery
	if !h.bindQuery(c, &q) {
		return
	}
	items, err := h.Recommendation.Similar(c.Request.Context(), id, q)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, nonNilRecs(items))
}

// FrequentlyBoughtTogether — GET /recommendations/products/:id/frequently-bought-together
func (h *Handler) FrequentlyBoughtTogether(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	var q models.RecommendationQuery
	if !h.bindQuery(c, &q) {
		return
	}
	items, err := h.Recommendation.FrequentlyBoughtTogether(c.Request.Context(), id, q)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, nonNilRecs(items))
}

// ── Customer ────────────────────────────────────────────────────────────────

// ForYou — GET /recommendations/for-you
func (h *Handler) ForYou(c *gin.Context) {
	uid, ok := h.uid(c)
	if !ok {
		return
	}
	var q models.RecommendationQuery
	if !h.bindQuery(c, &q) {
		return
	}
	items, err := h.Recommendation.ForYou(c.Request.Context(), uid, q)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, nonNilRecs(items))
}

// RecordInteraction — POST /recommendations/interactions
func (h *Handler) RecordInteraction(c *gin.Context) {
	uid, ok := h.uid(c)
	if !ok {
		return
	}
	var req models.InteractionReq
	if !h.bindJSON(c, &req) {
		return
	}
	if err := h.Recommendation.RecordInteraction(c.Request.Context(), uid, &req); err != nil {
		h.handleError(c, err)
		return
	}
	response.NoContent(c)
}

// GetMyRecommendationProfile — GET /recommendations/profile
func (h *Handler) GetMyRecommendationProfile(c *gin.Context) {
	uid, ok := h.uid(c)
	if !ok {
		return
	}
	profile, err := h.Recommendation.GetProfile(c.Request.Context(), uid)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, profile)
}

// RecomputeMyRecommendationProfile — POST /recommendations/profile/recompute
func (h *Handler) RecomputeMyRecommendationProfile(c *gin.Context) {
	uid, ok := h.uid(c)
	if !ok {
		return
	}
	profile, err := h.Recommendation.RecomputeProfile(c.Request.Context(), uid)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, profile)
}

func nonNilRecs(items []*models.RecommendationItem) []*models.RecommendationItem {
	if items == nil {
		return []*models.RecommendationItem{}
	}
	return items
}

// RecommendationOpsStats — GET /admin/recommendations/stats?window_days=30
func (h *Handler) RecommendationOpsStats(c *gin.Context) {
	window := 30
	if raw := c.Query("window_days"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n <= 0 || n > 365 {
			response.Error(c, response.ErrInvalidQuery)
			return
		}
		window = n
	}
	stats, err := h.Recommendation.OpsStats(c.Request.Context(), window)
	if err != nil {
		h.handleError(c, err)
		return
	}
	if stats.InteractionsByType == nil {
		stats.InteractionsByType = map[string]int64{}
	}
	response.OK(c, stats)
}

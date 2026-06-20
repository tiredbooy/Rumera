package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/mappers"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/response"
)

type reactReq struct {
	Like bool `json:"like"`
}

// CreateReview — POST /reviews
func (h *Handler) CreateReview(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	var req models.CreateReviewReq
	if !h.bindJSON(c, &req) {
		return
	}
	// verifiedPurchase is determined server-side; default false until an
	// order-history check is wired in.
	review, err := h.Review.Create(c.Request.Context(), userID, req, false)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.Created(c, mappers.ToReviewResponse(review, ""))
}

// ProductReviews — GET /products/:id/reviews
func (h *Handler) ProductReviews(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	var filter models.ReviewFilter
	if !h.bindQuery(c, &filter) {
		return
	}
	filter.Defaults()
	filter.ProductID = &id
	// Public listings only show approved reviews.
	approved := models.ReviewStatusApproved
	filter.Status = &approved
	h.listReviews(c, filter)
}

func (h *Handler) listReviews(c *gin.Context, filter models.ReviewFilter) {
	reviews, total, err := h.Review.GetAll(c.Request.Context(), filter)
	if err != nil {
		h.handleError(c, err)
		return
	}
	out := make([]models.ReviewResponse, len(reviews))
	for i, r := range reviews {
		out[i] = mappers.ToReviewResponse(r, "")
	}
	response.Paginated(c, out, paginate(filter.Page, filter.Limit, total))
}

// GetReview — GET /reviews/:id
func (h *Handler) GetReview(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	review, err := h.Review.GetByID(c.Request.Context(), id)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, mappers.ToReviewResponse(review, ""))
}

// ProductRatingSummary — GET /products/:id/reviews/summary
func (h *Handler) ProductRatingSummary(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	summary, err := h.Review.GetRatingSummary(c.Request.Context(), id)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, summary)
}

// UpdateReview — PATCH /reviews/:id
func (h *Handler) UpdateReview(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	var req models.UpdateReviewReq
	if !h.bindJSON(c, &req) {
		return
	}
	review, err := h.Review.Update(c.Request.Context(), id, userID, req)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, mappers.ToReviewResponse(review, ""))
}

// DeleteReview — DELETE /reviews/:id
func (h *Handler) DeleteReview(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	if err := h.Review.Delete(c.Request.Context(), id, userID); err != nil {
		h.handleError(c, err)
		return
	}
	response.NoContent(c)
}

// ReactToReview — POST /reviews/:id/react
func (h *Handler) ReactToReview(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	var req reactReq
	if !h.bindJSON(c, &req) {
		return
	}
	if err := h.Review.React(c.Request.Context(), id, req.Like); err != nil {
		h.handleError(c, err)
		return
	}
	response.NoContent(c)
}

// ReviewImages — GET /reviews/:id/images
func (h *Handler) ReviewImages(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	images, err := h.Review.GetImages(c.Request.Context(), id)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, images)
}

// AddReviewImage — POST /reviews/:id/images
func (h *Handler) AddReviewImage(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	var req models.ReviewImageReq
	if !h.bindJSON(c, &req) {
		return
	}
	req.ReviewID = id
	image, err := h.Review.AddImage(c.Request.Context(), id, userID, &req)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.Created(c, image)
}

// ── Admin ──────────────────────────────────────────────────────────────────

// ListReviewsAdmin — GET /admin/reviews
func (h *Handler) ListReviewsAdmin(c *gin.Context) {
	var filter models.ReviewFilter
	if !h.bindQuery(c, &filter) {
		return
	}
	filter.Defaults()

	reviews, total, err := h.Review.GetAll(c.Request.Context(), filter)
	if err != nil {
		h.handleError(c, err)
		return
	}
	out := make([]models.ReviewAdminResponse, len(reviews))
	for i, r := range reviews {
		out[i] = mappers.ToReviewAdminResponse(r, "")
	}
	response.Paginated(c, out, paginate(filter.Page, filter.Limit, total))
}

// UpdateReviewStatus — PATCH /admin/reviews/:id/status
func (h *Handler) UpdateReviewStatus(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	var req models.UpdateReviewStatusReq
	if !h.bindJSON(c, &req) {
		return
	}
	review, err := h.Review.UpdateStatus(c.Request.Context(), id, req)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, mappers.ToReviewAdminResponse(review, ""))
}

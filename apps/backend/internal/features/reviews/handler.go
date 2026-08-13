package reviews

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/platform/httpx"
	"github.com/tiredbooy/pkg/apperr"
	"github.com/tiredbooy/pkg/response"
	"github.com/tiredbooy/pkg/validator"
)

type reactReq struct {
	Like bool `json:"like"`
}

// Handler is the HTTP surface for product reviews.
type Handler struct {
	Reviews   *Service
	Validator *validator.Validator
}

// NewHandler constructs the reviews HTTP handler.
func NewHandler(svc *Service, v *validator.Validator) *Handler {
	return &Handler{Reviews: svc, Validator: v}
}

// Create — POST /reviews
func (h *Handler) Create(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	var req CreateReviewReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	review, err := h.Reviews.Create(c.Request.Context(), userID, req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Created(c, ToReviewResponse(review))
}

// ProductReviews — GET /products/:id/reviews
func (h *Handler) ProductReviews(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	var filter ReviewFilter
	if !httpx.BindQuery(c, h.Validator, &filter) {
		return
	}
	filter.Defaults()
	filter.ProductID = &id
	// Public listings only show approved reviews.
	approved := ReviewStatusApproved
	filter.Status = &approved
	h.listReviews(c, filter)
}

func (h *Handler) listReviews(c *gin.Context, filter ReviewFilter) {
	reviews, total, err := h.Reviews.GetAll(c.Request.Context(), filter)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	out := make([]ReviewResponse, len(reviews))
	for i, r := range reviews {
		out[i] = ToReviewResponse(r)
	}
	response.Paginated(c, out, httpx.Paginate(filter.Page, filter.Limit, total))
}

// Get — GET /reviews/:id
func (h *Handler) Get(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	review, err := h.Reviews.GetByID(c.Request.Context(), id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	if review.Status != ReviewStatusApproved {
		httpx.HandleError(c, apperr.ErrNotFound)
		return
	}
	response.OK(c, ToReviewResponse(review))
}

// ProductRatingSummary — GET /products/:id/reviews/summary
func (h *Handler) ProductRatingSummary(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	summary, err := h.Reviews.GetRatingSummary(c.Request.Context(), id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, summary)
}

// Update — PATCH /reviews/:id
func (h *Handler) Update(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	var req UpdateReviewReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	review, err := h.Reviews.Update(c.Request.Context(), id, userID, req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, ToReviewResponse(review))
}

// Delete — DELETE /reviews/:id
func (h *Handler) Delete(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	if err := h.Reviews.Delete(c.Request.Context(), id, userID); err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.NoContent(c)
}

// MyReviews — GET /reviews/mine
func (h *Handler) MyReviews(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	reviews, err := h.Reviews.GetMine(c.Request.Context(), userID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, reviews)
}

// PendingReviews — GET /reviews/pending
func (h *Handler) PendingReviews(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	items, err := h.Reviews.GetPending(c.Request.Context(), userID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, items)
}

// React — POST /reviews/:id/react
func (h *Handler) React(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	var req reactReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	if err := h.Reviews.React(c.Request.Context(), id, userID, req.Like); err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.NoContent(c)
}

// Images — GET /reviews/:id/images
func (h *Handler) Images(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	images, err := h.Reviews.GetImages(c.Request.Context(), id, userID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, images)
}

// AddImage — POST /reviews/:id/images
func (h *Handler) AddImage(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	var req ReviewImageReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	req.ReviewID = id
	image, err := h.Reviews.AddImage(c.Request.Context(), id, userID, &req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Created(c, image)
}

// ListAdmin — GET /admin/reviews
func (h *Handler) ListAdmin(c *gin.Context) {
	var filter ReviewFilter
	if !httpx.BindQuery(c, h.Validator, &filter) {
		return
	}
	filter.Defaults()

	reviews, total, err := h.Reviews.GetAll(c.Request.Context(), filter)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	out := make([]ReviewAdminResponse, len(reviews))
	for i, r := range reviews {
		out[i] = ToReviewAdminResponse(r)
	}
	response.Paginated(c, out, httpx.Paginate(filter.Page, filter.Limit, total))
}

// UpdateStatus — PATCH /admin/reviews/:id/status
func (h *Handler) UpdateStatus(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	var req UpdateReviewStatusReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	review, err := h.Reviews.UpdateStatus(c.Request.Context(), id, req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, ToReviewAdminResponse(review))
}

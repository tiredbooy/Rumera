package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/mappers"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/response"
)

// ── Customer / checkout ────────────────────────────────────────────────────

// ValidateCoupon previews a coupon for the authenticated user's basket.
//
// POST /coupons/validate
func (h *Handler) ValidateCoupon(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	var req models.ValidateCouponReq
	if !h.bindJSON(c, &req) {
		return
	}
	req.UserID = userID

	result, err := h.Coupon.Validate(c.Request.Context(), req)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, result)
}

// ── Admin ──────────────────────────────────────────────────────────────────

// CreateCoupon — POST /admin/coupons
func (h *Handler) CreateCoupon(c *gin.Context) {
	var req models.CreateCouponReq
	if !h.bindJSON(c, &req) {
		return
	}
	coupon, err := h.Coupon.Create(c.Request.Context(), req)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Created(c, mappers.ToCouponResponse(coupon, 0))
}

// ListCoupons — GET /admin/coupons
func (h *Handler) ListCoupons(c *gin.Context) {
	var filter models.CouponFilter
	if !h.bindQuery(c, &filter) {
		return
	}
	filter.Defaults()

	coupons, total, err := h.Coupon.GetAll(c.Request.Context(), filter)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	out := make([]models.CouponResponse, len(coupons))
	for i, cp := range coupons {
		out[i] = mappers.ToCouponResponse(cp, 0)
	}
	response.Paginated(c, out, paginate(filter.Page, filter.Limit, total))
}

// GetCoupon — GET /admin/coupons/:id
func (h *Handler) GetCoupon(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	ctx := c.Request.Context()

	coupon, err := h.Coupon.GetByID(ctx, id)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	uses, err := h.Coupon.TotalUses(ctx, id)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, mappers.ToCouponResponse(coupon, uses))
}

// UpdateCoupon — PATCH /admin/coupons/:id
func (h *Handler) UpdateCoupon(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	var req models.UpdateCouponReq
	if !h.bindJSON(c, &req) {
		return
	}
	coupon, err := h.Coupon.Update(c.Request.Context(), id, req)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, mappers.ToCouponResponse(coupon, 0))
}

// DeleteCoupon — DELETE /admin/coupons/:id
func (h *Handler) DeleteCoupon(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	if err := h.Coupon.Delete(c.Request.Context(), id); err != nil {
		response.HandleError(c, err)
		return
	}
	response.NoContent(c)
}

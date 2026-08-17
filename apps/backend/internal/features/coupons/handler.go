package coupons

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/platform/httpx"
	"github.com/tiredbooy/pkg/response"
	"github.com/tiredbooy/pkg/validator"
)

// Handler is the HTTP surface for discount coupons.
type Handler struct {
	Coupons   *Service
	Validator *validator.Validator
}

// NewHandler constructs the coupons HTTP handler.
func NewHandler(svc *Service, v *validator.Validator) *Handler {
	return &Handler{Coupons: svc, Validator: v}
}

// Validate previews a coupon for the authenticated user's basket.
// POST /coupons/validate
//
// req.UserID is taken from the token. Omitted product_ids / category_ids
// (and a zero order_subtotal) are filled from that user's cart in Service.
func (h *Handler) Validate(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	var req ValidateCouponReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	req.UserID = userID

	result, err := h.Coupons.Validate(c.Request.Context(), req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, result)
}

// Create — POST /admin/coupons
func (h *Handler) Create(c *gin.Context) {
	var req CreateCouponReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	coupon, err := h.Coupons.Create(c.Request.Context(), req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Created(c, ToCouponResponse(coupon, 0))
}

// List — GET /admin/coupons
func (h *Handler) List(c *gin.Context) {
	var filter CouponFilter
	if !httpx.BindQuery(c, h.Validator, &filter) {
		return
	}
	filter.Defaults()

	ctx := c.Request.Context()
	list, total, err := h.Coupons.GetAll(ctx, filter)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	ids := make([]int64, 0, len(list))
	for _, cp := range list {
		ids = append(ids, cp.ID)
	}
	uses, err := h.Coupons.UsageCounts(ctx, ids)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	out := make([]CouponResponse, len(list))
	for i, cp := range list {
		out[i] = ToCouponResponse(cp, uses[cp.ID])
	}
	response.Paginated(c, out, httpx.Paginate(filter.Page, filter.Limit, total))
}

// Get — GET /admin/coupons/:id
func (h *Handler) Get(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	ctx := c.Request.Context()

	coupon, err := h.Coupons.GetByID(ctx, id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	uses, err := h.Coupons.TotalUses(ctx, id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, ToCouponResponse(coupon, uses))
}

// Update — PATCH /admin/coupons/:id
func (h *Handler) Update(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	var req UpdateCouponReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	coupon, err := h.Coupons.Update(c.Request.Context(), id, req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, ToCouponResponse(coupon, 0))
}

// Delete soft-deactivates a coupon (history-preserving). Prefer PATCH
// {is_active:false}; DELETE remains as the same deactivation contract.
// DELETE /admin/coupons/:id
func (h *Handler) Delete(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	coupon, err := h.Coupons.Deactivate(c.Request.Context(), id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	uses, err := h.Coupons.TotalUses(c.Request.Context(), id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, ToCouponResponse(coupon, uses))
}

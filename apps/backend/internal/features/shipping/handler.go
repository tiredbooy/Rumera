package shipping

import (
	"math"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/platform/httpx"
	"github.com/tiredbooy/pkg/response"
	"github.com/tiredbooy/pkg/validator"
)

// Handler is the HTTP surface for shipping zones and methods.
type Handler struct {
	Shipping  *Service
	Validator *validator.Validator
}

// NewHandler constructs the shipping HTTP handler.
func NewHandler(svc *Service, v *validator.Validator) *Handler {
	return &Handler{Shipping: svc, Validator: v}
}

// ── Zones ──────────────────────────────────────────────────────────────────

// ListZones — GET /shipping/zones
func (h *Handler) ListZones(c *gin.Context) {
	var filter ShippingZoneFilter
	if !httpx.BindQuery(c, h.Validator, &filter) {
		return
	}
	filter.Defaults()

	zones, total, err := h.Shipping.GetAllZones(c.Request.Context(), filter)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	out := make([]ShippingZoneResponse, len(zones))
	for i, z := range zones {
		out[i] = toShippingZoneResponse(z)
	}
	response.Paginated(c, out, httpx.Paginate(filter.Page, filter.Limit, total))
}

// GetZone — GET /shipping/zones/:id
func (h *Handler) GetZone(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	detail, err := h.Shipping.GetZoneDetail(c.Request.Context(), id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, toShippingZoneDetailResponse(detail))
}

// CreateZone — POST /admin/shipping/zones
func (h *Handler) CreateZone(c *gin.Context) {
	var req CreateShippingZoneReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	zone, err := h.Shipping.CreateZone(c.Request.Context(), req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Created(c, toShippingZoneResponse(zone))
}

// UpdateZone — PATCH /admin/shipping/zones/:id
func (h *Handler) UpdateZone(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	var req UpdateShippingZoneReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	zone, err := h.Shipping.UpdateZone(c.Request.Context(), id, req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, toShippingZoneResponse(zone))
}

// DeleteZone — DELETE /admin/shipping/zones/:id
func (h *Handler) DeleteZone(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	if err := h.Shipping.DeleteZone(c.Request.Context(), id); err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.NoContent(c)
}

// ── Methods ────────────────────────────────────────────────────────────────

// ListZoneMethods — GET /shipping/zones/:id/methods
func (h *Handler) ListZoneMethods(c *gin.Context) {
	zoneID, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	var filter ShippingMethodFilter
	if !httpx.BindQuery(c, h.Validator, &filter) {
		return
	}
	filter.Defaults()

	methods, total, err := h.Shipping.GetMethodsByZoneID(c.Request.Context(), zoneID, filter)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Paginated(c, toShippingMethodResponses(methods), httpx.Paginate(filter.Page, filter.Limit, total))
}

// GetMethod — GET /shipping/methods/:id
func (h *Handler) GetMethod(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	method, err := h.Shipping.GetMethodByID(c.Request.Context(), id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, toShippingMethodResponse(method))
}

// AvailableMethods — GET /shipping/available?region=US&weight=2.5&subtotal=100
func (h *Handler) AvailableMethods(c *gin.Context) {
	region := strings.TrimSpace(c.Query("region"))
	if region == "" {
		response.Error(c, response.ErrInvalidQuery)
		return
	}
	weight, err := strconv.ParseFloat(c.DefaultQuery("weight", "0"), 64)
	if err != nil || weight < 0 || math.IsNaN(weight) || math.IsInf(weight, 0) {
		response.Error(c, response.ErrInvalidQuery)
		return
	}
	subtotal, err := strconv.ParseFloat(c.DefaultQuery("subtotal", "0"), 64)
	if err != nil || subtotal < 0 || math.IsNaN(subtotal) || math.IsInf(subtotal, 0) {
		response.Error(c, response.ErrInvalidQuery)
		return
	}
	quotes, err := h.Shipping.GetAvailableForCheckout(c.Request.Context(), region, weight, subtotal)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, toShippingMethodQuoteResponses(quotes))
}

// CreateMethod — POST /admin/shipping/zones/:id/methods
func (h *Handler) CreateMethod(c *gin.Context) {
	zoneID, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	var req CreateShippingMethodReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	method, err := h.Shipping.CreateMethod(c.Request.Context(), zoneID, req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Created(c, toShippingMethodResponse(method))
}

// UpdateMethod — PATCH /admin/shipping/methods/:id
func (h *Handler) UpdateMethod(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	var req UpdateShippingMethodReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	method, err := h.Shipping.UpdateMethod(c.Request.Context(), id, req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, toShippingMethodResponse(method))
}

// DeleteMethod — DELETE /admin/shipping/methods/:id
func (h *Handler) DeleteMethod(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	if err := h.Shipping.DeleteMethod(c.Request.Context(), id); err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.NoContent(c)
}

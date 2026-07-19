package handlers

import (
	"math"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/response"
)

// ── Zones ──────────────────────────────────────────────────────────────────

// ListShippingZones — GET /shipping/zones
func (h *Handler) ListShippingZones(c *gin.Context) {
	var filter models.ShippingZoneFilter
	if !h.bindQuery(c, &filter) {
		return
	}
	filter.Defaults()

	zones, total, err := h.Shipping.GetAllZones(c.Request.Context(), filter)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	out := make([]models.ShippingZoneResponse, len(zones))
	for i, z := range zones {
		out[i] = toShippingZoneResponse(z)
	}
	response.Paginated(c, out, paginate(filter.Page, filter.Limit, total))
}

// GetShippingZone — GET /shipping/zones/:id
func (h *Handler) GetShippingZone(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	detail, err := h.Shipping.GetZoneDetail(c.Request.Context(), id)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, toShippingZoneDetailResponse(detail))
}

// CreateShippingZone — POST /admin/shipping/zones
func (h *Handler) CreateShippingZone(c *gin.Context) {
	var req models.CreateShippingZoneReq
	if !h.bindJSON(c, &req) {
		return
	}
	zone, err := h.Shipping.CreateZone(c.Request.Context(), req)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Created(c, toShippingZoneResponse(zone))
}

// UpdateShippingZone — PATCH /admin/shipping/zones/:id
func (h *Handler) UpdateShippingZone(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	var req models.UpdateShippingZoneReq
	if !h.bindJSON(c, &req) {
		return
	}
	zone, err := h.Shipping.UpdateZone(c.Request.Context(), id, req)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, toShippingZoneResponse(zone))
}

// DeleteShippingZone — DELETE /admin/shipping/zones/:id
func (h *Handler) DeleteShippingZone(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	if err := h.Shipping.DeleteZone(c.Request.Context(), id); err != nil {
		response.HandleError(c, err)
		return
	}
	response.NoContent(c)
}

// ── Methods ────────────────────────────────────────────────────────────────

// ListZoneMethods — GET /shipping/zones/:id/methods
func (h *Handler) ListZoneMethods(c *gin.Context) {
	zoneID, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	var filter models.ShippingMethodFilter
	if !h.bindQuery(c, &filter) {
		return
	}
	filter.Defaults()

	methods, total, err := h.Shipping.GetMethodsByZoneID(c.Request.Context(), zoneID, filter)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Paginated(c, toShippingMethodResponses(methods), paginate(filter.Page, filter.Limit, total))
}

// GetShippingMethod — GET /shipping/methods/:id
func (h *Handler) GetShippingMethod(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	method, err := h.Shipping.GetMethodByID(c.Request.Context(), id)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, toShippingMethodResponse(method))
}

// AvailableShippingMethods — GET /shipping/available?region=US&weight=2.5&subtotal=100
func (h *Handler) AvailableShippingMethods(c *gin.Context) {
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
		response.HandleError(c, err)
		return
	}
	response.OK(c, toShippingMethodQuoteResponses(quotes))
}

// CreateShippingMethod — POST /admin/shipping/zones/:id/methods
func (h *Handler) CreateShippingMethod(c *gin.Context) {
	zoneID, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	var req models.CreateShippingMethodReq
	if !h.bindJSON(c, &req) {
		return
	}
	method, err := h.Shipping.CreateMethod(c.Request.Context(), zoneID, req)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Created(c, toShippingMethodResponse(method))
}

// UpdateShippingMethod — PATCH /admin/shipping/methods/:id
func (h *Handler) UpdateShippingMethod(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	var req models.UpdateShippingMethodReq
	if !h.bindJSON(c, &req) {
		return
	}
	method, err := h.Shipping.UpdateMethod(c.Request.Context(), id, req)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, toShippingMethodResponse(method))
}

// DeleteShippingMethod — DELETE /admin/shipping/methods/:id
func (h *Handler) DeleteShippingMethod(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	if err := h.Shipping.DeleteMethod(c.Request.Context(), id); err != nil {
		response.HandleError(c, err)
		return
	}
	response.NoContent(c)
}

// ── mapping ────────────────────────────────────────────────────────────────

func toShippingZoneResponse(z *models.ShippingZone) models.ShippingZoneResponse {
	return models.ShippingZoneResponse{
		ID:          z.ID,
		Name:        z.Name,
		Description: z.Description,
		RegionCodes: z.RegionCodes,
		IsActive:    z.IsActive,
	}
}

func toShippingZoneDetailResponse(detail *models.ShippingZoneDetail) models.ShippingZoneResponse {
	zone := toShippingZoneResponse(detail.Zone)
	zone.Methods = toShippingMethodResponses(detail.Methods)
	return zone
}

func toShippingMethodResponse(m *models.ShippingMethod) models.ShippingMethodResponse {
	return models.ShippingMethodResponse{
		ID:              m.ID,
		ShippingZoneID:  m.ShippingZoneID,
		Name:            m.Name,
		Carrier:         m.Carrier,
		Description:     m.Description,
		RateType:        m.RateType,
		BaseRate:        m.BaseRate,
		FreeAboveAmount: m.FreeAboveAmount,
		MinDeliveryDays: m.MinDeliveryDays,
		MaxDeliveryDays: m.MaxDeliveryDays,
		MaxWeightKg:     m.MaxWeightKg,
		IsActive:        m.IsActive,
	}
}

func toShippingMethodResponses(ms []*models.ShippingMethod) []models.ShippingMethodResponse {
	out := make([]models.ShippingMethodResponse, len(ms))
	for i, m := range ms {
		out[i] = toShippingMethodResponse(m)
	}
	return out
}

func toShippingMethodQuoteResponses(quotes []*models.ShippingMethodQuote) []models.ShippingMethodResponse {
	out := make([]models.ShippingMethodResponse, len(quotes))
	for i, quote := range quotes {
		out[i] = toShippingMethodResponse(quote.Method)
		out[i].EstimatedCost = quote.EstimatedCost
	}
	return out
}

package addresses

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/platform/httpx"
	"github.com/tiredbooy/pkg/response"
	"github.com/tiredbooy/pkg/validator"
)

// Handler is the HTTP surface for customer shipping addresses.
type Handler struct {
	Service   Service
	Validator *validator.Validator
}

// NewHandler constructs the addresses HTTP handler.
func NewHandler(svc Service, v *validator.Validator) *Handler {
	return &Handler{Service: svc, Validator: v}
}

// Create — POST /addresses
func (h *Handler) Create(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	var req CreateAddressReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	addr, err := h.Service.Create(c.Request.Context(), userID, req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Created(c, ToResponse(addr))
}

// List — GET /addresses
func (h *Handler) List(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	addrs, err := h.Service.GetAllByUserID(c.Request.Context(), userID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	out := make([]AddressResponse, len(addrs))
	for i, a := range addrs {
		out[i] = ToResponse(a)
	}
	response.OK(c, out)
}

// Get — GET /addresses/:id
func (h *Handler) Get(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	addr, err := h.Service.GetByID(c.Request.Context(), id, userID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, ToResponse(addr))
}

// Update — PATCH /addresses/:id
func (h *Handler) Update(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	var req UpdateAddressReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	addr, err := h.Service.Update(c.Request.Context(), id, userID, req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, ToResponse(addr))
}

// Delete — DELETE /addresses/:id
func (h *Handler) Delete(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	if err := h.Service.Delete(c.Request.Context(), id, userID); err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.NoContent(c)
}

// SetDefault — POST /addresses/:id/default
func (h *Handler) SetDefault(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	if err := h.Service.SetDefault(c.Request.Context(), id, userID); err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.NoContent(c)
}

// ToResponse maps domain Address to the public JSON shape.
func ToResponse(a *Address) AddressResponse {
	return AddressResponse{
		ID:            a.ID,
		Title:         a.Title,
		FullName:      a.FullName,
		PhoneNumber:   a.PhoneNumber,
		AddressLine1:  a.AddressLine1,
		AddressLine2:  a.AddressLine2,
		City:          a.City,
		StateProvince: a.StateProvince,
		PostalCode:    a.PostalCode,
		Country:       a.Country,
		IsDefault:     a.IsDefault,
	}
}

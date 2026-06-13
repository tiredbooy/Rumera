package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/response"
)

// CreateAddress — POST /addresses
func (h *Handler) CreateAddress(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	var req models.CreateAddressReq
	if !h.bindJSON(c, &req) {
		return
	}
	addr, err := h.Address.Create(c.Request.Context(), userID, req)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Created(c, toAddressResponse(addr))
}

// ListAddresses — GET /addresses
func (h *Handler) ListAddresses(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	addrs, err := h.Address.GetAllByUserID(c.Request.Context(), userID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	out := make([]models.AddressResponse, len(addrs))
	for i, a := range addrs {
		out[i] = toAddressResponse(a)
	}
	response.OK(c, out)
}

// GetAddress — GET /addresses/:id
func (h *Handler) GetAddress(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	addr, err := h.Address.GetByID(c.Request.Context(), id, userID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, toAddressResponse(addr))
}

// UpdateAddress — PATCH /addresses/:id
func (h *Handler) UpdateAddress(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	var req models.UpdateAddressReq
	if !h.bindJSON(c, &req) {
		return
	}
	addr, err := h.Address.Update(c.Request.Context(), id, userID, req)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, toAddressResponse(addr))
}

// DeleteAddress — DELETE /addresses/:id
func (h *Handler) DeleteAddress(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	if err := h.Address.Delete(c.Request.Context(), id, userID); err != nil {
		response.HandleError(c, err)
		return
	}
	response.NoContent(c)
}

// SetDefaultAddress — POST /addresses/:id/default
func (h *Handler) SetDefaultAddress(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	if err := h.Address.SetDefault(c.Request.Context(), id, userID); err != nil {
		response.HandleError(c, err)
		return
	}
	response.NoContent(c)
}

func toAddressResponse(a *models.Address) models.AddressResponse {
	return models.AddressResponse{
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

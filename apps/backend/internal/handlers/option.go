package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/response"
)

func (h *Handler) ListOptionTypes(c *gin.Context) {
	values, err := h.Option.ListTypes(c.Request.Context())
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, values)
}

func (h *Handler) GetOptionType(c *gin.Context) {
	id, ok := h.paramInt64(c, "optionTypeID")
	if !ok {
		return
	}
	value, err := h.Option.GetType(c.Request.Context(), id)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, value)
}

func (h *Handler) CreateOptionType(c *gin.Context) {
	var req models.CreateOptionTypeReq
	if !h.bindJSON(c, &req) {
		return
	}
	value, err := h.Option.CreateType(c.Request.Context(), req)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.Created(c, value)
}

func (h *Handler) UpdateOptionType(c *gin.Context) {
	id, ok := h.paramInt64(c, "optionTypeID")
	if !ok {
		return
	}
	var req models.UpdateOptionTypeReq
	if !h.bindJSON(c, &req) {
		return
	}
	value, err := h.Option.UpdateType(c.Request.Context(), id, req)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, value)
}

func (h *Handler) DeleteOptionType(c *gin.Context) {
	id, ok := h.paramInt64(c, "optionTypeID")
	if !ok {
		return
	}
	if err := h.Option.DeleteType(c.Request.Context(), id); err != nil {
		h.handleError(c, err)
		return
	}
	response.NoContent(c)
}

func (h *Handler) ListOptionValues(c *gin.Context) {
	optionTypeID, ok := h.paramInt64(c, "optionTypeID")
	if !ok {
		return
	}
	values, err := h.Option.ListValues(c.Request.Context(), optionTypeID)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, values)
}

func (h *Handler) GetOptionValue(c *gin.Context) {
	id, ok := h.paramInt64(c, "optionValueID")
	if !ok {
		return
	}
	value, err := h.Option.GetValue(c.Request.Context(), id)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, value)
}

func (h *Handler) CreateOptionValue(c *gin.Context) {
	optionTypeID, ok := h.paramInt64(c, "optionTypeID")
	if !ok {
		return
	}
	var req models.CreateOptionValueReq
	if !h.bindJSON(c, &req) {
		return
	}
	value, err := h.Option.CreateValue(c.Request.Context(), optionTypeID, req)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.Created(c, value)
}

func (h *Handler) UpdateOptionValue(c *gin.Context) {
	id, ok := h.paramInt64(c, "optionValueID")
	if !ok {
		return
	}
	var req models.UpdateOptionValueReq
	if !h.bindJSON(c, &req) {
		return
	}
	value, err := h.Option.UpdateValue(c.Request.Context(), id, req)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, value)
}

func (h *Handler) DeleteOptionValue(c *gin.Context) {
	id, ok := h.paramInt64(c, "optionValueID")
	if !ok {
		return
	}
	if err := h.Option.DeleteValue(c.Request.Context(), id); err != nil {
		h.handleError(c, err)
		return
	}
	response.NoContent(c)
}

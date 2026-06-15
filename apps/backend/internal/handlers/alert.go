package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/response"
)

// CreateAlert — POST /alerts
func (h *Handler) CreateAlert(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	var req models.CreateAlertReq
	if !h.bindJSON(c, &req) {
		return
	}
	alert, err := h.Alert.Create(c.Request.Context(), userID, req)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Created(c, alert)
}

// ListAlerts — GET /alerts
func (h *Handler) ListAlerts(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	alerts, err := h.Alert.List(c.Request.Context(), userID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, alerts)
}

// DeleteAlert — DELETE /alerts/:id
func (h *Handler) DeleteAlert(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	if err := h.Alert.Delete(c.Request.Context(), userID, id); err != nil {
		response.HandleError(c, err)
		return
	}
	response.NoContent(c)
}

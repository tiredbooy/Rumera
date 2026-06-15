package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/response"
)

// GetTasteProfile — GET /me/taste-profile
func (h *Handler) GetTasteProfile(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	prefs, err := h.TasteProfile.Get(c.Request.Context(), userID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, prefs)
}

// SaveTasteProfile — PUT /me/taste-profile
func (h *Handler) SaveTasteProfile(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	var req models.TastePrefs
	if !h.bindJSON(c, &req) {
		return
	}
	prefs, err := h.TasteProfile.Save(c.Request.Context(), userID, req)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, prefs)
}

package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/response"
)

// ListSubscriptions — GET /subscriptions
func (h *Handler) ListSubscriptions(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	subs, err := h.Subscription.List(c.Request.Context(), userID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, subs)
}

// CreateSubscription — POST /subscriptions
func (h *Handler) CreateSubscription(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	var req models.CreateSubscriptionReq
	if !h.bindJSON(c, &req) {
		return
	}
	sub, err := h.Subscription.Create(c.Request.Context(), userID, req)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Created(c, sub)
}

// UpdateSubscription — PATCH /subscriptions/:id  (pause | resume | cancel | skip)
func (h *Handler) UpdateSubscription(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	var req models.UpdateSubscriptionReq
	if !h.bindJSON(c, &req) {
		return
	}
	sub, err := h.Subscription.Update(c.Request.Context(), userID, id, req.Action)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, sub)
}

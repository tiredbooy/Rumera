package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/response"
)

// GetMyReferral — GET /referrals/me
func (h *Handler) GetMyReferral(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	ref, err := h.Referral.Get(c.Request.Context(), userID)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, ref)
}

// ClaimReferral — POST /referrals/claim
// Links the caller to a referrer's code. Invalid/duplicate/self codes are silent
// no-ops, so the client can fire-and-forget after sign-up.
func (h *Handler) ClaimReferral(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	var req models.ClaimReferralReq
	if !h.bindJSON(c, &req) {
		return
	}
	if err := h.Referral.Claim(c.Request.Context(), userID, req.Code); err != nil {
		h.handleError(c, err)
		return
	}
	response.NoContent(c)
}

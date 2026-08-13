package referral

import "github.com/gin-gonic/gin"

func RegisterPublic(_ *gin.RouterGroup, _ *Handler) {}

func RegisterCustomer(c *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	c.GET("/referrals/me", h.GetMine)
	c.POST("/referrals/claim", h.Claim)
}

func RegisterAdmin(_ *gin.RouterGroup, _ *Handler) {}

package option

import "github.com/gin-gonic/gin"

// RegisterPublic is a no-op (option catalogue is admin-only).
func RegisterPublic(_ *gin.RouterGroup, _ *Handler) {}

// RegisterCustomer is a no-op.
func RegisterCustomer(_ *gin.RouterGroup, _ *Handler) {}

// RegisterAdmin mounts option type/value admin CRUD.
func RegisterAdmin(a *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	a.GET("/option-types", h.ListOptionTypes)
	a.POST("/option-types", h.CreateOptionType)
	a.GET("/option-types/:optionTypeID", h.GetOptionType)
	a.PATCH("/option-types/:optionTypeID", h.UpdateOptionType)
	a.DELETE("/option-types/:optionTypeID", h.DeleteOptionType)
	a.GET("/option-types/:optionTypeID/values", h.ListOptionValues)
	a.POST("/option-types/:optionTypeID/values", h.CreateOptionValue)
	a.GET("/option-values/:optionValueID", h.GetOptionValue)
	a.PATCH("/option-values/:optionValueID", h.UpdateOptionValue)
	a.DELETE("/option-values/:optionValueID", h.DeleteOptionValue)
}

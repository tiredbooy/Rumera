package tag

import "github.com/gin-gonic/gin"

// RegisterPublic mounts public tag catalogue routes.
func RegisterPublic(v1 *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	v1.GET("/tags", h.ListTags)
	v1.GET("/tags/:id", h.GetTag)
}

// RegisterCustomer is a no-op (tag reads are public; writes are admin).
func RegisterCustomer(_ *gin.RouterGroup, _ *Handler) {}

// RegisterAdmin mounts tag admin CRUD.
func RegisterAdmin(a *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	a.POST("/tags", h.CreateTag)
	a.PATCH("/tags/:id", h.UpdateTag)
	a.DELETE("/tags/:id", h.DeleteTag)
}

package users

import "github.com/gin-gonic/gin"

// RegisterPublic is a no-op for the users feature (registration is under auth).
func RegisterPublic(_ *gin.RouterGroup, _ *Handler) {}

// RegisterCustomer mounts authenticated self-service user routes.
// Parent group must already apply Auth middleware.
//
//	PATCH /auth/me  (mounted on the auth "me" group by the composer, or here
//	when the composer passes that group)
func RegisterCustomer(me *gin.RouterGroup, h *Handler) {
	// Nil handler still registers paths so route smoke tests and partial
	// composition graphs can mount the tree; runtime calls NPE only if hit.
	if h == nil {
		h = &Handler{}
	}
	me.PATCH("/me", h.UpdateProfile)
}

// RegisterAdmin mounts admin user administration routes (PH-021a).
// read: list/get/audit/roles summary; write: create/update/delete.
// Parent groups must already apply Auth + capability guards.
func RegisterAdmin(read, write *gin.RouterGroup, h *Handler) {
	// Nil handler still registers paths (see RegisterCustomer).
	if h == nil {
		h = &Handler{}
	}
	if read == nil {
		read = write
	}
	if write == nil {
		write = read
	}
	read.GET("/roles", h.GetAdminRoles)
	read.GET("/users", h.ListUsers)
	read.GET("/users/:userID", h.GetUser)
	read.GET("/users/:userID/audit", h.GetUserAudit)
	write.POST("/users", h.CreateUser)
	write.PATCH("/users/:userID", h.UpdateUser)
	write.DELETE("/users/:userID", h.DeleteUser)
}

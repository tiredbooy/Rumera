package users

import "github.com/gin-gonic/gin"

// RegisterPublic is a no-op for the users feature (registration is under auth).
func RegisterPublic(_ *gin.RouterGroup, _ *Handler) {}

// RegisterCustomer mounts authenticated self-service user routes.
// Parent group must already apply Auth middleware.
//
//	PATCH /auth/me  (mounted on the auth "me" group by the composer, or here
//	when the composer passes that group)
//
// A new phone in the PATCH body is not persisted (PR-040i). The client
// completes POST /auth/me/phone/otp and POST /auth/me/phone/verify (auth).
func RegisterCustomer(me *gin.RouterGroup, h *Handler) {
	// Nil handler still registers paths so route smoke tests and partial
	// composition graphs can mount the tree; runtime calls NPE only if hit.
	if h == nil {
		h = &Handler{}
	}
	me.PATCH("/me", h.UpdateProfile)
}

// AdminBanCapability is the panel grant required to POST
// /admin/users/:userID/ban and /unban. Isolated from customers:write so the
// default staff seed cannot lock accounts (PR-040e).
const AdminBanCapability = "customers:ban"

// RegisterAdmin mounts admin user administration routes (PH-021a / PR-040c / PR-040e).
// read: list/get/audit/roles summary.
// write: create/update/delete behind customers:write.
// ban: POST /users/:userID/ban|unban behind customers:ban.
// Staff may create customers and patch profile fields; role/status/deactivate
// still require live role=admin (service + liveAdminActor). Wallet credit is
// not on this group — see wallet.RegisterAdmin (wallet:credit).
// Parent groups must already apply Auth + capability guards.
func RegisterAdmin(read, write, ban *gin.RouterGroup, h *Handler) {
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
	if ban == nil {
		ban = write
	}
	read.GET("/roles", h.GetAdminRoles)
	read.GET("/users", h.ListUsers)
	read.GET("/users/:userID", h.GetUser)
	read.GET("/users/:userID/audit", h.GetUserAudit)
	write.POST("/users", h.CreateUser)
	write.PATCH("/users/:userID", h.UpdateUser)
	write.DELETE("/users/:userID", h.DeleteUser)
	ban.POST("/users/:userID/ban", h.BanUser)
	ban.POST("/users/:userID/unban", h.UnbanUser)
}

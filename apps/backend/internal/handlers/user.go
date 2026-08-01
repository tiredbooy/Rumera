package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/mappers"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/response"
)

// UpdateProfile lets the authenticated user edit their own profile.
//
// PATCH /auth/me
func (h *Handler) UpdateProfile(c *gin.Context) {
	id, ok := h.userUUID(c)
	if !ok {
		return
	}
	var input models.UpdateProfileInput
	if !h.bindJSON(c, &input) {
		return
	}
	req := mappers.MapToUpdateUserReq(input)

	user, err := h.User.Update(c.Request.Context(), id, req)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, mappers.MapToUserResponse(user))
}

// ── Admin ──────────────────────────────────────────────────────────────────

// GetAdminRoles — GET /admin/roles
func (h *Handler) GetAdminRoles(c *gin.Context) {
	summary, err := h.User.GetAdminRoles(c.Request.Context())
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, summary)
}

// CreateUser — POST /admin/users
func (h *Handler) CreateUser(c *gin.Context) {
	actorUserID, ok := h.userUUID(c)
	if !ok {
		return
	}
	var req models.AdminCreateUserReq
	if !h.bindJSON(c, &req) {
		return
	}
	user, err := h.User.AdminCreate(c.Request.Context(), actorUserID, req)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Created(c, mappers.MapToAdminUser(user))
}

// ListUsers — GET /admin/users
func (h *Handler) ListUsers(c *gin.Context) {
	var filter models.UserFilter
	if !h.bindQuery(c, &filter) {
		return
	}
	filter.Defaults()

	users, total, err := h.User.GetAll(c.Request.Context(), filter)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Paginated(c, users, paginate(filter.Page, filter.Limit, total))
}

// GetUser — GET /admin/users/:userID
func (h *Handler) GetUser(c *gin.Context) {
	id, ok := h.paramUUID(c, "userID")
	if !ok {
		return
	}
	user, err := h.User.GetByIDIncludingInactive(c.Request.Context(), id)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, mappers.MapToAdminUser(user))
}

// UpdateUser — PATCH /admin/users/:userID
//
// Admin-only edit of a user, including nullable profile fields, role, and status.
// Self-lockout rules and live actor revalidation are enforced below the HTTP
// layer by both the service and transactional repository boundary.
func (h *Handler) UpdateUser(c *gin.Context) {
	targetUserID, ok := h.paramUUID(c, "userID")
	if !ok {
		return
	}
	actorUserID, ok := h.userUUID(c)
	if !ok {
		return
	}
	var req models.AdminUpdateUserReq
	if !h.bindJSON(c, &req) {
		return
	}
	user, err := h.User.AdminUpdate(c.Request.Context(), actorUserID, targetUserID, req)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, mappers.MapToAdminUser(user))
}

// DeleteUser — DELETE /admin/users/:userID
func (h *Handler) DeleteUser(c *gin.Context) {
	targetUserID, ok := h.paramUUID(c, "userID")
	if !ok {
		return
	}
	actorUserID, ok := h.userUUID(c)
	if !ok {
		return
	}
	if err := h.User.AdminDeactivate(c.Request.Context(), actorUserID, targetUserID); err != nil {
		response.HandleError(c, err)
		return
	}
	response.NoContent(c)
}

// GetUserAudit — GET /admin/users/:userID/audit
func (h *Handler) GetUserAudit(c *gin.Context) {
	targetUserID, ok := h.paramUUID(c, "userID")
	if !ok {
		return
	}
	var filter models.AdminUserAuditFilter
	if !h.bindQuery(c, &filter) {
		return
	}
	filter.Defaults()
	events, total, err := h.User.GetAdminAudit(c.Request.Context(), targetUserID, filter)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Paginated(c, events, paginate(filter.Page, filter.Limit, total))
}

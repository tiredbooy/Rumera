package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/mappers"
	"github.com/tiredbooy/internal/middlewares"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
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
	var req models.UpdateUserReq
	if !h.bindJSON(c, &req) {
		return
	}
	// Password changes go through the dedicated reset flow — never accept a raw
	// hash from the client here.
	req.PasswordHash = nil

	user, err := h.User.Update(c.Request.Context(), id, req)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, mappers.MapToUserResponse(user))
}

// ── Admin ──────────────────────────────────────────────────────────────────

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
	response.Paginated(c, mappers.MapToUserListItems(users), paginate(filter.Page, filter.Limit, total))
}

// GetUser — GET /admin/users/:userID
func (h *Handler) GetUser(c *gin.Context) {
	id, ok := h.paramUUID(c, "userID")
	if !ok {
		return
	}
	user, err := h.User.GetByID(c.Request.Context(), id)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, mappers.MapToUserAdminResponse(user))
}

// UpdateUser — PATCH /admin/users/:userID
//
// Admin-only edit of another user. Beyond the profile fields editable on
// /auth/me, this route accepts the privileged role and is_active fields. A guard
// stops an admin from demoting or deactivating their OWN account, which would
// otherwise let an admin lock themselves (and potentially every admin) out of
// the console.
func (h *Handler) UpdateUser(c *gin.Context) {
	id, ok := h.paramUUID(c, "userID")
	if !ok {
		return
	}
	var req models.AdminUpdateUserReq
	if !h.bindJSON(c, &req) {
		return
	}
	// Password changes go through the dedicated reset flow — never accept a raw
	// hash from the client here.
	req.PasswordHash = nil

	// Lock-out protection: an admin may not strip their own admin role or
	// deactivate themselves.
	if callerID, ok := middlewares.UserUUID(c); ok && callerID == id {
		if (req.Role != nil && *req.Role != "admin") || (req.IsActive != nil && !*req.IsActive) {
			h.handleError(c, apperr.ErrAccessDenied)
			return
		}
	}

	user, err := h.User.AdminUpdate(c.Request.Context(), id, req)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, mappers.MapToUserAdminResponse(user))
}

// DeleteUser — DELETE /admin/users/:userID
func (h *Handler) DeleteUser(c *gin.Context) {
	id, ok := h.paramUUID(c, "userID")
	if !ok {
		return
	}
	if err := h.User.Delete(c.Request.Context(), id); err != nil {
		response.HandleError(c, err)
		return
	}
	response.NoContent(c)
}

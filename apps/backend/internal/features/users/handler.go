package users

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/platform/httpx"
	"github.com/tiredbooy/pkg/response"
	"github.com/tiredbooy/pkg/validator"
)

// Handler is the HTTP surface for user profile and admin user management.
// Auth login/register stay in the auth feature and call Service methods.
type Handler struct {
	Service   *Service
	Validator *validator.Validator
}

// NewHandler constructs the users HTTP handler.
func NewHandler(svc *Service, v *validator.Validator) *Handler {
	return &Handler{Service: svc, Validator: v}
}

// UpdateProfile — PATCH /auth/me
func (h *Handler) UpdateProfile(c *gin.Context) {
	id, ok := httpx.UserUUID(c)
	if !ok {
		return
	}
	var input UpdateProfileInput
	if !httpx.BindJSON(c, h.Validator, &input) {
		return
	}
	req := MapToUpdateUserReq(input)

	user, err := h.Service.Update(c.Request.Context(), id, req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, MapToUserResponse(user))
}

// GetAdminRoles — GET /admin/roles
func (h *Handler) GetAdminRoles(c *gin.Context) {
	summary, err := h.Service.GetAdminRoles(c.Request.Context())
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, summary)
}

// CreateUser — POST /admin/users
func (h *Handler) CreateUser(c *gin.Context) {
	actorUserID, ok := httpx.UserUUID(c)
	if !ok {
		return
	}
	var req AdminCreateUserReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	user, err := h.Service.AdminCreate(c.Request.Context(), actorUserID, req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Created(c, MapToAdminUser(user))
}

// ListUsers — GET /admin/users
func (h *Handler) ListUsers(c *gin.Context) {
	var filter UserFilter
	if !httpx.BindQuery(c, h.Validator, &filter) {
		return
	}
	filter.Defaults()

	list, total, err := h.Service.GetAll(c.Request.Context(), filter)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Paginated(c, list, httpx.Paginate(filter.Page, filter.Limit, total))
}

// GetUser — GET /admin/users/:userID
func (h *Handler) GetUser(c *gin.Context) {
	id, ok := httpx.ParamUUID(c, "userID")
	if !ok {
		return
	}
	user, err := h.Service.GetByIDIncludingInactive(c.Request.Context(), id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, MapToAdminUser(user))
}

// UpdateUser — PATCH /admin/users/:userID
func (h *Handler) UpdateUser(c *gin.Context) {
	targetUserID, ok := httpx.ParamUUID(c, "userID")
	if !ok {
		return
	}
	actorUserID, ok := httpx.UserUUID(c)
	if !ok {
		return
	}
	var req AdminUpdateUserReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	user, err := h.Service.AdminUpdate(c.Request.Context(), actorUserID, targetUserID, req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, MapToAdminUser(user))
}

// DeleteUser — DELETE /admin/users/:userID
func (h *Handler) DeleteUser(c *gin.Context) {
	targetUserID, ok := httpx.ParamUUID(c, "userID")
	if !ok {
		return
	}
	actorUserID, ok := httpx.UserUUID(c)
	if !ok {
		return
	}
	if err := h.Service.AdminDeactivate(c.Request.Context(), actorUserID, targetUserID); err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.NoContent(c)
}

// GetUserAudit — GET /admin/users/:userID/audit
func (h *Handler) GetUserAudit(c *gin.Context) {
	targetUserID, ok := httpx.ParamUUID(c, "userID")
	if !ok {
		return
	}
	var filter AdminUserAuditFilter
	if !httpx.BindQuery(c, h.Validator, &filter) {
		return
	}
	filter.Defaults()
	events, total, err := h.Service.GetAdminAudit(c.Request.Context(), targetUserID, filter)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Paginated(c, events, httpx.Paginate(filter.Page, filter.Limit, total))
}

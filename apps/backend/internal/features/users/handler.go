package users

import (
	"log/slog"
	"net/http"

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

	result, err := h.Service.Update(c.Request.Context(), id, req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	body := MapToUserResponse(result.User)
	if result.PendingPhone != nil {
		response.Success(c, http.StatusAccepted, ProfileUpdateResponse{
			UserResponse: *body,
			PendingPhone: result.PendingPhone,
		})
		return
	}
	response.OK(c, body)
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
	ctx := c.Request.Context()
	user, err := h.Service.GetByIDIncludingInactive(ctx, id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	// CF-3: the customer file mints wallet credit, so the balance ships with
	// the identity instead of being one more call the screen has to fan out to.
	// A wallet read that fails omits the field rather than taking the whole
	// identity card down — the admin screen renders an absent balance as
	// "unknown", which is the honest answer and never reads as an empty wallet.
	balance, err := h.Service.GetAdminWalletBalance(ctx, user.ID)
	if err != nil {
		slog.Warn("users: admin wallet balance read failed",
			"user_id", user.ID, "error", err)
		response.OK(c, MapToAdminUser(user))
		return
	}
	response.OK(c, MapToAdminUserWithWallet(user, balance))
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

// BanUser — POST /admin/users/:userID/ban
func (h *Handler) BanUser(c *gin.Context) {
	targetUserID, ok := httpx.ParamUUID(c, "userID")
	if !ok {
		return
	}
	actorUserID, ok := httpx.UserUUID(c)
	if !ok {
		return
	}
	user, err := h.Service.AdminBan(c.Request.Context(), actorUserID, targetUserID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, MapToAdminUser(user))
}

// UnbanUser — POST /admin/users/:userID/unban
func (h *Handler) UnbanUser(c *gin.Context) {
	targetUserID, ok := httpx.ParamUUID(c, "userID")
	if !ok {
		return
	}
	actorUserID, ok := httpx.UserUUID(c)
	if !ok {
		return
	}
	user, err := h.Service.AdminUnban(c.Request.Context(), actorUserID, targetUserID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, MapToAdminUser(user))
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

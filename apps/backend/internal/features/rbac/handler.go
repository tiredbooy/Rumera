package rbac

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/platform/httpx"
	"github.com/tiredbooy/pkg/response"
	"github.com/tiredbooy/pkg/validator"
)

// Handler is the HTTP surface for panel role capabilities.
// Routes are registered via RegisterAdmin; no public/customer routes exist.
type Handler struct {
	Service   *Service
	Validator *validator.Validator
}

// NewHandler constructs the rbac HTTP handler.
func NewHandler(svc *Service, v *validator.Validator) *Handler {
	return &Handler{Service: svc, Validator: v}
}

// ListCapabilities — GET /admin/capabilities
// Returns the durable role → permissions matrix plus the closed catalogue.
// Any panel role (admin|staff) may read so the FE can resolve live grants.
func (h *Handler) ListCapabilities(c *gin.Context) {
	items, err := h.Service.ListMatrix(c.Request.Context())
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, gin.H{
		"capabilities": items,
		"catalogue":    AllKnownPermissions(),
	})
}

// ReplaceCapabilities — PUT /admin/capabilities/:role
// Requires roles:manage (admin superuser always passes).
func (h *Handler) ReplaceCapabilities(c *gin.Context) {
	actorRole, _ := c.Get("role")
	roleStr, _ := actorRole.(string)
	ok, err := h.Service.HasPermission(c.Request.Context(), roleStr, PermRolesManage)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	if !ok {
		response.Error(c, response.ErrInsufficientPermissions)
		return
	}

	role := c.Param("role")
	var req UpdateRoleCapabilitiesReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	item, err := h.Service.Replace(c.Request.Context(), role, req.Permissions)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, item)
}

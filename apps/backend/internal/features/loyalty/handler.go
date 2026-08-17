package loyalty

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/platform/httpx"
	"github.com/tiredbooy/pkg/apperr"
	"github.com/tiredbooy/pkg/response"
	"github.com/tiredbooy/pkg/validator"
)

type Handler struct {
	Service   *Service
	Validator *validator.Validator
}

func NewHandler(svc *Service, v *validator.Validator) *Handler {
	return &Handler{Service: svc, Validator: v}
}

func (h *Handler) GetAccount(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	acc, err := h.Service.Get(c.Request.Context(), userID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, acc)
}

func (h *Handler) ListTransactions(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	var filter TransactionFilter
	if !httpx.BindQuery(c, h.Validator, &filter) {
		return
	}
	filter.Defaults()
	txs, total, err := h.Service.ListTransactions(c.Request.Context(), userID, filter)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Paginated(c, txs, httpx.Paginate(filter.Page, filter.Limit, total))
}

// GetProgramme returns effective rates + tiers for admin (PH-040d / PR-003f).
func (h *Handler) GetProgramme(c *gin.Context) {
	if h.Service == nil {
		httpx.HandleError(c, apperr.ErrInternal)
		return
	}
	p, err := h.Service.Programme(c.Request.Context())
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, p)
}

// UpdateProgramme — PUT /admin/loyalty/programme (customers:write).
func (h *Handler) UpdateProgramme(c *gin.Context) {
	if h.Service == nil {
		httpx.HandleError(c, apperr.ErrInternal)
		return
	}
	var req UpdateProgrammeRequest
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	p, err := h.Service.UpdateProgramme(c.Request.Context(), req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, p)
}

// ListMembers — GET /admin/loyalty/members?q=&tier=&sortBy=&orderBy=&page=&limit=
func (h *Handler) ListMembers(c *gin.Context) {
	if h.Service == nil {
		httpx.HandleError(c, apperr.ErrInternal)
		return
	}
	var filter MemberFilter
	if !httpx.BindQuery(c, h.Validator, &filter) {
		return
	}
	filter.Defaults()
	rows, total, err := h.Service.ListMembers(c.Request.Context(), filter)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Paginated(c, rows, httpx.Paginate(filter.Page, filter.Limit, total))
}

// GetMember — GET /admin/loyalty/members/:userID (users.user_id UUID).
func (h *Handler) GetMember(c *gin.Context) {
	if h.Service == nil {
		httpx.HandleError(c, apperr.ErrInternal)
		return
	}
	userID, ok := httpx.ParamUUID(c, "userID")
	if !ok {
		return
	}
	acc, err := h.Service.GetMember(c.Request.Context(), userID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, acc)
}

// ListMemberTransactions — GET /admin/loyalty/members/:userID/transactions
func (h *Handler) ListMemberTransactions(c *gin.Context) {
	if h.Service == nil {
		httpx.HandleError(c, apperr.ErrInternal)
		return
	}
	userID, ok := httpx.ParamUUID(c, "userID")
	if !ok {
		return
	}
	var filter MemberTransactionFilter
	if !httpx.BindQuery(c, h.Validator, &filter) {
		return
	}
	filter.Defaults()
	txs, total, err := h.Service.ListMemberTransactions(c.Request.Context(), userID, filter)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Paginated(c, txs, httpx.Paginate(filter.Page, filter.Limit, total))
}

// AdminAdjust — POST /admin/users/:userID/loyalty/adjust
// Requires customers:write (group middleware). Records actor UUID + client
// idempotency key on the ledger ref (wallet-credit pattern).
func (h *Handler) AdminAdjust(c *gin.Context) {
	if h.Service == nil {
		httpx.HandleError(c, apperr.ErrInternal)
		return
	}
	userID, ok := httpx.ParamUUID(c, "userID")
	if !ok {
		return
	}
	actorID, ok := httpx.UserUUID(c)
	if !ok {
		return
	}
	var req AdminAdjustRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, response.ErrInvalidJSON)
		return
	}
	// Prefer explicit body key; allow Idempotency-Key header as fallback.
	if strings.TrimSpace(req.IdempotencyKey) == "" {
		req.IdempotencyKey = strings.TrimSpace(c.GetHeader("Idempotency-Key"))
	}
	if !httpx.Validate(c, h.Validator, &req) {
		return
	}
	result, err := h.Service.Adjust(
		c.Request.Context(),
		actorID,
		userID,
		req.Delta,
		req.Note,
		req.IdempotencyKey,
	)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	if result.Replayed {
		response.OK(c, result)
		return
	}
	response.Created(c, result)
}

func (h *Handler) Redeem(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	var req RedeemPointsRequest
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	// Prefer Idempotency-Key; body idempotency_key is accepted (PR-003g).
	// Missing key is 400 — no nano-suffix fallback.
	clientKey := strings.TrimSpace(c.GetHeader("Idempotency-Key"))
	if clientKey == "" {
		clientKey = strings.TrimSpace(req.IdempotencyKey)
	}
	acc, err := h.Service.Redeem(c.Request.Context(), userID, req.Points, clientKey)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, acc)
}

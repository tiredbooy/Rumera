package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"reflect"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/tiredbooy/internal/middlewares"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/response"
)

// ── Request binding ────────────────────────────────────────────────────────

// bindJSON decodes the JSON body into dst and runs struct validation. On any
// failure it writes the appropriate error response and returns false, so the
// caller can simply `if !h.bindJSON(c, &req) { return }`.
func (h *Handler) bindJSON(c *gin.Context, dst any) bool {
	if err := c.ShouldBindJSON(dst); err != nil {
		response.Error(c, response.ErrInvalidJSON)
		return false
	}
	return h.validate(c, dst)
}

// validate runs the struct validator and writes a 422 with field errors when it
// fails.
func (h *Handler) validate(c *gin.Context, dst any) bool {
	if h.Validator == nil {
		return true
	}
	fields, err := h.Validator.Validate(dst)
	if err != nil {
		if len(fields) > 0 {
			response.ValidationError(c, fields)
		} else {
			response.Error(c, response.ErrInvalidBody)
		}
		return false
	}
	return true
}

// ── Path / query params ────────────────────────────────────────────────────

// paramInt64 reads a positive int64 path parameter, writing ErrInvalidParams on
// failure.
func (h *Handler) paramInt64(c *gin.Context, key string) (int64, bool) {
	id, err := strconv.ParseInt(c.Param(key), 10, 64)
	if err != nil || id <= 0 {
		response.Error(c, response.ErrInvalidParams)
		return 0, false
	}
	return id, true
}

// paramUUID reads a UUID path parameter, writing ErrInvalidParams on failure.
func (h *Handler) paramUUID(c *gin.Context, key string) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param(key))
	if err != nil {
		response.Error(c, response.ErrInvalidParams)
		return uuid.UUID{}, false
	}
	return id, true
}

// ── Identity ───────────────────────────────────────────────────────────────

// uid returns the authenticated caller's internal user id, writing 401 when the
// request is unauthenticated.
func (h *Handler) uid(c *gin.Context) (int64, bool) {
	id, ok := middlewares.UID(c)
	if !ok {
		response.Error(c, response.ErrUnauthorized)
		return 0, false
	}
	return id, true
}

// userUUID returns the authenticated caller's public uuid, writing 401 when the
// request is unauthenticated.
func (h *Handler) userUUID(c *gin.Context) (uuid.UUID, bool) {
	id, ok := middlewares.UserUUID(c)
	if !ok {
		response.Error(c, response.ErrUnauthorized)
		return uuid.UUID{}, false
	}
	return id, true
}

// ── Filter / query binding ─────────────────────────────────────────────────

// bindQuery populates dst from the URL query string using `query` struct tags
// (and the lower-cased field name when no tag is present). It understands
// strings, bools, ints, floats, time.Time and pointers to them, recursing into
// embedded structs such as BaseFilter. Unparseable values or failed validation
// tags yield ErrInvalidQuery.
func (h *Handler) bindQuery(c *gin.Context, dst any) bool {
	v := reflect.ValueOf(dst)
	if v.Kind() != reflect.Ptr || v.IsNil() {
		response.Error(c, response.ErrInvalidQuery)
		return false
	}
	if err := bindStruct(c, v.Elem()); err != nil {
		response.Error(c, response.ErrInvalidQuery)
		return false
	}
	if !validBaseQuery(c) {
		response.Error(c, response.ErrInvalidQuery)
		return false
	}
	if h.Validator != nil {
		if _, err := h.Validator.Validate(dst); err != nil {
			response.Error(c, response.ErrInvalidQuery)
			return false
		}
	}
	return true
}

func validBaseQuery(c *gin.Context) bool {
	if raw, present := c.GetQuery("page"); present && raw != "" {
		page, err := strconv.Atoi(raw)
		if err != nil || page < 1 {
			return false
		}
	}
	if raw, present := c.GetQuery("limit"); present && raw != "" {
		limit, err := strconv.Atoi(raw)
		if err != nil || limit < 1 || limit > 100 {
			return false
		}
	}
	if order, present := c.GetQuery("orderBy"); present && order != "" && order != "asc" && order != "desc" {
		return false
	}
	return true
}

var timeType = reflect.TypeOf(time.Time{})

func bindStruct(c *gin.Context, v reflect.Value) error {
	t := v.Type()
	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)
		fv := v.Field(i)

		// Recurse into embedded (anonymous) structs — but not time.Time.
		if field.Anonymous && fv.Kind() == reflect.Struct && fv.Type() != timeType {
			if err := bindStruct(c, fv); err != nil {
				return err
			}
			continue
		}
		if !fv.CanSet() {
			continue
		}

		key := field.Tag.Get("query")
		if key == "" {
			key = strings.ToLower(field.Name)
		}
		raw := c.Query(key)
		if raw == "" {
			continue
		}
		if err := setField(fv, raw); err != nil {
			return fmt.Errorf("query %q: %w", key, err)
		}
	}
	return nil
}

func setField(fv reflect.Value, raw string) error {
	if fv.Kind() == reflect.Ptr {
		if fv.IsNil() {
			fv.Set(reflect.New(fv.Type().Elem()))
		}
		return setField(fv.Elem(), raw)
	}

	switch fv.Kind() {
	case reflect.String:
		fv.SetString(raw)
	case reflect.Bool:
		b, err := strconv.ParseBool(raw)
		if err != nil {
			return err
		}
		fv.SetBool(b)
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		n, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			return err
		}
		fv.SetInt(n)
	case reflect.Float32, reflect.Float64:
		f, err := strconv.ParseFloat(raw, 64)
		if err != nil {
			return err
		}
		fv.SetFloat(f)
	case reflect.Struct:
		if fv.Type() == timeType {
			ts, err := time.Parse(time.RFC3339, raw)
			if err != nil {
				return err
			}
			fv.Set(reflect.ValueOf(ts))
			return nil
		}
		return fmt.Errorf("unsupported struct type %s", fv.Type())
	default:
		return fmt.Errorf("unsupported kind %s", fv.Kind())
	}
	return nil
}

// ── Domain error mapping ───────────────────────────────────────────────────

// domainErrors maps service-layer sentinel errors (package models) to stable
// HTTP error codes. Several services return these instead of *apperr.AppError,
// so without this translation they would surface as a generic 500. Checked with
// errors.Is, so wrapped errors still match.
var domainErrors = []struct {
	err  error
	code response.AppCode
}{
	{models.ErrNotFound, response.ErrNotFound},
	{models.ErrAlreadyExists, response.ErrConflict},
	{models.ErrConflict, response.ErrConflict},
	{models.ErrInvalidState, response.AppCode{Code: "INVALID_STATE", StatusCode: http.StatusConflict, Message: "resource is in an invalid state"}},
	{models.ErrInsufficientStock, response.ErrOutOfStock},
	{models.ErrInvalidInventoryAdjustment, response.ErrValidationError},
	{models.ErrInsufficientFunds, response.AppCode{Code: "INSUFFICIENT_FUNDS", StatusCode: http.StatusConflict, Message: "insufficient wallet balance"}},
	{models.ErrCartEmpty, response.ErrCartEmpty},
	{models.ErrInvalidShippingMethod, response.AppCode{Code: "INVALID_SHIPPING_METHOD", StatusCode: http.StatusBadRequest, Message: "invalid or unavailable shipping method"}},
	{models.ErrInvalidCoupon, response.ErrInvalidCoupon},
	{models.ErrCouponExpired, response.ErrCouponExpired},
	{models.ErrCouponNotActive, response.AppCode{Code: "COUPON_NOT_ACTIVE", StatusCode: http.StatusBadRequest, Message: "coupon is not active yet"}},
	{models.ErrOrderBelowMinimum, response.AppCode{Code: "ORDER_BELOW_MINIMUM", StatusCode: http.StatusBadRequest, Message: "order does not meet the coupon minimum"}},
	{models.ErrCouponUsageLimitReached, response.AppCode{Code: "COUPON_USAGE_LIMIT", StatusCode: http.StatusConflict, Message: "coupon usage limit reached"}},
	{models.ErrCouponUserLimitReached, response.AppCode{Code: "COUPON_USER_LIMIT", StatusCode: http.StatusConflict, Message: "coupon already used the maximum number of times"}},
	{models.ErrHasChildren, response.AppCode{Code: "HAS_CHILDREN", StatusCode: http.StatusConflict, Message: "resource has children and cannot be deleted"}},
}

// handleError maps an error to the correct HTTP response. It recognises both the
// package-models sentinels and *apperr.AppError, falling back to a 500 for
// anything unexpected. Handlers calling services that may return either kind
// should use this instead of response.HandleError directly.
func (h *Handler) handleError(c *gin.Context, err error) {
	for _, de := range domainErrors {
		if errors.Is(err, de.err) {
			response.Error(c, de.code)
			return
		}
	}
	response.HandleError(c, err)
}

// ── Responses ──────────────────────────────────────────────────────────────

// paginate is a small adapter that maps a (page,limit,total) tuple to the
// response.Pagination envelope.
func paginate(page, limit int, total int64) response.Pagination {
	if limit <= 0 {
		limit = 1
	}
	return response.NewPagination(page, limit, int(total))
}

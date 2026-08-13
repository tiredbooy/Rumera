package httpx

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/response"
)

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
	{models.ErrInvalidState, response.ErrInvalidState},
	{models.ErrInsufficientStock, response.ErrOutOfStock},
	{models.ErrInvalidInventoryAdjustment, response.ErrValidationError},
	{models.ErrInsufficientFunds, response.ErrInsufficientFunds},
	{models.ErrCartEmpty, response.ErrCartEmpty},
	{models.ErrInvalidShippingMethod, response.ErrInvalidShipping},
	{models.ErrInvalidCoupon, response.ErrInvalidCoupon},
	{models.ErrCouponExpired, response.ErrCouponExpired},
	{models.ErrCouponNotActive, response.ErrCouponNotActive},
	{models.ErrOrderBelowMinimum, response.ErrOrderBelowMin},
	{models.ErrCouponUsageLimitReached, response.ErrCouponUsageLimit},
	{models.ErrCouponUserLimitReached, response.ErrCouponUserLimit},
	{models.ErrHasChildren, response.AppCode{Code: "HAS_CHILDREN", StatusCode: http.StatusConflict, Message: "resource has children and cannot be deleted"}},
	{models.ErrHierarchyCycle, response.AppCode{Code: "HIERARCHY_CYCLE", StatusCode: http.StatusConflict, Message: "hierarchy would contain a cycle"}},
	{models.ErrAccessDenied, response.ErrForbidden},
	{models.ErrProductHasHistory, response.ErrProductHasHistory},
	// Hero slide validation (feature-local sentinels still shared in models)
	{models.ErrHeroSchedule, response.AppCode{Code: "HERO_SCHEDULE_INVALID", StatusCode: http.StatusBadRequest, Message: "hero slide schedule is invalid"}},
	{models.ErrHeroPrimaryCTA, response.AppCode{Code: "HERO_PRIMARY_CTA_INVALID", StatusCode: http.StatusBadRequest, Message: "hero slide primary CTA is invalid"}},
	{models.ErrHeroSecondaryCTA, response.AppCode{Code: "HERO_SECONDARY_CTA_INVALID", StatusCode: http.StatusBadRequest, Message: "hero slide secondary CTA is invalid"}},
}

// HandleError maps an error to the correct HTTP response. It recognises both
// package-models sentinels and *apperr.AppError, falling back to a 500 for
// anything unexpected.
func HandleError(c *gin.Context, err error) {
	for _, de := range domainErrors {
		if errors.Is(err, de.err) {
			response.Error(c, de.code)
			return
		}
	}
	response.HandleError(c, err)
}

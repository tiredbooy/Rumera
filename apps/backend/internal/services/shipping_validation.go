package services

import (
	"math"
	"strings"
	"unicode/utf8"

	"github.com/shopspring/decimal"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

const (
	maxShippingMoney  = 99_999_999.99
	maxShippingWeight = 999_999.99
)

func normalizeCreateShippingZone(req *models.CreateShippingZoneReq) error {
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" || utf8.RuneCountInString(req.Name) > 100 {
		return apperr.ErrInvalidRequest
	}
	req.Description = normalizeShippingText(req.Description)
	regions, ok := normalizeRegionCodes(req.RegionCodes)
	if !ok {
		return apperr.ErrInvalidRequest
	}
	req.RegionCodes = regions
	return nil
}

func normalizeUpdateShippingZone(req *models.UpdateShippingZoneReq) error {
	if req.Name.Set {
		if req.Name.Value == nil {
			return apperr.ErrInvalidRequest
		}
		name := strings.TrimSpace(*req.Name.Value)
		if name == "" || utf8.RuneCountInString(name) > 100 {
			return apperr.ErrInvalidRequest
		}
		req.Name.Value = &name
	}
	if req.Description.Set {
		req.Description.Value = normalizeShippingText(req.Description.Value)
	}
	if req.RegionCodes.Set {
		if req.RegionCodes.Value == nil {
			return apperr.ErrInvalidRequest
		}
		regions, ok := normalizeRegionCodes(*req.RegionCodes.Value)
		if !ok {
			return apperr.ErrInvalidRequest
		}
		req.RegionCodes.Value = &regions
	}
	if req.IsActive.Set && req.IsActive.Value == nil {
		return apperr.ErrInvalidRequest
	}
	return nil
}

func normalizeCreateShippingMethod(req *models.CreateShippingMethodReq) error {
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" || utf8.RuneCountInString(req.Name) > 100 {
		return apperr.ErrInvalidRequest
	}
	req.Carrier = normalizeShippingText(req.Carrier)
	if req.Carrier != nil && utf8.RuneCountInString(*req.Carrier) > 100 {
		return apperr.ErrInvalidRequest
	}
	req.Description = normalizeShippingText(req.Description)
	return validateShippingMethodDefinition(
		req.RateType,
		req.BaseRate,
		req.FreeAboveAmount,
		req.MinDeliveryDays,
		req.MaxDeliveryDays,
		req.MaxWeightKg,
	)
}

func normalizeUpdateShippingMethod(req *models.UpdateShippingMethodReq, current *models.ShippingMethod) error {
	if req.Name.Set {
		if req.Name.Value == nil {
			return apperr.ErrInvalidRequest
		}
		name := strings.TrimSpace(*req.Name.Value)
		if name == "" || utf8.RuneCountInString(name) > 100 {
			return apperr.ErrInvalidRequest
		}
		req.Name.Value = &name
	}
	if req.Carrier.Set {
		req.Carrier.Value = normalizeShippingText(req.Carrier.Value)
		if req.Carrier.Value != nil && utf8.RuneCountInString(*req.Carrier.Value) > 100 {
			return apperr.ErrInvalidRequest
		}
	}
	if req.Description.Set {
		req.Description.Value = normalizeShippingText(req.Description.Value)
	}
	if (req.RateType.Set && req.RateType.Value == nil) ||
		(req.BaseRate.Set && req.BaseRate.Value == nil) ||
		(req.IsActive.Set && req.IsActive.Value == nil) {
		return apperr.ErrInvalidRequest
	}

	rateType := current.RateType
	if req.RateType.Set {
		rateType = *req.RateType.Value
	}
	baseRate := current.BaseRate
	if req.BaseRate.Set {
		baseRate = *req.BaseRate.Value
	}
	freeAbove := current.FreeAboveAmount
	if req.FreeAboveAmount.Set {
		freeAbove = req.FreeAboveAmount.Value
	}
	minDays := current.MinDeliveryDays
	if req.MinDeliveryDays.Set {
		minDays = req.MinDeliveryDays.Value
	}
	maxDays := current.MaxDeliveryDays
	if req.MaxDeliveryDays.Set {
		maxDays = req.MaxDeliveryDays.Value
	}
	maxWeight := current.MaxWeightKg
	if req.MaxWeightKg.Set {
		maxWeight = req.MaxWeightKg.Value
	}

	return validateShippingMethodDefinition(rateType, baseRate, freeAbove, minDays, maxDays, maxWeight)
}

func validateShippingMethodDefinition(
	rateType models.ShippingRateType,
	baseRate float64,
	freeAbove *float64,
	minDays, maxDays *int16,
	maxWeight *float64,
) error {
	if !validShippingRateType(rateType) || !validShippingDecimal(baseRate, maxShippingMoney) {
		return apperr.ErrInvalidRequest
	}
	if rateType == models.ShippingRatePercentage && baseRate > 100 {
		return apperr.ErrInvalidRequest
	}
	if rateType == models.ShippingRateFree && (baseRate != 0 || freeAbove != nil) {
		return apperr.ErrInvalidRequest
	}
	if freeAbove != nil && (!validShippingDecimal(*freeAbove, maxShippingMoney) || *freeAbove <= 0) {
		return apperr.ErrInvalidRequest
	}
	if minDays != nil && *minDays < 0 {
		return apperr.ErrInvalidRequest
	}
	if maxDays != nil && *maxDays < 0 {
		return apperr.ErrInvalidRequest
	}
	if minDays != nil && maxDays != nil && *minDays > *maxDays {
		return apperr.ErrInvalidRequest
	}
	if maxWeight != nil && (!validShippingDecimal(*maxWeight, maxShippingWeight) || *maxWeight <= 0) {
		return apperr.ErrInvalidRequest
	}
	return nil
}

func normalizeRegionCodes(codes []string) ([]string, bool) {
	if len(codes) == 0 {
		return nil, false
	}
	seen := make(map[string]struct{}, len(codes))
	regions := make([]string, 0, len(codes))
	for _, code := range codes {
		code = strings.ToUpper(strings.TrimSpace(code))
		if code == "" {
			return nil, false
		}
		if _, exists := seen[code]; exists {
			continue
		}
		seen[code] = struct{}{}
		regions = append(regions, code)
	}
	return regions, len(regions) > 0
}

func normalizeShippingText(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func validShippingRateType(rateType models.ShippingRateType) bool {
	switch rateType {
	case models.ShippingRateFlat, models.ShippingRatePerKg, models.ShippingRatePercentage, models.ShippingRateFree:
		return true
	default:
		return false
	}
}

func validShippingDecimal(value, maximum float64) bool {
	return finiteNonNegative(value) && value <= maximum && decimal.NewFromFloat(value).Exponent() >= -2
}

func finiteNonNegative(value float64) bool {
	return !math.IsNaN(value) && !math.IsInf(value, 0) && value >= 0
}

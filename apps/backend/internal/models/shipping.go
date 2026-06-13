// internal/models/shipping.go
package models

import "time"


type ShippingRateType string

const (
	ShippingRateFlat       ShippingRateType = "flat_rate"
	ShippingRatePerKg      ShippingRateType = "per_kg"
	ShippingRatePercentage ShippingRateType = "percentage"
	ShippingRateFree       ShippingRateType = "free"
)

type ShippingZone struct {
	ID          int64     `db:"id"`
	Name        string    `db:"name"`
	Description *string   `db:"description"`
	RegionCodes []string  `db:"region_codes"`
	IsActive    bool      `db:"is_active"`
	CreatedAt   time.Time `db:"created_at"`
	UpdatedAt   time.Time `db:"updated_at"`
}

type ShippingMethod struct {
	ID              int64            `db:"id"`
	ShippingZoneID  int64            `db:"shipping_zone_id"`
	Name            string           `db:"name"`
	Carrier         *string          `db:"carrier"`
	Description     *string          `db:"description"`
	RateType        ShippingRateType `db:"rate_type"`
	BaseRate        float64          `db:"base_rate"`
	FreeAboveAmount *float64         `db:"free_above_amount"`
	MinDeliveryDays *int16           `db:"min_delivery_days"`
	MaxDeliveryDays *int16           `db:"max_delivery_days"`
	MaxWeightKg     *float64         `db:"max_weight_kg"`
	IsActive        bool             `db:"is_active"`
	CreatedAt       time.Time        `db:"created_at"`
	UpdatedAt       time.Time        `db:"updated_at"`
}

type CreateShippingZoneReq struct {
	Name        string   `json:"name"         validate:"required,max=100"`
	Description *string  `json:"description"`
	RegionCodes []string `json:"region_codes" validate:"required,min=1"`
	IsActive    *bool    `json:"is_active"`
}

type UpdateShippingZoneReq struct {
	Name        *string  `json:"name"         validate:"omitempty,max=100"`
	Description *string  `json:"description"`
	RegionCodes []string `json:"region_codes" validate:"omitempty,min=1"`
	IsActive    *bool    `json:"is_active"`
}

type CreateShippingMethodReq struct {
	Name            string           `json:"name"              validate:"required,max=100"`
	Carrier         *string          `json:"carrier"           validate:"omitempty,max=100"`
	Description     *string          `json:"description"`
	RateType        ShippingRateType `json:"rate_type"         validate:"required,oneof=flat_rate per_kg percentage free"`
	BaseRate        float64          `json:"base_rate"         validate:"min=0"`
	FreeAboveAmount *float64         `json:"free_above_amount" validate:"omitempty,gt=0"`
	MinDeliveryDays *int16           `json:"min_delivery_days" validate:"omitempty,min=0"`
	MaxDeliveryDays *int16           `json:"max_delivery_days" validate:"omitempty,min=0"`
	MaxWeightKg     *float64         `json:"max_weight_kg"     validate:"omitempty,gt=0"`
	IsActive        *bool            `json:"is_active"`
}

type UpdateShippingMethodReq struct {
	Name            *string           `json:"name"              validate:"omitempty,max=100"`
	Carrier         *string           `json:"carrier"           validate:"omitempty,max=100"`
	Description     *string           `json:"description"`
	RateType        *ShippingRateType `json:"rate_type"         validate:"omitempty,oneof=flat_rate per_kg percentage free"`
	BaseRate        *float64          `json:"base_rate"         validate:"omitempty,min=0"`
	FreeAboveAmount *float64          `json:"free_above_amount" validate:"omitempty,gt=0"`
	MinDeliveryDays *int16            `json:"min_delivery_days" validate:"omitempty,min=0"`
	MaxDeliveryDays *int16            `json:"max_delivery_days" validate:"omitempty,min=0"`
	MaxWeightKg     *float64          `json:"max_weight_kg"     validate:"omitempty,gt=0"`
	IsActive        *bool             `json:"is_active"`
}


type ShippingZoneResponse struct {
	ID          int64                    `json:"id"`
	Name        string                   `json:"name"`
	Description *string                  `json:"description,omitempty"`
	RegionCodes []string                 `json:"region_codes"`
	IsActive    bool                     `json:"is_active"`
	Methods     []ShippingMethodResponse `json:"methods,omitempty"`
}

type ShippingMethodResponse struct {
	ID              int64            `json:"id"`
	Name            string           `json:"name"`
	Carrier         *string          `json:"carrier,omitempty"`
	Description     *string          `json:"description,omitempty"`
	RateType        ShippingRateType `json:"rate_type"`
	BaseRate        float64          `json:"base_rate"`
	FreeAboveAmount *float64         `json:"free_above_amount,omitempty"`
	MinDeliveryDays *int16           `json:"min_delivery_days,omitempty"`
	MaxDeliveryDays *int16           `json:"max_delivery_days,omitempty"`
	MaxWeightKg     *float64         `json:"max_weight_kg,omitempty"`
	IsActive        bool             `json:"is_active"`
	// Calculated at request time by the service based on order
	EstimatedCost float64 `json:"estimated_cost"`
}



type ShippingZoneFilter struct {
	BaseFilter
	IsActive *bool `query:"is_active"`
}

func (f *ShippingZoneFilter) Defaults() {
	f.BaseFilter.Defaults("created_at")
}

type ShippingMethodFilter struct {
	BaseFilter
	IsActive *bool             `query:"is_active"`
	RateType *ShippingRateType `query:"rate_type"`
}

func (f *ShippingMethodFilter) Defaults() {
	f.BaseFilter.Defaults("created_at")
}

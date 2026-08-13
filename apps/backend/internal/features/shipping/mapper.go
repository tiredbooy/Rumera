package shipping

func toShippingZoneResponse(z *ShippingZone) ShippingZoneResponse {
	return ShippingZoneResponse{
		ID:          z.ID,
		Name:        z.Name,
		Description: z.Description,
		RegionCodes: z.RegionCodes,
		IsActive:    z.IsActive,
	}
}

func toShippingZoneDetailResponse(detail *ShippingZoneDetail) ShippingZoneResponse {
	zone := toShippingZoneResponse(detail.Zone)
	zone.Methods = toShippingMethodResponses(detail.Methods)
	return zone
}

func toShippingMethodResponse(m *ShippingMethod) ShippingMethodResponse {
	return ShippingMethodResponse{
		ID:              m.ID,
		ShippingZoneID:  m.ShippingZoneID,
		Name:            m.Name,
		Carrier:         m.Carrier,
		Description:     m.Description,
		RateType:        m.RateType,
		BaseRate:        m.BaseRate,
		FreeAboveAmount: m.FreeAboveAmount,
		MinDeliveryDays: m.MinDeliveryDays,
		MaxDeliveryDays: m.MaxDeliveryDays,
		MaxWeightKg:     m.MaxWeightKg,
		IsActive:        m.IsActive,
	}
}

func toShippingMethodResponses(ms []*ShippingMethod) []ShippingMethodResponse {
	out := make([]ShippingMethodResponse, len(ms))
	for i, m := range ms {
		out[i] = toShippingMethodResponse(m)
	}
	return out
}

func toShippingMethodQuoteResponses(quotes []*ShippingMethodQuote) []ShippingMethodResponse {
	out := make([]ShippingMethodResponse, len(quotes))
	for i, quote := range quotes {
		out[i] = toShippingMethodResponse(quote.Method)
		out[i].EstimatedCost = quote.EstimatedCost
	}
	return out
}

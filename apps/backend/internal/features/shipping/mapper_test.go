package shipping

import "testing"

func TestToShippingZoneDetailResponseIncludesMethods(t *testing.T) {
	response := toShippingZoneDetailResponse(&ShippingZoneDetail{
		Zone: &ShippingZone{ID: 1, Name: "Tehran", RegionCodes: []string{"IR-TEH"}},
		Methods: []*ShippingMethod{{
			ID: 2, ShippingZoneID: 1, Name: "Standard", RateType: ShippingRateFlat, BaseRate: 12,
		}},
	})

	if len(response.Methods) != 1 || response.Methods[0].ID != 2 ||
		response.Methods[0].ShippingZoneID != 1 || response.Methods[0].EstimatedCost != 0 {
		t.Fatalf("detail response = %+v", response)
	}
}

func TestToShippingMethodQuoteResponsesMapsEstimatedCost(t *testing.T) {
	responses := toShippingMethodQuoteResponses([]*ShippingMethodQuote{{
		Method:        &ShippingMethod{ID: 3, ShippingZoneID: 1, Name: "Weight", RateType: ShippingRatePerKg, BaseRate: 2.5},
		EstimatedCost: 7.5,
	}})

	if len(responses) != 1 || responses[0].ShippingZoneID != 1 ||
		responses[0].EstimatedCost != 7.5 || responses[0].BaseRate != 2.5 {
		t.Fatalf("quote responses = %+v", responses)
	}
}

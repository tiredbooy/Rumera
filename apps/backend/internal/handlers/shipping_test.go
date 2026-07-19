package handlers

import (
	"testing"

	"github.com/tiredbooy/internal/models"
)

func TestToShippingZoneDetailResponseIncludesMethods(t *testing.T) {
	response := toShippingZoneDetailResponse(&models.ShippingZoneDetail{
		Zone: &models.ShippingZone{ID: 1, Name: "Tehran", RegionCodes: []string{"IR-TEH"}},
		Methods: []*models.ShippingMethod{{
			ID: 2, ShippingZoneID: 1, Name: "Standard", RateType: models.ShippingRateFlat, BaseRate: 12,
		}},
	})

	if len(response.Methods) != 1 || response.Methods[0].ID != 2 ||
		response.Methods[0].ShippingZoneID != 1 || response.Methods[0].EstimatedCost != 0 {
		t.Fatalf("detail response = %+v", response)
	}
}

func TestToShippingMethodQuoteResponsesMapsEstimatedCost(t *testing.T) {
	responses := toShippingMethodQuoteResponses([]*models.ShippingMethodQuote{{
		Method:        &models.ShippingMethod{ID: 3, ShippingZoneID: 1, Name: "Weight", RateType: models.ShippingRatePerKg, BaseRate: 2.5},
		EstimatedCost: 7.5,
	}})

	if len(responses) != 1 || responses[0].ShippingZoneID != 1 ||
		responses[0].EstimatedCost != 7.5 || responses[0].BaseRate != 2.5 {
		t.Fatalf("quote responses = %+v", responses)
	}
}

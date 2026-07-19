//go:build integration

package integration

import (
	"context"
	"errors"
	"testing"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
)

func integrationBool(value bool) *bool        { return &value }
func integrationFloat(value float64) *float64 { return &value }
func integrationInt16(value int16) *int16     { return &value }

func TestShippingRepositories_CRUDPaginationAndNullableRules(t *testing.T) {
	requireDB(t)
	resetTables(t, "shipping_zones")
	ctx := context.Background()
	zoneRepo := repositories.NewShippingZoneRepository(testPool)
	methodRepo := repositories.NewShippingMethodRepository(testPool)

	description := "Tehran deliveries"
	zone, err := zoneRepo.Create(ctx, models.CreateShippingZoneReq{
		Name:        "Tehran",
		Description: &description,
		RegionCodes: []string{"IR-TEH"},
		IsActive:    integrationBool(true),
	})
	if err != nil {
		t.Fatalf("create zone: %v", err)
	}
	if _, err := zoneRepo.Create(ctx, models.CreateShippingZoneReq{
		Name: "Europe", RegionCodes: []string{"DE"}, IsActive: integrationBool(false),
	}); err != nil {
		t.Fatalf("create second zone: %v", err)
	}

	zones, total, err := zoneRepo.GetAll(ctx, models.ShippingZoneFilter{BaseFilter: models.BaseFilter{
		PaginationParams: models.PaginationParams{Page: 99, Limit: 1},
		SortBy:           "name",
		OrderBy:          "asc",
	}})
	if err != nil {
		t.Fatalf("list zones: %v", err)
	}
	if len(zones) != 0 || total != 2 {
		t.Fatalf("out-of-range zones = %d, total = %d; want 0, 2", len(zones), total)
	}

	matched, err := zoneRepo.GetByRegionCode(ctx, "IR-TEH")
	if err != nil || len(matched) != 1 || matched[0].ID != zone.ID {
		t.Fatalf("region lookup = %+v, %v", matched, err)
	}

	regions := []string{"IR-TEH", "IR-ALB"}
	updatedZone, err := zoneRepo.Update(ctx, zone.ID, models.UpdateShippingZoneReq{
		Description: models.NullablePatch[string]{Set: true},
		RegionCodes: models.NullablePatch[[]string]{Set: true, Value: &regions},
	})
	if err != nil {
		t.Fatalf("update zone: %v", err)
	}
	if updatedZone.Description != nil || len(updatedZone.RegionCodes) != 2 {
		t.Fatalf("updated zone = %+v", updatedZone)
	}

	carrier := "Post"
	methodDescription := "Ground"
	method, err := methodRepo.Create(ctx, zone.ID, models.CreateShippingMethodReq{
		Name:            "Standard",
		Carrier:         &carrier,
		Description:     &methodDescription,
		RateType:        models.ShippingRatePerKg,
		BaseRate:        2.5,
		FreeAboveAmount: integrationFloat(100),
		MinDeliveryDays: integrationInt16(2),
		MaxDeliveryDays: integrationInt16(5),
		MaxWeightKg:     integrationFloat(10),
	})
	if err != nil {
		t.Fatalf("create method: %v", err)
	}

	methods, methodTotal, err := methodRepo.GetByZoneID(ctx, zone.ID, models.ShippingMethodFilter{BaseFilter: models.BaseFilter{
		PaginationParams: models.PaginationParams{Page: 2, Limit: 1},
		SortBy:           "base_rate",
		OrderBy:          "asc",
	}})
	if err != nil {
		t.Fatalf("list methods: %v", err)
	}
	if len(methods) != 0 || methodTotal != 1 {
		t.Fatalf("out-of-range methods = %d, total = %d; want 0, 1", len(methods), methodTotal)
	}

	updatedMethod, err := methodRepo.Update(ctx, method.ID, models.UpdateShippingMethodReq{
		Carrier:         models.NullablePatch[string]{Set: true},
		Description:     models.NullablePatch[string]{Set: true},
		FreeAboveAmount: models.NullablePatch[float64]{Set: true},
		MinDeliveryDays: models.NullablePatch[int16]{Set: true},
		MaxDeliveryDays: models.NullablePatch[int16]{Set: true},
		MaxWeightKg:     models.NullablePatch[float64]{Set: true},
	})
	if err != nil {
		t.Fatalf("clear method rules: %v", err)
	}
	if updatedMethod.Carrier != nil || updatedMethod.Description != nil ||
		updatedMethod.FreeAboveAmount != nil || updatedMethod.MinDeliveryDays != nil ||
		updatedMethod.MaxDeliveryDays != nil || updatedMethod.MaxWeightKg != nil {
		t.Fatalf("nullable method rules were not cleared: %+v", updatedMethod)
	}

	available, err := methodRepo.GetAvailable(ctx, zone.ID, 500)
	if err != nil || len(available) != 1 || available[0].ID != method.ID {
		t.Fatalf("available methods = %+v, %v", available, err)
	}

	if _, err := methodRepo.Create(ctx, 999_999, models.CreateShippingMethodReq{
		Name: "Missing zone", RateType: models.ShippingRateFlat,
	}); !errors.Is(err, models.ErrNotFound) {
		t.Fatalf("missing-zone create error = %v; want ErrNotFound", err)
	}

	if err := zoneRepo.Delete(ctx, zone.ID); err != nil {
		t.Fatalf("delete zone: %v", err)
	}
	if _, err := methodRepo.GetByID(ctx, method.ID); !errors.Is(err, models.ErrNotFound) {
		t.Fatalf("cascaded method lookup error = %v; want ErrNotFound", err)
	}
}

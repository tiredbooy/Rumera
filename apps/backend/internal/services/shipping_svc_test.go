package services

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
)

type shippingZoneRepoStub struct {
	repositories.ShippingZoneRepository
	zone            *models.ShippingZone
	getErr          error
	createdReq      models.CreateShippingZoneReq
	updatedReq      models.UpdateShippingZoneReq
	regions         []*models.ShippingZone
	requestedRegion string
}

func (r *shippingZoneRepoStub) Create(_ context.Context, req models.CreateShippingZoneReq) (*models.ShippingZone, error) {
	r.createdReq = req
	return &models.ShippingZone{
		ID:          1,
		Name:        req.Name,
		Description: req.Description,
		RegionCodes: req.RegionCodes,
		IsActive:    true,
	}, nil
}

func (r *shippingZoneRepoStub) GetByID(context.Context, int64) (*models.ShippingZone, error) {
	if r.getErr != nil {
		return nil, r.getErr
	}
	return r.zone, nil
}

func (r *shippingZoneRepoStub) Update(_ context.Context, _ int64, req models.UpdateShippingZoneReq) (*models.ShippingZone, error) {
	r.updatedReq = req
	return r.zone, nil
}

func (r *shippingZoneRepoStub) GetByRegionCode(_ context.Context, region string) ([]*models.ShippingZone, error) {
	r.requestedRegion = region
	return r.regions, nil
}

type shippingMethodRepoStub struct {
	repositories.ShippingMethodRepository
	method          *models.ShippingMethod
	createdReq      models.CreateShippingMethodReq
	updatedReq      models.UpdateShippingMethodReq
	updateCalls     int
	listFn          func(models.ShippingMethodFilter) ([]*models.ShippingMethod, int64, error)
	availableByZone map[int64][]*models.ShippingMethod
}

func (r *shippingMethodRepoStub) Create(_ context.Context, zoneID int64, req models.CreateShippingMethodReq) (*models.ShippingMethod, error) {
	r.createdReq = req
	return &models.ShippingMethod{ID: 1, ShippingZoneID: zoneID, Name: req.Name, RateType: req.RateType, BaseRate: req.BaseRate}, nil
}

func (r *shippingMethodRepoStub) GetByID(context.Context, int64) (*models.ShippingMethod, error) {
	if r.method == nil {
		return nil, models.ErrNotFound
	}
	return r.method, nil
}

func (r *shippingMethodRepoStub) GetByZoneID(_ context.Context, _ int64, filter models.ShippingMethodFilter) ([]*models.ShippingMethod, int64, error) {
	if r.listFn == nil {
		return []*models.ShippingMethod{}, 0, nil
	}
	return r.listFn(filter)
}

func (r *shippingMethodRepoStub) GetAvailable(_ context.Context, zoneID int64, _ float64) ([]*models.ShippingMethod, error) {
	return r.availableByZone[zoneID], nil
}

func (r *shippingMethodRepoStub) Update(_ context.Context, _ int64, req models.UpdateShippingMethodReq) (*models.ShippingMethod, error) {
	r.updateCalls++
	r.updatedReq = req
	return r.method, nil
}

func shippingFloat(value float64) *float64 { return &value }
func shippingInt16(value int16) *int16     { return &value }

func TestShippingService_CreateZoneNormalizesInput(t *testing.T) {
	description := "   "
	zones := &shippingZoneRepoStub{}
	service := NewShippingService(zones, &shippingMethodRepoStub{})

	created, err := service.CreateZone(context.Background(), models.CreateShippingZoneReq{
		Name:        "  Tehran  ",
		Description: &description,
		RegionCodes: []string{" ir-teh ", "IR-TEH", " de "},
	})
	if err != nil {
		t.Fatalf("create zone: %v", err)
	}
	if created.Name != "Tehran" || zones.createdReq.Description != nil {
		t.Fatalf("normalized create = %+v, request = %+v", created, zones.createdReq)
	}
	want := []string{"IR-TEH", "DE"}
	if len(created.RegionCodes) != len(want) || created.RegionCodes[0] != want[0] || created.RegionCodes[1] != want[1] {
		t.Fatalf("regions = %v; want %v", created.RegionCodes, want)
	}
}

func TestShippingService_UpdateZoneRejectsNullRequiredFields(t *testing.T) {
	var req models.UpdateShippingZoneReq
	if err := json.Unmarshal([]byte(`{"name":null,"description":null}`), &req); err != nil {
		t.Fatalf("decode update: %v", err)
	}
	if !req.Name.Set || req.Name.Value != nil || !req.Description.Set || req.Description.Value != nil {
		t.Fatalf("patch did not preserve omission/null semantics: %+v", req)
	}

	_, err := NewShippingService(&shippingZoneRepoStub{}, &shippingMethodRepoStub{}).
		UpdateZone(context.Background(), 1, req)
	if !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("error = %v; want ErrInvalidRequest", err)
	}
}

func TestShippingService_CreateMethodValidatesRuleCombinations(t *testing.T) {
	zone := &shippingZoneRepoStub{zone: &models.ShippingZone{ID: 1}}
	service := NewShippingService(zone, &shippingMethodRepoStub{})
	cases := []struct {
		name string
		req  models.CreateShippingMethodReq
	}{
		{
			name: "percentage above one hundred",
			req:  models.CreateShippingMethodReq{Name: "Percent", RateType: models.ShippingRatePercentage, BaseRate: 100.01},
		},
		{
			name: "free method with a charge",
			req:  models.CreateShippingMethodReq{Name: "Free", RateType: models.ShippingRateFree, BaseRate: 1},
		},
		{
			name: "database money scale",
			req:  models.CreateShippingMethodReq{Name: "Precise", RateType: models.ShippingRateFlat, BaseRate: 1.001},
		},
		{
			name: "delivery range",
			req: models.CreateShippingMethodReq{
				Name: "Backward", RateType: models.ShippingRateFlat,
				MinDeliveryDays: shippingInt16(5), MaxDeliveryDays: shippingInt16(2),
			},
		},
	}

	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			if _, err := service.CreateMethod(context.Background(), 1, test.req); !errors.Is(err, apperr.ErrInvalidRequest) {
				t.Fatalf("error = %v; want ErrInvalidRequest", err)
			}
		})
	}
}

func TestShippingService_UpdateMethodValidatesMergedRulesAndClearsNullableFields(t *testing.T) {
	current := &models.ShippingMethod{
		ID:              5,
		RateType:        models.ShippingRateFlat,
		BaseRate:        12,
		FreeAboveAmount: shippingFloat(100),
		MinDeliveryDays: shippingInt16(3),
		MaxDeliveryDays: shippingInt16(5),
	}
	repo := &shippingMethodRepoStub{method: current}
	service := NewShippingService(&shippingZoneRepoStub{}, repo)

	var invalid models.UpdateShippingMethodReq
	if err := json.Unmarshal([]byte(`{"max_delivery_days":2}`), &invalid); err != nil {
		t.Fatalf("decode invalid update: %v", err)
	}
	if _, err := service.UpdateMethod(context.Background(), current.ID, invalid); !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("error = %v; want ErrInvalidRequest", err)
	}
	if repo.updateCalls != 0 {
		t.Fatalf("invalid update reached repository %d times", repo.updateCalls)
	}

	var clear models.UpdateShippingMethodReq
	if err := json.Unmarshal([]byte(`{"carrier":null,"free_above_amount":null,"min_delivery_days":null,"max_delivery_days":null}`), &clear); err != nil {
		t.Fatalf("decode clear update: %v", err)
	}
	if _, err := service.UpdateMethod(context.Background(), current.ID, clear); err != nil {
		t.Fatalf("clear nullable method fields: %v", err)
	}
	if repo.updateCalls != 1 || repo.updatedReq.Carrier.Value != nil || repo.updatedReq.FreeAboveAmount.Value != nil {
		t.Fatalf("clear patch = %+v; calls = %d", repo.updatedReq, repo.updateCalls)
	}
}

func TestShippingService_GetZoneDetailLoadsEveryMethodPage(t *testing.T) {
	zones := &shippingZoneRepoStub{zone: &models.ShippingZone{ID: 7}}
	calls := 0
	methods := &shippingMethodRepoStub{listFn: func(filter models.ShippingMethodFilter) ([]*models.ShippingMethod, int64, error) {
		calls++
		if filter.Page == 1 {
			page := make([]*models.ShippingMethod, 100)
			for i := range page {
				page[i] = &models.ShippingMethod{ID: int64(i + 1)}
			}
			return page, 101, nil
		}
		return []*models.ShippingMethod{{ID: 101}}, 101, nil
	}}

	detail, err := NewShippingService(zones, methods).GetZoneDetail(context.Background(), 7)
	if err != nil {
		t.Fatalf("get detail: %v", err)
	}
	if calls != 2 || len(detail.Methods) != 101 || detail.Methods[100].ID != 101 {
		t.Fatalf("calls = %d, methods = %d, last = %+v", calls, len(detail.Methods), detail.Methods[100])
	}
}

func TestShippingService_GetAvailableCalculatesAndOrdersQuotes(t *testing.T) {
	zones := &shippingZoneRepoStub{regions: []*models.ShippingZone{{ID: 2}}}
	methods := &shippingMethodRepoStub{availableByZone: map[int64][]*models.ShippingMethod{
		2: {
			{ID: 1, Name: "Weight", RateType: models.ShippingRatePerKg, BaseRate: 2.5},
			{ID: 2, Name: "Percent", RateType: models.ShippingRatePercentage, BaseRate: 5},
			{ID: 3, Name: "Threshold", RateType: models.ShippingRateFlat, BaseRate: 12, FreeAboveAmount: shippingFloat(100)},
			{ID: 4, Name: "Free", RateType: models.ShippingRateFree},
		},
	}}

	quotes, err := NewShippingService(zones, methods).
		GetAvailableForCheckout(context.Background(), " ir-teh ", 3, 120)
	if err != nil {
		t.Fatalf("get quotes: %v", err)
	}
	if zones.requestedRegion != "IR-TEH" {
		t.Fatalf("region = %q; want IR-TEH", zones.requestedRegion)
	}
	want := []float64{0, 0, 6, 7.5}
	if len(quotes) != len(want) {
		t.Fatalf("quotes = %d; want %d", len(quotes), len(want))
	}
	for i := range want {
		if quotes[i].EstimatedCost != want[i] {
			t.Fatalf("quote %d cost = %v; want %v", i, quotes[i].EstimatedCost, want[i])
		}
	}
}

func TestShippingService_GetMethodsRejectsUnknownRateType(t *testing.T) {
	unknown := models.ShippingRateType("mystery")
	filter := models.ShippingMethodFilter{
		BaseFilter: models.BaseFilter{PaginationParams: models.PaginationParams{Page: 1, Limit: 20}},
		RateType:   &unknown,
	}

	_, _, err := NewShippingService(&shippingZoneRepoStub{}, &shippingMethodRepoStub{}).
		GetMethodsByZoneID(context.Background(), 1, filter)
	if !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("error = %v; want ErrInvalidRequest", err)
	}
}

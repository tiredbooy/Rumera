package shipping

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

type shippingZoneRepoStub struct {
	ZoneRepository
	zone            *ShippingZone
	getErr          error
	createdReq      CreateShippingZoneReq
	updatedReq      UpdateShippingZoneReq
	regions         []*ShippingZone
	requestedRegion string
}

func (r *shippingZoneRepoStub) Create(_ context.Context, req CreateShippingZoneReq) (*ShippingZone, error) {
	r.createdReq = req
	return &ShippingZone{
		ID:          1,
		Name:        req.Name,
		Description: req.Description,
		RegionCodes: req.RegionCodes,
		IsActive:    true,
	}, nil
}

func (r *shippingZoneRepoStub) GetByID(context.Context, int64) (*ShippingZone, error) {
	if r.getErr != nil {
		return nil, r.getErr
	}
	return r.zone, nil
}

func (r *shippingZoneRepoStub) Update(_ context.Context, _ int64, req UpdateShippingZoneReq) (*ShippingZone, error) {
	r.updatedReq = req
	return r.zone, nil
}

func (r *shippingZoneRepoStub) GetByRegionCode(_ context.Context, region string) ([]*ShippingZone, error) {
	r.requestedRegion = region
	return r.regions, nil
}

type shippingMethodRepoStub struct {
	MethodRepository
	method          *ShippingMethod
	createdReq      CreateShippingMethodReq
	updatedReq      UpdateShippingMethodReq
	updateCalls     int
	listFn          func(ShippingMethodFilter) ([]*ShippingMethod, int64, error)
	availableByZone map[int64][]*ShippingMethod
}

func (r *shippingMethodRepoStub) Create(_ context.Context, zoneID int64, req CreateShippingMethodReq) (*ShippingMethod, error) {
	r.createdReq = req
	return &ShippingMethod{ID: 1, ShippingZoneID: zoneID, Name: req.Name, RateType: req.RateType, BaseRate: req.BaseRate}, nil
}

func (r *shippingMethodRepoStub) GetByID(context.Context, int64) (*ShippingMethod, error) {
	if r.method == nil {
		return nil, models.ErrNotFound
	}
	return r.method, nil
}

func (r *shippingMethodRepoStub) GetByZoneID(_ context.Context, _ int64, filter ShippingMethodFilter) ([]*ShippingMethod, int64, error) {
	if r.listFn == nil {
		return []*ShippingMethod{}, 0, nil
	}
	return r.listFn(filter)
}

func (r *shippingMethodRepoStub) GetAvailable(_ context.Context, zoneID int64, _ float64) ([]*ShippingMethod, error) {
	return r.availableByZone[zoneID], nil
}

func (r *shippingMethodRepoStub) Update(_ context.Context, _ int64, req UpdateShippingMethodReq) (*ShippingMethod, error) {
	r.updateCalls++
	r.updatedReq = req
	return r.method, nil
}

func shippingFloat(value float64) *float64 { return &value }
func shippingInt16(value int16) *int16     { return &value }

func TestService_CreateZoneNormalizesInput(t *testing.T) {
	description := "   "
	zones := &shippingZoneRepoStub{}
	service := NewService(zones, &shippingMethodRepoStub{})

	created, err := service.CreateZone(context.Background(), CreateShippingZoneReq{
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

func TestService_UpdateZoneRejectsNullRequiredFields(t *testing.T) {
	var req UpdateShippingZoneReq
	if err := json.Unmarshal([]byte(`{"name":null,"description":null}`), &req); err != nil {
		t.Fatalf("decode update: %v", err)
	}
	if !req.Name.Set || req.Name.Value != nil || !req.Description.Set || req.Description.Value != nil {
		t.Fatalf("patch did not preserve omission/null semantics: %+v", req)
	}

	_, err := NewService(&shippingZoneRepoStub{}, &shippingMethodRepoStub{}).
		UpdateZone(context.Background(), 1, req)
	if !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("error = %v; want ErrInvalidRequest", err)
	}
}

func TestService_CreateMethodValidatesRuleCombinations(t *testing.T) {
	zone := &shippingZoneRepoStub{zone: &ShippingZone{ID: 1}}
	service := NewService(zone, &shippingMethodRepoStub{})
	cases := []struct {
		name string
		req  CreateShippingMethodReq
	}{
		{
			name: "percentage above one hundred",
			req:  CreateShippingMethodReq{Name: "Percent", RateType: ShippingRatePercentage, BaseRate: 100.01},
		},
		{
			name: "free method with a charge",
			req:  CreateShippingMethodReq{Name: "Free", RateType: ShippingRateFree, BaseRate: 1},
		},
		{
			name: "database money scale",
			req:  CreateShippingMethodReq{Name: "Precise", RateType: ShippingRateFlat, BaseRate: 1.001},
		},
		{
			name: "delivery range",
			req: CreateShippingMethodReq{
				Name: "Backward", RateType: ShippingRateFlat,
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

func TestService_UpdateMethodValidatesMergedRulesAndClearsNullableFields(t *testing.T) {
	current := &ShippingMethod{
		ID:              5,
		RateType:        ShippingRateFlat,
		BaseRate:        12,
		FreeAboveAmount: shippingFloat(100),
		MinDeliveryDays: shippingInt16(3),
		MaxDeliveryDays: shippingInt16(5),
	}
	repo := &shippingMethodRepoStub{method: current}
	service := NewService(&shippingZoneRepoStub{}, repo)

	var invalid UpdateShippingMethodReq
	if err := json.Unmarshal([]byte(`{"max_delivery_days":2}`), &invalid); err != nil {
		t.Fatalf("decode invalid update: %v", err)
	}
	if _, err := service.UpdateMethod(context.Background(), current.ID, invalid); !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("error = %v; want ErrInvalidRequest", err)
	}
	if repo.updateCalls != 0 {
		t.Fatalf("invalid update reached repository %d times", repo.updateCalls)
	}

	var clear UpdateShippingMethodReq
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

func TestService_GetZoneDetailLoadsEveryMethodPage(t *testing.T) {
	zones := &shippingZoneRepoStub{zone: &ShippingZone{ID: 7}}
	calls := 0
	methods := &shippingMethodRepoStub{listFn: func(filter ShippingMethodFilter) ([]*ShippingMethod, int64, error) {
		calls++
		if filter.Page == 1 {
			page := make([]*ShippingMethod, 100)
			for i := range page {
				page[i] = &ShippingMethod{ID: int64(i + 1)}
			}
			return page, 101, nil
		}
		return []*ShippingMethod{{ID: 101}}, 101, nil
	}}

	detail, err := NewService(zones, methods).GetZoneDetail(context.Background(), 7)
	if err != nil {
		t.Fatalf("get detail: %v", err)
	}
	if calls != 2 || len(detail.Methods) != 101 || detail.Methods[100].ID != 101 {
		t.Fatalf("calls = %d, methods = %d, last = %+v", calls, len(detail.Methods), detail.Methods[100])
	}
}

func TestService_GetAvailableCalculatesAndOrdersQuotes(t *testing.T) {
	zones := &shippingZoneRepoStub{regions: []*ShippingZone{{ID: 2}}}
	methods := &shippingMethodRepoStub{availableByZone: map[int64][]*ShippingMethod{
		2: {
			{ID: 1, Name: "Weight", RateType: ShippingRatePerKg, BaseRate: 2.5},
			{ID: 2, Name: "Percent", RateType: ShippingRatePercentage, BaseRate: 5},
			{ID: 3, Name: "Threshold", RateType: ShippingRateFlat, BaseRate: 12, FreeAboveAmount: shippingFloat(100)},
			{ID: 4, Name: "Free", RateType: ShippingRateFree},
		},
	}}

	quotes, err := NewService(zones, methods).
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

func TestService_GetMethodsRejectsUnknownRateType(t *testing.T) {
	unknown := ShippingRateType("mystery")
	filter := ShippingMethodFilter{
		BaseFilter: models.BaseFilter{PaginationParams: models.PaginationParams{Page: 1, Limit: 20}},
		RateType:   &unknown,
	}

	_, _, err := NewService(&shippingZoneRepoStub{}, &shippingMethodRepoStub{}).
		GetMethodsByZoneID(context.Background(), 1, filter)
	if !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("error = %v; want ErrInvalidRequest", err)
	}
}

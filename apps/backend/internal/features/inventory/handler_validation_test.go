package inventory

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/platform/httpx"
	"github.com/tiredbooy/pkg/apperr"
	"github.com/tiredbooy/pkg/response"
	appvalidator "github.com/tiredbooy/pkg/validator"
)

type handlerServiceStub struct {
	Service
	lastInventoryFilter InventoryFilter
	lastMovementFilter  MovementFilter
	getByVariantErr     error
}

func (s *handlerServiceStub) GetAll(_ context.Context, filter InventoryFilter) ([]*Inventory, int64, error) {
	s.lastInventoryFilter = filter
	return []*Inventory{}, 0, nil
}

func (s *handlerServiceStub) GetByVariantID(_ context.Context, _ int64) (*Inventory, error) {
	if s.getByVariantErr != nil {
		return nil, s.getByVariantErr
	}
	return &Inventory{ProductVariantID: 14}, nil
}

func (s *handlerServiceStub) GetMovements(_ context.Context, filter MovementFilter) ([]*InventoryMovement, int64, error) {
	s.lastMovementFilter = filter
	return []*InventoryMovement{}, 0, nil
}

func TestBindQueryRunsMovementValidationTags(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewHandler(nil, appvalidator.New())

	for _, query := range []string{
		"product_variant_id=0",
		"order_id=-1",
		"type=unknown",
		"page=0",
		"limit=101",
		"orderBy=sideways",
	} {
		t.Run(query, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest("GET", "/?"+query, nil)
			var filter MovementFilter

			if httpx.BindQuery(ctx, h.Validator, &filter) {
				t.Fatal("bindQuery accepted an invalid movement filter")
			}
			if recorder.Code != 400 || !strings.Contains(recorder.Body.String(), `"code":"INVALID_QUERY"`) {
				t.Fatalf("response = %d %s; want 400 INVALID_QUERY", recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestBindQueryRunsInventoryValidationTags(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewHandler(nil, appvalidator.New())

	for _, query := range []string{
		"page=0",
		"limit=101",
		"orderBy=sideways",
	} {
		t.Run(query, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest("GET", "/?"+query, nil)
			var filter InventoryFilter

			if httpx.BindQuery(ctx, h.Validator, &filter) {
				t.Fatal("bindQuery accepted an invalid inventory filter")
			}
			if recorder.Code != 400 || !strings.Contains(recorder.Body.String(), `"code":"INVALID_QUERY"`) {
				t.Fatalf("response = %d %s; want 400 INVALID_QUERY", recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestInventoryHandlersRejectUnsupportedSortFields(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewHandler(nil, appvalidator.New())

	for name, handler := range map[string]func(*gin.Context){
		"inventory":         h.List,
		"low-stock":         h.LowStock,
		"movements":         h.ListMovements,
		"variant-movements": h.VariantMovements,
	} {
		t.Run(name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Params = gin.Params{{Key: "variantID", Value: "14"}}
			ctx.Request = httptest.NewRequest("GET", "/?sortBy=unsupported", nil)

			handler(ctx)

			if recorder.Code != 400 || !strings.Contains(recorder.Body.String(), `"code":"INVALID_QUERY"`) {
				t.Fatalf("response = %d %s; want 400 INVALID_QUERY", recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestLowStockBindsPaginationAndAppliesDefaults(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("defaults", func(t *testing.T) {
		svc := &handlerServiceStub{}
		h := NewHandler(svc, appvalidator.New())
		recorder := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(recorder)
		ctx.Request = httptest.NewRequest(http.MethodGet, "/admin/inventory/low-stock", nil)

		h.LowStock(ctx)

		if recorder.Code != http.StatusOK {
			t.Fatalf("status = %d body=%s", recorder.Code, recorder.Body.String())
		}
		var body response.PaginatedResponse[InventoryResponse]
		if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		if body.Results == nil {
			t.Fatal("results is null; want empty array")
		}
		p := body.Pagination
		if p.Page != 1 || p.Limit != 20 || p.TotalItems != 0 || p.TotalPages != 1 || p.HasNext || p.HasPrev {
			t.Fatalf("pagination = %+v", p)
		}
		got := svc.lastInventoryFilter
		if !got.LowStock || got.Page != 1 || got.Limit != 20 || got.SortBy != "available_stock" || got.OrderBy != "asc" {
			t.Fatalf("filter = %+v", got)
		}
	})

	t.Run("explicit page and limit", func(t *testing.T) {
		svc := &handlerServiceStub{}
		h := NewHandler(svc, appvalidator.New())
		recorder := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(recorder)
		ctx.Request = httptest.NewRequest(http.MethodGet, "/admin/inventory/low-stock?page=3&limit=50&sortBy=sku&orderBy=desc", nil)

		h.LowStock(ctx)

		if recorder.Code != http.StatusOK {
			t.Fatalf("status = %d body=%s", recorder.Code, recorder.Body.String())
		}
		var body response.PaginatedResponse[InventoryResponse]
		if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		if body.Pagination.Page != 3 || body.Pagination.Limit != 50 {
			t.Fatalf("pagination = %+v", body.Pagination)
		}
		got := svc.lastInventoryFilter
		if !got.LowStock || got.Page != 3 || got.Limit != 50 || got.SortBy != "sku" || got.OrderBy != "desc" {
			t.Fatalf("filter = %+v", got)
		}
	})

	for _, query := range []string{"page=0", "limit=101", "limit=0", "orderBy=sideways"} {
		t.Run("reject "+query, func(t *testing.T) {
			h := NewHandler(&handlerServiceStub{}, appvalidator.New())
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodGet, "/admin/inventory/low-stock?"+query, nil)

			h.LowStock(ctx)

			if recorder.Code != 400 || !strings.Contains(recorder.Body.String(), `"code":"INVALID_QUERY"`) {
				t.Fatalf("response = %d %s; want 400 INVALID_QUERY", recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestVariantMovementsBindsPaginationAndAppliesDefaults(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("defaults", func(t *testing.T) {
		svc := &handlerServiceStub{}
		h := NewHandler(svc, appvalidator.New())
		recorder := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(recorder)
		ctx.Params = gin.Params{{Key: "variantID", Value: "14"}}
		ctx.Request = httptest.NewRequest(http.MethodGet, "/admin/inventory/variants/14/movements", nil)

		h.VariantMovements(ctx)

		if recorder.Code != http.StatusOK {
			t.Fatalf("status = %d body=%s", recorder.Code, recorder.Body.String())
		}
		var body response.PaginatedResponse[InventoryMovementResponse]
		if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		if body.Results == nil {
			t.Fatal("results is null; want empty array")
		}
		p := body.Pagination
		if p.Page != 1 || p.Limit != 20 || p.TotalItems != 0 || p.TotalPages != 1 || p.HasNext || p.HasPrev {
			t.Fatalf("pagination = %+v", p)
		}
		got := svc.lastMovementFilter
		if got.ProductVariantID == nil || *got.ProductVariantID != 14 || got.Page != 1 || got.Limit != 20 || got.SortBy != "created_at" || got.OrderBy != "desc" {
			t.Fatalf("filter = %+v", got)
		}
	})

	t.Run("explicit page and limit", func(t *testing.T) {
		svc := &handlerServiceStub{}
		h := NewHandler(svc, appvalidator.New())
		recorder := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(recorder)
		ctx.Params = gin.Params{{Key: "variantID", Value: "14"}}
		ctx.Request = httptest.NewRequest(http.MethodGet, "/admin/inventory/variants/14/movements?page=2&limit=12", nil)

		h.VariantMovements(ctx)

		if recorder.Code != http.StatusOK {
			t.Fatalf("status = %d body=%s", recorder.Code, recorder.Body.String())
		}
		var body response.PaginatedResponse[InventoryMovementResponse]
		if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		if body.Pagination.Page != 2 || body.Pagination.Limit != 12 {
			t.Fatalf("pagination = %+v", body.Pagination)
		}
		got := svc.lastMovementFilter
		if got.ProductVariantID == nil || *got.ProductVariantID != 14 || got.Page != 2 || got.Limit != 12 {
			t.Fatalf("filter = %+v", got)
		}
	})

	t.Run("missing variant", func(t *testing.T) {
		svc := &handlerServiceStub{getByVariantErr: apperr.ErrNotFound}
		h := NewHandler(svc, appvalidator.New())
		recorder := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(recorder)
		ctx.Params = gin.Params{{Key: "variantID", Value: "99"}}
		ctx.Request = httptest.NewRequest(http.MethodGet, "/admin/inventory/variants/99/movements", nil)

		h.VariantMovements(ctx)

		if recorder.Code != http.StatusNotFound {
			t.Fatalf("status = %d body=%s; want 404", recorder.Code, recorder.Body.String())
		}
		if svc.lastMovementFilter.ProductVariantID != nil {
			t.Fatal("GetMovements ran after a missing variant")
		}
	})

	for _, query := range []string{"page=0", "limit=101", "limit=0", "orderBy=sideways"} {
		t.Run("reject "+query, func(t *testing.T) {
			h := NewHandler(&handlerServiceStub{}, appvalidator.New())
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Params = gin.Params{{Key: "variantID", Value: "14"}}
			ctx.Request = httptest.NewRequest(http.MethodGet, "/admin/inventory/variants/14/movements?"+query, nil)

			h.VariantMovements(ctx)

			if recorder.Code != 400 || !strings.Contains(recorder.Body.String(), `"code":"INVALID_QUERY"`) {
				t.Fatalf("response = %d %s; want 400 INVALID_QUERY", recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestBindJSONRejectsReorderIntegerOverflow(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewHandler(nil, appvalidator.New())
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(
		"PATCH",
		"/",
		strings.NewReader(`{"reorder_point":2147483648}`),
	)
	ctx.Request.Header.Set("Content-Type", "application/json")
	var request UpdateReorderReq

	if httpx.BindJSON(ctx, h.Validator, &request) {
		t.Fatal("bindJSON accepted reorder_point outside the database integer range")
	}
	if recorder.Code != 422 || !strings.Contains(recorder.Body.String(), `"code":"VALIDATION_ERROR"`) {
		t.Fatalf("response = %d %s; want 422 VALIDATION_ERROR", recorder.Code, recorder.Body.String())
	}
}

func TestBindJSONRejectsOrderOwnedMovementAsDirectAdjustment(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewHandler(nil, appvalidator.New())
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(
		"POST",
		"/",
		strings.NewReader(`{"quantity":1,"type":"release"}`),
	)
	ctx.Request.Header.Set("Content-Type", "application/json")
	var request AdjustStockReq

	if httpx.BindJSON(ctx, h.Validator, &request) {
		t.Fatal("bindJSON accepted an order-owned movement as a direct adjustment")
	}
	if recorder.Code != 422 || !strings.Contains(recorder.Body.String(), `"code":"VALIDATION_ERROR"`) {
		t.Fatalf("response = %d %s; want 422 VALIDATION_ERROR", recorder.Code, recorder.Body.String())
	}
}

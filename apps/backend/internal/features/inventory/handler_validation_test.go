package inventory

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/platform/httpx"
	appvalidator "github.com/tiredbooy/pkg/validator"
)

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

func TestInventoryHandlersRejectUnsupportedSortFields(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewHandler(nil, appvalidator.New())

	for name, handler := range map[string]func(*gin.Context){
		"inventory": h.List,
		"movements": h.ListMovements,
	} {
		t.Run(name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest("GET", "/?sortBy=unsupported", nil)

			handler(ctx)

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

package product

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/middlewares"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/validator"
	"go.uber.org/zap"
)

type listRepo struct {
	Repository
	items  []*models.ProductListItem
	total  int64
	err    error
	filter ProductFilter
}

func (r *listRepo) GetAll(_ context.Context, filter ProductFilter) ([]*models.ProductListItem, int64, error) {
	r.filter = filter
	return r.items, r.total, r.err
}

func listContext(t *testing.T, rawURL string) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, rawURL, nil)
	return c, w
}

func TestListProductsRecordsSearchAnalytics(t *testing.T) {
	repo := &listRepo{
		items: []*models.ProductListItem{{ID: 1, Title: "Malt"}},
		total: 3,
	}
	h := NewHandler(NewService(repo, nil, nil), validator.New(), nil, zap.NewNop())
	c, w := listContext(t, "/api/v1/products?search=whisky")

	h.ListProducts(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d body = %s", w.Code, w.Body.String())
	}
	raw, ok := c.Get(middlewares.AnalyticsPayloadKey)
	if !ok {
		t.Fatal("expected analytics payload on successful search")
	}
	payload, ok := raw.(map[string]any)
	if !ok {
		t.Fatalf("payload type = %T", raw)
	}
	if payload["query"] != "whisky" {
		t.Fatalf("query = %#v", payload["query"])
	}
	n, ok := payload["results_count"].(int64)
	if !ok || n != 3 {
		t.Fatalf("results_count = %#v, want int64(3)", payload["results_count"])
	}
	if repo.filter.Search != "whisky" {
		t.Fatalf("repo search = %q", repo.filter.Search)
	}
}

func TestListProductsZeroHitsStillRecordsSearch(t *testing.T) {
	repo := &listRepo{items: []*models.ProductListItem{}, total: 0}
	h := NewHandler(NewService(repo, nil, nil), validator.New(), nil, zap.NewNop())
	c, w := listContext(t, "/api/v1/products?search=nope")

	h.ListProducts(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d body = %s", w.Code, w.Body.String())
	}
	raw, ok := c.Get(middlewares.AnalyticsPayloadKey)
	if !ok {
		t.Fatal("zero-result search must still record analytics")
	}
	payload := raw.(map[string]any)
	if payload["results_count"].(int64) != 0 {
		t.Fatalf("results_count = %#v", payload["results_count"])
	}
}

func TestListProductsWithoutSearchSkipsAnalyticsPayload(t *testing.T) {
	h := NewHandler(NewService(&listRepo{}, nil, nil), validator.New(), nil, zap.NewNop())
	c, w := listContext(t, "/api/v1/products")

	h.ListProducts(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d body = %s", w.Code, w.Body.String())
	}
	if _, ok := c.Get(middlewares.AnalyticsPayloadKey); ok {
		t.Fatal("browse list must not record search_performed payload")
	}
}

func TestListProductsErrorDoesNotInventEmptyResults(t *testing.T) {
	repo := &listRepo{err: errors.New("db down")}
	h := NewHandler(NewService(repo, nil, nil), validator.New(), nil, zap.NewNop())
	c, w := listContext(t, "/api/v1/products?search=whisky")

	h.ListProducts(c)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d body = %s; want 500", w.Code, w.Body.String())
	}
	if _, ok := c.Get(middlewares.AnalyticsPayloadKey); ok {
		t.Fatal("failed search must not invent results_count")
	}
	var envelope struct {
		Results json.RawMessage `json:"results"`
		Error   *struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decode: %v body = %s", err, w.Body.String())
	}
	if envelope.Results != nil {
		t.Fatalf("error must not invent results = %s", envelope.Results)
	}
	if envelope.Error == nil || envelope.Error.Code != "INTERNAL_ERROR" {
		t.Fatalf("error = %+v", envelope.Error)
	}
}

func TestListAdminProductsDoesNotRecordSearch(t *testing.T) {
	h := NewHandler(NewService(&listRepo{total: 2}, nil, nil), validator.New(), nil, zap.NewNop())
	c, w := listContext(t, "/api/v1/admin/products?search=whisky")

	h.ListAdminProducts(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d body = %s", w.Code, w.Body.String())
	}
	if _, ok := c.Get(middlewares.AnalyticsPayloadKey); ok {
		t.Fatal("admin list search is not a shopper search event")
	}
}

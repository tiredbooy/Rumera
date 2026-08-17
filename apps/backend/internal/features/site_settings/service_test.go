package site_settings

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
	"github.com/tiredbooy/pkg/validator"
)

type fakeRepo struct {
	current      *SiteSettings
	getErr       error
	updateErr    error
	updateCalls  int
	lastExpected time.Time
}

func (f *fakeRepo) Get(context.Context) (*SiteSettings, error) {
	if f.getErr != nil {
		return nil, f.getErr
	}
	if f.current == nil {
		return nil, models.ErrNotFound
	}
	return cloneSettings(f.current), nil
}

func (f *fakeRepo) Update(_ context.Context, settings SiteSettings, expected time.Time) (*SiteSettings, error) {
	f.updateCalls++
	f.lastExpected = expected
	if f.updateErr != nil {
		return nil, f.updateErr
	}
	if f.current == nil {
		return nil, models.ErrNotFound
	}
	if !f.current.UpdatedAt.Equal(expected) {
		return nil, models.ErrConflict
	}
	next := settings
	next.UpdatedAt = expected.Add(time.Second)
	if settings.Gift.Options != nil {
		next.Gift.Options = append([]GiftCheckoutOption(nil), settings.Gift.Options...)
	}
	f.current = cloneSettings(&next)
	return cloneSettings(&next), nil
}

func cloneSettings(in *SiteSettings) *SiteSettings {
	out := *in
	if in.Gift.Options != nil {
		out.Gift.Options = append([]GiftCheckoutOption(nil), in.Gift.Options...)
	}
	return &out
}

func seedSettings(t *testing.T, updatedAt time.Time) *SiteSettings {
	t.Helper()
	return &SiteSettings{
		Store:     StoreSettings{Name: "Rumera"},
		UpdatedAt: updatedAt,
		Gift: GiftCheckoutSettings{
			Enabled:          true,
			MessageEnabled:   true,
			MessageMaxLength: 500,
			HidePriceEnabled: true,
			Options: []GiftCheckoutOption{{
				ID:        "gift_wrap",
				Label:     "Wrap",
				Price:     10_000,
				Enabled:   true,
				SortOrder: 0,
			}},
		},
	}
}

func TestUpdateRequiresExpectedUpdatedAt(t *testing.T) {
	rev := time.Date(2026, 6, 20, 8, 0, 0, 0, time.UTC)
	repo := &fakeRepo{current: seedSettings(t, rev)}
	svc := NewService(repo)

	_, err := svc.Update(context.Background(), UpdateSiteSettingsReq{
		Store: &UpdateStoreReq{Name: "New"},
	})
	if !errors.Is(err, apperr.ErrValidation) {
		t.Fatalf("err = %v; want validation", err)
	}
	assertField(t, err, "expected_updated_at")
	if repo.updateCalls != 0 {
		t.Fatalf("update calls = %d; want 0", repo.updateCalls)
	}

	zero := time.Time{}
	_, err = svc.Update(context.Background(), UpdateSiteSettingsReq{
		ExpectedUpdatedAt: &zero,
		Store:             &UpdateStoreReq{Name: "New"},
	})
	if !errors.Is(err, apperr.ErrValidation) {
		t.Fatalf("zero revision err = %v; want validation", err)
	}
	if repo.updateCalls != 0 {
		t.Fatalf("update calls after zero = %d; want 0", repo.updateCalls)
	}
}

func TestUpdateConflictPreservesGiftPrices(t *testing.T) {
	rev := time.Date(2026, 6, 20, 8, 0, 0, 0, time.UTC)
	repo := &fakeRepo{current: seedSettings(t, rev)}
	svc := NewService(repo)

	first, err := svc.Update(context.Background(), UpdateSiteSettingsReq{
		ExpectedUpdatedAt: &rev,
		Gift: &UpdateGiftReq{
			Enabled:          true,
			MessageEnabled:   true,
			MessageMaxLength: 500,
			HidePriceEnabled: true,
			Options: []UpdateGiftOptionReq{{
				ID: "gift_wrap", Label: "Wrap", Price: 85_000, Enabled: true,
			}},
		},
	})
	if err != nil {
		t.Fatalf("first update: %v", err)
	}
	if first.Gift.Options[0].Price != 85_000 {
		t.Fatalf("gift price = %v; want 85000", first.Gift.Options[0].Price)
	}

	_, err = svc.Update(context.Background(), UpdateSiteSettingsReq{
		ExpectedUpdatedAt: &rev,
		Store:             &UpdateStoreReq{Name: "Other tab"},
	})
	if !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("stale update err = %v; want conflict", err)
	}
	assertField(t, err, "expected_updated_at")

	cur, err := svc.Get(context.Background())
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if cur.Store.Name != "Rumera" {
		t.Fatalf("store clobbered: %+v", cur.Store)
	}
	if len(cur.Gift.Options) != 1 || cur.Gift.Options[0].Price != 85_000 {
		t.Fatalf("gift prices lost: %+v", cur.Gift)
	}
}

func TestUpdateSucceedsWhenRevisionMatches(t *testing.T) {
	rev := time.Date(2026, 6, 20, 8, 0, 0, 0, time.UTC)
	repo := &fakeRepo{current: seedSettings(t, rev)}
	svc := NewService(repo)

	out, err := svc.Update(context.Background(), UpdateSiteSettingsReq{
		ExpectedUpdatedAt: &rev,
		Store:             &UpdateStoreReq{Name: "New cellar", Tagline: "t"},
	})
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if out.Store.Name != "New cellar" || out.Store.Tagline != "t" {
		t.Fatalf("store = %+v", out.Store)
	}
	if out.Gift.Options[0].Price != 10_000 {
		t.Fatalf("unrelated gift group changed: %+v", out.Gift)
	}
	if !out.UpdatedAt.After(rev) {
		t.Fatalf("updatedAt %v should advance past %v", out.UpdatedAt, rev)
	}
	if !repo.lastExpected.Equal(rev) {
		t.Fatalf("repo expected = %v; want %v", repo.lastExpected, rev)
	}
}

func TestUpdateMapsRepoConflict(t *testing.T) {
	rev := time.Date(2026, 6, 20, 8, 0, 0, 0, time.UTC)
	repo := &fakeRepo{current: seedSettings(t, rev), updateErr: models.ErrConflict}
	svc := NewService(repo)

	_, err := svc.Update(context.Background(), UpdateSiteSettingsReq{
		ExpectedUpdatedAt: &rev,
		Store:             &UpdateStoreReq{Name: "X"},
	})
	if !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("err = %v; want conflict", err)
	}
	assertField(t, err, "expected_updated_at")
}

func TestHandlerUpdateConflictIs409(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rev := time.Date(2026, 6, 20, 8, 0, 0, 0, time.UTC)
	repo := &fakeRepo{current: seedSettings(t, rev)}
	// Advance the row so the request's expected_updated_at is stale.
	if _, err := NewService(repo).Update(context.Background(), UpdateSiteSettingsReq{
		ExpectedUpdatedAt: &rev,
		Gift: &UpdateGiftReq{
			Enabled: true, MessageEnabled: true, MessageMaxLength: 500, HidePriceEnabled: true,
			Options: []UpdateGiftOptionReq{{ID: "gift_wrap", Label: "Wrap", Price: 85_000, Enabled: true}},
		},
	}); err != nil {
		t.Fatalf("seed write: %v", err)
	}

	h := NewHandler(NewService(repo), validator.New(), nil, nil)
	body := `{"expected_updated_at":"2026-06-20T08:00:00Z","store":{"name":"Stale tab"}}`
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPut, "/admin/settings", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	h.Update(c)

	if w.Code != http.StatusConflict {
		t.Fatalf("status = %d body = %s; want 409", w.Code, w.Body.String())
	}
	var payload struct {
		Error struct {
			Code   string              `json:"code"`
			Fields map[string][]string `json:"fields"`
		} `json:"error"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if payload.Error.Code != "CONFLICT" {
		t.Fatalf("code = %q; want CONFLICT", payload.Error.Code)
	}
	if len(payload.Error.Fields["expected_updated_at"]) == 0 {
		t.Fatalf("fields = %+v", payload.Error.Fields)
	}
}

func TestHandlerUpdateRequiresExpectedUpdatedAt(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rev := time.Date(2026, 6, 20, 8, 0, 0, 0, time.UTC)
	h := NewHandler(NewService(&fakeRepo{current: seedSettings(t, rev)}), validator.New(), nil, nil)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPut, "/admin/settings", strings.NewReader(`{"store":{"name":"X"}}`))
	c.Request.Header.Set("Content-Type", "application/json")

	h.Update(c)

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d body = %s; want 422", w.Code, w.Body.String())
	}
}

func assertField(t *testing.T, err error, field string) {
	t.Helper()
	fields, ok := apperr.Fields(err)
	if !ok || len(fields[field]) == 0 {
		t.Fatalf("error fields = %+v; want %q", fields, field)
	}
}

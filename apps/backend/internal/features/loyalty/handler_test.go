package loyalty

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/response"
	appvalidator "github.com/tiredbooy/pkg/validator"
)

func TestHandlerListMembersPagination(t *testing.T) {
	gin.SetMode(gin.TestMode)
	uid := uuid.MustParse("5b2c0000-0000-0000-0000-000000000010")
	repo := &repoStub{
		members: []AdminMemberRow{
			{UserID: uid, Email: "m@example.com", PointsBalance: 5, LifetimePoints: 5, Tier: TierBronze, UpdatedAt: time.Date(2026, 8, 16, 9, 0, 0, 0, time.UTC)},
			{UserID: uuid.MustParse("5b2c0000-0000-0000-0000-000000000011"), Email: "n@example.com", PointsBalance: 1, LifetimePoints: 1, Tier: TierBronze},
		},
		membersTotal: 5,
	}
	h := NewHandler(NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC"), appvalidator.New())

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/admin/loyalty/members?page=2&limit=2", nil)

	h.ListMembers(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", recorder.Code, recorder.Body.String())
	}
	var body response.PaginatedResponse[AdminMemberRow]
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body.Results) != 2 {
		t.Fatalf("results = %d", len(body.Results))
	}
	if body.Results[0].UserID != uid {
		t.Fatalf("user_id = %s", body.Results[0].UserID)
	}
	p := body.Pagination
	if p.Page != 2 || p.Limit != 2 || p.TotalItems != 5 || p.TotalPages != 3 || !p.HasNext || !p.HasPrev {
		t.Fatalf("pagination = %+v", p)
	}
	if repo.lastMemberFilter.Page != 2 || repo.lastMemberFilter.Limit != 2 {
		t.Fatalf("service filter = %+v", repo.lastMemberFilter)
	}
}

func TestHandlerGetMemberNotFound(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &repoStub{memberErr: models.ErrNotFound}
	h := NewHandler(NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC"), appvalidator.New())

	missing := uuid.MustParse("5b2c0000-0000-0000-0000-000000000404")
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = gin.Params{{Key: "userID", Value: missing.String()}}
	ctx.Request = httptest.NewRequest(http.MethodGet, "/admin/loyalty/members/"+missing.String(), nil)

	h.GetMember(ctx)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("status = %d body=%s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), `"code":"USER_NOT_FOUND"`) {
		t.Fatalf("body = %s", recorder.Body.String())
	}
}

func TestHandlerGetMemberInvalidUUID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewHandler(NewService(&repoStub{}, nil, 10000, 1000, 0, 0, 0, 300, "UTC"), appvalidator.New())

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = gin.Params{{Key: "userID", Value: "not-a-uuid"}}
	ctx.Request = httptest.NewRequest(http.MethodGet, "/admin/loyalty/members/not-a-uuid", nil)

	h.GetMember(ctx)

	if recorder.Code != http.StatusBadRequest || !strings.Contains(recorder.Body.String(), `"code":"INVALID_PARAMS"`) {
		t.Fatalf("response = %d %s", recorder.Code, recorder.Body.String())
	}
}

func TestHandlerAdminAdjustGrant(t *testing.T) {
	gin.SetMode(gin.TestMode)
	uid := uuid.MustParse("5b2c0000-0000-0000-0000-000000000030")
	actor := uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01")
	repo := &repoStub{
		awardGranted: true,
		internalID:   11,
		member: &AdminMemberRow{
			UserID:         uid,
			Email:          "g@example.com",
			PointsBalance:  0,
			LifetimePoints: 0,
			Tier:           TierBronze,
		},
	}
	h := NewHandler(NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC"), appvalidator.New())

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = gin.Params{{Key: "userID", Value: uid.String()}}
	ctx.Set("userID", actor)
	ctx.Set("uid", int64(99))
	body := `{"delta":15,"note":"grant","idempotency_key":"handler-key-01"}`
	ctx.Request = httptest.NewRequest(http.MethodPost, "/admin/users/"+uid.String()+"/loyalty/adjust", strings.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	h.AdminAdjust(ctx)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("status = %d body=%s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), `"replayed":false`) {
		t.Fatalf("body = %s", recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), `"lifetime_points":15`) {
		t.Fatalf("lifetime missing: %s", recorder.Body.String())
	}
}

func TestHandlerAdminAdjustReplay(t *testing.T) {
	gin.SetMode(gin.TestMode)
	uid := uuid.MustParse("5b2c0000-0000-0000-0000-000000000031")
	actor := uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02")
	repo := &repoStub{
		internalID: 12,
		member: &AdminMemberRow{
			UserID:         uid,
			PointsBalance:  15,
			LifetimePoints: 15,
			Tier:           TierBronze,
		},
		adjustTx: &LoyaltyTransaction{Delta: 15, Reason: LoyaltyReasonAdminAdjust, RefID: "handler-key-01"},
	}
	h := NewHandler(NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC"), appvalidator.New())

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = gin.Params{{Key: "userID", Value: uid.String()}}
	ctx.Set("userID", actor)
	ctx.Set("uid", int64(99))
	body := `{"delta":15,"note":"grant","idempotency_key":"handler-key-01"}`
	ctx.Request = httptest.NewRequest(http.MethodPost, "/admin/users/"+uid.String()+"/loyalty/adjust", strings.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	h.AdminAdjust(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), `"replayed":true`) {
		t.Fatalf("body = %s", recorder.Body.String())
	}
}

func TestHandlerAdminAdjustUnknownUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewHandler(NewService(&repoStub{resolveErr: models.ErrNotFound}, nil, 10000, 1000, 0, 0, 0, 300, "UTC"), appvalidator.New())

	missing := uuid.MustParse("5b2c0000-0000-0000-0000-000000000404")
	actor := uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa03")
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = gin.Params{{Key: "userID", Value: missing.String()}}
	ctx.Set("userID", actor)
	ctx.Set("uid", int64(99))
	body := `{"delta":10,"note":"x","idempotency_key":"handler-key-02"}`
	ctx.Request = httptest.NewRequest(http.MethodPost, "/admin/users/"+missing.String()+"/loyalty/adjust", strings.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	h.AdminAdjust(ctx)

	if recorder.Code != http.StatusNotFound || !strings.Contains(recorder.Body.String(), `"code":"USER_NOT_FOUND"`) {
		t.Fatalf("response = %d %s", recorder.Code, recorder.Body.String())
	}
}

func TestHandlerAdminAdjustDeltaZero(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewHandler(NewService(&repoStub{internalID: 1}, nil, 10000, 1000, 0, 0, 0, 300, "UTC"), appvalidator.New())

	uid := uuid.MustParse("5b2c0000-0000-0000-0000-000000000032")
	actor := uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa04")
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = gin.Params{{Key: "userID", Value: uid.String()}}
	ctx.Set("userID", actor)
	ctx.Set("uid", int64(99))
	body := `{"delta":0,"note":"nope","idempotency_key":"handler-key-03"}`
	ctx.Request = httptest.NewRequest(http.MethodPost, "/admin/users/"+uid.String()+"/loyalty/adjust", strings.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	h.AdminAdjust(ctx)

	if recorder.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestHandlerGetAccountIncludesRedeemValue(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &repoStub{
		account: &LoyaltyAccount{PointsBalance: 12, LifetimePoints: 20, Tier: TierBronze},
		programme: &programmeRow{
			Enabled:     true,
			EarnDivisor: 10000,
			RedeemValue: 500,
			BirthdayTZ:  "UTC",
		},
	}
	h := NewHandler(NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC"), appvalidator.New())

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("uid", int64(5))
	ctx.Request = httptest.NewRequest(http.MethodGet, "/loyalty", nil)

	h.GetAccount(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), `"redeem_value":500`) {
		t.Fatalf("body = %s", recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), `"points_balance":12`) {
		t.Fatalf("body = %s", recorder.Body.String())
	}
}

func TestHandlerRedeemMissingKey(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &repoStub{
		account: &LoyaltyAccount{PointsBalance: 10, LifetimePoints: 10, Tier: TierBronze},
	}
	h := NewHandler(NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC"), appvalidator.New())

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("uid", int64(5))
	ctx.Request = httptest.NewRequest(http.MethodPost, "/loyalty/redeem", strings.NewReader(`{"points":3}`))
	ctx.Request.Header.Set("Content-Type", "application/json")

	h.Redeem(ctx)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d body=%s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), `"code":"INVALID_REQUEST"`) {
		t.Fatalf("body = %s", recorder.Body.String())
	}
	if len(repo.spendCalls) != 0 {
		t.Fatalf("must not spend without key: %+v", repo.spendCalls)
	}
}

func TestHandlerRedeemHeaderKey(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &repoStub{
		spendReplay: true,
		account:     &LoyaltyAccount{PointsBalance: 10, LifetimePoints: 10, Tier: TierBronze},
	}
	h := NewHandler(NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC"), appvalidator.New())

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("uid", int64(5))
	ctx.Request = httptest.NewRequest(http.MethodPost, "/loyalty/redeem", strings.NewReader(`{"points":3}`))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Request.Header.Set("Idempotency-Key", "hdr-key-01")

	h.Redeem(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", recorder.Code, recorder.Body.String())
	}
	if repo.spendRef != "5:idem:hdr-key-01" {
		t.Fatalf("ref = %q", repo.spendRef)
	}
}

func TestHandlerRedeemBodyKey(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &repoStub{
		spendReplay: true,
		account:     &LoyaltyAccount{PointsBalance: 10, LifetimePoints: 10, Tier: TierBronze},
	}
	h := NewHandler(NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC"), appvalidator.New())

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("uid", int64(5))
	body := `{"points":3,"idempotency_key":"body-key-01"}`
	ctx.Request = httptest.NewRequest(http.MethodPost, "/loyalty/redeem", strings.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	h.Redeem(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", recorder.Code, recorder.Body.String())
	}
	if repo.spendRef != "5:idem:body-key-01" {
		t.Fatalf("ref = %q", repo.spendRef)
	}
}

func TestHandlerRedeemSameKeyDifferentUsers(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &repoStub{
		spendReplay: true,
		account:     &LoyaltyAccount{PointsBalance: 10, LifetimePoints: 10, Tier: TierBronze},
	}
	h := NewHandler(NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC"), appvalidator.New())

	for _, uid := range []int64{1, 2} {
		recorder := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(recorder)
		ctx.Set("uid", uid)
		ctx.Request = httptest.NewRequest(http.MethodPost, "/loyalty/redeem", strings.NewReader(`{"points":3}`))
		ctx.Request.Header.Set("Content-Type", "application/json")
		ctx.Request.Header.Set("Idempotency-Key", "shared-key-01")
		h.Redeem(ctx)
		if recorder.Code != http.StatusOK {
			t.Fatalf("user %d status = %d body=%s", uid, recorder.Code, recorder.Body.String())
		}
	}
	if len(repo.spendCalls) != 2 {
		t.Fatalf("spend calls = %d", len(repo.spendCalls))
	}
	if repo.spendCalls[0].refID != "1:idem:shared-key-01" || repo.spendCalls[1].refID != "2:idem:shared-key-01" {
		t.Fatalf("spend refs = %+v", repo.spendCalls)
	}
}

func TestHandlerRedeemReplaySameUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &repoStub{
		spendReplay: true,
		account:     &LoyaltyAccount{PointsBalance: 8, LifetimePoints: 20, Tier: TierBronze},
	}
	h := NewHandler(NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC"), appvalidator.New())

	for i := 0; i < 2; i++ {
		recorder := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(recorder)
		ctx.Set("uid", int64(5))
		ctx.Request = httptest.NewRequest(http.MethodPost, "/loyalty/redeem", strings.NewReader(`{"points":3}`))
		ctx.Request.Header.Set("Content-Type", "application/json")
		ctx.Request.Header.Set("Idempotency-Key", "replay-key-01")
		h.Redeem(ctx)
		if recorder.Code != http.StatusOK {
			t.Fatalf("call %d status = %d body=%s", i, recorder.Code, recorder.Body.String())
		}
	}
	if len(repo.spendCalls) != 2 {
		t.Fatalf("spend calls = %d", len(repo.spendCalls))
	}
	if repo.spendCalls[0].refID != "5:idem:replay-key-01" || repo.spendCalls[1].refID != repo.spendCalls[0].refID {
		t.Fatalf("spend refs = %+v", repo.spendCalls)
	}
}

func TestHandlerGetProgrammeIncludesEnabledAndDBSource(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &repoStub{
		programme: &programmeRow{
			Enabled:        true,
			EarnDivisor:    10000,
			RedeemValue:    1000,
			SignupBonus:    100,
			ReviewBonus:    50,
			BirthdayBonus:  200,
			BirthdayTZ:     "Asia/Tehran",
			ReferralReward: 300,
		},
		tiers: DefaultProgrammeTiers(),
	}
	h := NewHandler(NewService(repo, nil, 10000, 1000, 100, 50, 200, 300, "Asia/Tehran"), appvalidator.New())

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/admin/loyalty/programme", nil)

	h.GetProgramme(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", recorder.Code, recorder.Body.String())
	}
	body := recorder.Body.String()
	if !strings.Contains(body, `"config_source":"db"`) || !strings.Contains(body, `"enabled":true`) {
		t.Fatalf("body = %s", body)
	}
	if !strings.Contains(body, `"editable":true`) || !strings.Contains(body, `"earn_divisor":10000`) {
		t.Fatalf("body = %s", body)
	}
}

func TestHandlerUpdateProgrammePersists(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &repoStub{}
	h := NewHandler(NewService(repo, nil, 10000, 1000, 100, 50, 200, 300, "UTC"), appvalidator.New())

	body := `{
		"earn_divisor": 4000,
		"redeem_value": 250,
		"signup_bonus": 11,
		"review_bonus": 12,
		"birthday_bonus": 13,
		"birthday_tz": "UTC",
		"referral_reward": 14,
		"enabled": false,
		"tiers": [
			{"id":"bronze","min_lifetime_points":0},
			{"id":"silver","min_lifetime_points":80},
			{"id":"gold","min_lifetime_points":180},
			{"id":"cellar","min_lifetime_points":280}
		]
	}`
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPut, "/admin/loyalty/programme", strings.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	h.UpdateProgramme(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", recorder.Code, recorder.Body.String())
	}
	if repo.savedRow == nil || repo.savedRow.EarnDivisor != 4000 || repo.savedRow.Enabled {
		t.Fatalf("saved = %+v", repo.savedRow)
	}
	out := recorder.Body.String()
	if !strings.Contains(out, `"config_source":"db"`) || !strings.Contains(out, `"enabled":false`) {
		t.Fatalf("body = %s", out)
	}
	if !strings.Contains(out, `"earn_divisor":4000`) || !strings.Contains(out, `"min_lifetime_points":80`) {
		t.Fatalf("body = %s", out)
	}
}

func TestHandlerUpdateProgrammeValidation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewHandler(NewService(&repoStub{}, nil, 10000, 1000, 100, 50, 200, 300, "UTC"), appvalidator.New())

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	body := `{"earn_divisor":0,"redeem_value":1000,"enabled":true,"tiers":[
		{"id":"bronze","min_lifetime_points":0},
		{"id":"silver","min_lifetime_points":1000},
		{"id":"gold","min_lifetime_points":5000},
		{"id":"cellar","min_lifetime_points":20000}
	]}`
	ctx.Request = httptest.NewRequest(http.MethodPut, "/admin/loyalty/programme", strings.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	h.UpdateProgramme(ctx)

	if recorder.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestHandlerRedeemDisabledProgramme(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &repoStub{
		account:   &LoyaltyAccount{PointsBalance: 10, LifetimePoints: 10, Tier: TierBronze},
		programme: &programmeRow{Enabled: false, EarnDivisor: 10000, RedeemValue: 1000, BirthdayTZ: "UTC"},
		tiers:     DefaultProgrammeTiers(),
	}
	h := NewHandler(NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC"), appvalidator.New())

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("uid", int64(5))
	ctx.Request = httptest.NewRequest(http.MethodPost, "/loyalty/redeem", strings.NewReader(`{"points":3}`))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Request.Header.Set("Idempotency-Key", "hdr-key-disabled")

	h.Redeem(ctx)

	if recorder.Code != http.StatusConflict || !strings.Contains(recorder.Body.String(), `"code":"LOYALTY_DISABLED"`) {
		t.Fatalf("response = %d %s", recorder.Code, recorder.Body.String())
	}
	if len(repo.spendCalls) != 0 {
		t.Fatalf("must not spend: %+v", repo.spendCalls)
	}
}

func TestHandlerListTransactionsDefaultPage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	created := time.Date(2026, 8, 16, 12, 0, 0, 0, time.UTC)
	repo := &repoStub{
		txs: []LoyaltyTransaction{
			{ID: 7, Delta: 50, Reason: LoyaltyReasonOrderPaid, RefType: "order", RefID: "99", CreatedAt: created},
			{ID: 6, Delta: -10, Reason: LoyaltyReasonRedeem, RefType: "redeem", RefID: "5:idem:k", CreatedAt: created},
		},
		txsTotal: 2,
	}
	h := NewHandler(NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC"), appvalidator.New())

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("uid", int64(5))
	ctx.Request = httptest.NewRequest(http.MethodGet, "/loyalty/transactions", nil)

	h.ListTransactions(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", recorder.Code, recorder.Body.String())
	}
	var body response.PaginatedResponse[LoyaltyTransactionResponse]
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body.Results) != 2 {
		t.Fatalf("results = %d", len(body.Results))
	}
	if body.Results[0].ID != 7 || body.Results[0].RefType != "order" || body.Results[0].RefID != "99" {
		t.Fatalf("row = %+v", body.Results[0])
	}
	if body.Results[1].ID != 6 || body.Results[1].RefType != "redeem" || body.Results[1].RefID != "5:idem:k" {
		t.Fatalf("row = %+v", body.Results[1])
	}
	p := body.Pagination
	if p.Page != 1 || p.Limit != 20 || p.TotalItems != 2 || p.TotalPages != 1 || p.HasNext || p.HasPrev {
		t.Fatalf("pagination = %+v", p)
	}
	if repo.lastCustomerFilt.Page != 1 || repo.lastCustomerFilt.Limit != 20 {
		t.Fatalf("defaults = %+v", repo.lastCustomerFilt)
	}
	if strings.Contains(recorder.Body.String(), `"data"`) {
		t.Fatalf("must be {results, pagination}, got %s", recorder.Body.String())
	}
}

func TestHandlerListTransactionsLimitRespected(t *testing.T) {
	gin.SetMode(gin.TestMode)
	created := time.Date(2026, 8, 16, 12, 0, 0, 0, time.UTC)
	repo := &repoStub{
		txs: []LoyaltyTransaction{
			{ID: 11, Delta: 5, Reason: LoyaltyReasonSignup, RefType: "user", RefID: "5", CreatedAt: created},
			{ID: 10, Delta: 3, Reason: LoyaltyReasonReview, RefType: "review", RefID: "8", CreatedAt: created},
		},
		txsTotal: 5,
	}
	h := NewHandler(NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC"), appvalidator.New())

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("uid", int64(5))
	ctx.Request = httptest.NewRequest(http.MethodGet, "/loyalty/transactions?page=2&limit=2", nil)

	h.ListTransactions(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", recorder.Code, recorder.Body.String())
	}
	var body response.PaginatedResponse[LoyaltyTransactionResponse]
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body.Results) != 2 {
		t.Fatalf("results = %d", len(body.Results))
	}
	p := body.Pagination
	if p.Page != 2 || p.Limit != 2 || p.TotalItems != 5 || p.TotalPages != 3 || !p.HasNext || !p.HasPrev {
		t.Fatalf("pagination = %+v", p)
	}
	if repo.lastCustomerFilt.Page != 2 || repo.lastCustomerFilt.Limit != 2 {
		t.Fatalf("filter = %+v", repo.lastCustomerFilt)
	}
}

func TestHandlerListTransactionsInvalidQuery(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &repoStub{
		txs:      []LoyaltyTransaction{{ID: 1, Delta: 1, Reason: LoyaltyReasonSignup}},
		txsTotal: 1,
	}
	h := NewHandler(NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC"), appvalidator.New())

	cases := []string{
		"/loyalty/transactions?limit=200",
		"/loyalty/transactions?limit=0",
		"/loyalty/transactions?page=0",
		"/loyalty/transactions?page=abc",
	}
	for _, path := range cases {
		recorder := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(recorder)
		ctx.Set("uid", int64(5))
		ctx.Request = httptest.NewRequest(http.MethodGet, path, nil)
		h.ListTransactions(ctx)
		if recorder.Code != http.StatusBadRequest {
			t.Fatalf("%s status = %d body=%s", path, recorder.Code, recorder.Body.String())
		}
		if !strings.Contains(recorder.Body.String(), `"code":"INVALID_QUERY"`) {
			t.Fatalf("%s body = %s", path, recorder.Body.String())
		}
		if strings.Contains(recorder.Body.String(), `"results"`) {
			t.Fatalf("%s must not collapse to []: %s", path, recorder.Body.String())
		}
	}
	if repo.lastCustomerID != 0 {
		t.Fatalf("invalid query must not hit repo: user=%d", repo.lastCustomerID)
	}
}

func TestHandlerListTransactionsUnauthorized(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewHandler(NewService(&repoStub{}, nil, 10000, 1000, 0, 0, 0, 300, "UTC"), appvalidator.New())

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/loyalty/transactions", nil)
	h.ListTransactions(ctx)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestHandlerListMemberTransactionsNotFound(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &repoStub{memberTxsErr: models.ErrNotFound}
	h := NewHandler(NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC"), appvalidator.New())

	missing := uuid.MustParse("5b2c0000-0000-0000-0000-000000000405")
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = gin.Params{{Key: "userID", Value: missing.String()}}
	ctx.Request = httptest.NewRequest(http.MethodGet, "/admin/loyalty/members/"+missing.String()+"/transactions?page=1&limit=20", nil)

	h.ListMemberTransactions(ctx)

	if recorder.Code != http.StatusNotFound || !strings.Contains(recorder.Body.String(), `"code":"USER_NOT_FOUND"`) {
		t.Fatalf("response = %d %s", recorder.Code, recorder.Body.String())
	}
}

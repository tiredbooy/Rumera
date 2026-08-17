package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/tiredbooy/internal/features/users"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/response"
	"github.com/tiredbooy/pkg/validator"
	"go.uber.org/zap"
)

type phoneChangeRepo struct {
	users.Repository
	user       *users.User
	byPhone    *users.User
	updatedReq users.UpdateUserReq
	updateN    int
}

func (r *phoneChangeRepo) GetByID(_ context.Context, id uuid.UUID) (*users.User, error) {
	if r.user != nil && r.user.UserID == id {
		return r.user, nil
	}
	return nil, models.ErrNotFound
}

func (r *phoneChangeRepo) GetByPhone(_ context.Context, phone string) (*users.User, error) {
	if r.byPhone != nil && r.byPhone.Phone != nil && *r.byPhone.Phone == phone {
		return r.byPhone, nil
	}
	return nil, models.ErrNotFound
}

func (r *phoneChangeRepo) Update(_ context.Context, id uuid.UUID, req users.UpdateUserReq) (*users.User, error) {
	r.updateN++
	r.updatedReq = req
	out := *r.user
	if req.Phone != nil {
		out.Phone = req.Phone
	}
	return &out, nil
}

func phoneChangeHandler(t *testing.T, repo *phoneChangeRepo, store *fakeCache) *Handler {
	t.Helper()
	return New(Handler{
		Validator: validator.New(),
		Cache:     store,
		OTPTTL:    time.Minute,
		Users:     users.NewService(repo),
		Log:       zap.NewNop(),
	})
}

func withUser(userID uuid.UUID) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("userID", userID)
		c.Next()
	}
}

func doPhoneOTP(h *Handler, userID uuid.UUID, method, path string, body any) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	g := r.Group("/auth", withUser(userID))
	RegisterCustomer(g, h)

	var buf *bytes.Buffer
	if body != nil {
		b, _ := json.Marshal(body)
		buf = bytes.NewBuffer(b)
	} else {
		buf = bytes.NewBuffer(nil)
	}
	w := httptest.NewRecorder()
	req := httptest.NewRequest(method, path, buf)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	return w
}

func TestRegisterCustomerMountsPhoneChangeOTP(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	RegisterCustomer(r.Group("/auth"), &Handler{})

	want := map[string]bool{
		"GET /auth/me":               false,
		"POST /auth/me/phone/otp":    false,
		"POST /auth/me/phone/verify": false,
	}
	for _, route := range r.Routes() {
		key := route.Method + " " + route.Path
		if _, ok := want[key]; ok {
			want[key] = true
		}
	}
	for route, found := range want {
		if !found {
			t.Errorf("expected route %s", route)
		}
	}
}

func TestPhoneChangeOTPPersistsOnlyAfterVerify(t *testing.T) {
	userID := uuid.New()
	current := "09120000000"
	next := "09121111111"
	repo := &phoneChangeRepo{
		user: &users.User{
			UserID: userID, Phone: &current, Role: users.UserRoleCustomer, IsActive: true,
		},
	}
	store := newFakeCache()
	h := phoneChangeHandler(t, repo, store)

	reqW := doPhoneOTP(h, userID, http.MethodPost, "/auth/me/phone/otp", RequestOTPReq{Phone: next})
	if reqW.Code != http.StatusAccepted {
		t.Fatalf("request status = %d body %s", reqW.Code, reqW.Body.String())
	}
	if repo.updateN != 0 {
		t.Fatal("phone persisted on OTP request")
	}

	code, err := store.Get(context.Background(), cache.KeyOTP(phoneChangeOTPScope(userID)))
	if err != nil || len(code) != 6 {
		t.Fatalf("stored code = %q err %v", code, err)
	}

	badW := doPhoneOTP(h, userID, http.MethodPost, "/auth/me/phone/verify", VerifyOTPReq{Phone: next, Code: "000000"})
	if badW.Code != http.StatusUnauthorized {
		t.Fatalf("wrong code status = %d; want 401", badW.Code)
	}
	if repo.updateN != 0 {
		t.Fatal("phone persisted on wrong code")
	}

	okW := doPhoneOTP(h, userID, http.MethodPost, "/auth/me/phone/verify", VerifyOTPReq{Phone: next, Code: code})
	if okW.Code != http.StatusOK {
		t.Fatalf("verify status = %d body %s", okW.Code, okW.Body.String())
	}
	if repo.updateN != 1 || repo.updatedReq.Phone == nil || *repo.updatedReq.Phone != next {
		t.Fatalf("verified persist = calls %d phone %+v", repo.updateN, repo.updatedReq.Phone)
	}
}

func TestPhoneChangeOTPRejectsTakenAndUnrequested(t *testing.T) {
	userID := uuid.New()
	current := "09120000000"
	taken := "09123333333"
	other := "09124444444"
	repo := &phoneChangeRepo{
		user:    &users.User{UserID: userID, Phone: &current, IsActive: true},
		byPhone: &users.User{UserID: uuid.New(), Phone: &taken},
	}
	h := phoneChangeHandler(t, repo, newFakeCache())

	takenW := doPhoneOTP(h, userID, http.MethodPost, "/auth/me/phone/otp", RequestOTPReq{Phone: taken})
	if takenW.Code != http.StatusConflict {
		t.Fatalf("taken status = %d; want 409", takenW.Code)
	}

	sameW := doPhoneOTP(h, userID, http.MethodPost, "/auth/me/phone/otp", RequestOTPReq{Phone: current})
	if sameW.Code != http.StatusBadRequest {
		t.Fatalf("same-number status = %d; want 400", sameW.Code)
	}

	orphanW := doPhoneOTP(h, userID, http.MethodPost, "/auth/me/phone/verify", VerifyOTPReq{Phone: other, Code: "123456"})
	if orphanW.Code != http.StatusUnauthorized {
		t.Fatalf("no-pending status = %d; want 401", orphanW.Code)
	}
	var env response.ErrorResponse
	if err := json.Unmarshal(orphanW.Body.Bytes(), &env); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if env.Error.Code != response.ErrInvalidCredentials.Code {
		t.Fatalf("code = %q; want INVALID_CREDENTIALS", env.Error.Code)
	}
	if repo.updateN != 0 {
		t.Fatal("unrequested verify persisted phone")
	}
}

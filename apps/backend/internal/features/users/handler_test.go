package users

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/tiredbooy/pkg/validator"
)

func TestUpdateProfileDoesNotPersistNewPhone(t *testing.T) {
	gin.SetMode(gin.TestMode)
	userID := uuid.New()
	current := "09120000000"
	next := "09121111111"
	name := "Nika"
	repo := &userServiceRepoStub{
		byID: &User{UserID: userID, Phone: &current, Email: "a@b.c", Role: UserRoleCustomer, IsActive: true},
	}
	h := NewHandler(NewService(repo), validator.New())

	r := gin.New()
	r.PATCH("/me", func(c *gin.Context) {
		c.Set("userID", userID)
		h.UpdateProfile(c)
	})

	body, _ := json.Marshal(UpdateProfileInput{FirstName: &name, Phone: &next})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPatch, "/me", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusAccepted {
		t.Fatalf("status = %d body %s; want 202", w.Code, w.Body.String())
	}
	if repo.updateCalls != 1 || repo.updatedReq.Phone != nil {
		t.Fatalf("repo write = calls %d phone %+v", repo.updateCalls, repo.updatedReq.Phone)
	}
	var env struct {
		Data ProfileUpdateResponse `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if env.Data.PendingPhone == nil || *env.Data.PendingPhone != next {
		t.Fatalf("pending = %+v", env.Data.PendingPhone)
	}
	if env.Data.Phone == nil || *env.Data.Phone != current {
		t.Fatalf("response phone = %+v; want current", env.Data.Phone)
	}
	if env.Data.FirstName == nil || *env.Data.FirstName != name {
		t.Fatalf("first_name not updated: %+v", env.Data.FirstName)
	}
}

// CF-3: the customer file is where wallet credit is minted, and it used to do
// that with no balance on the page. The detail read now carries it, so the
// operator granting money can see what the customer already has.
func TestGetUserCarriesWalletBalance(t *testing.T) {
	gin.SetMode(gin.TestMode)
	userID := uuid.New()
	repo := &userServiceRepoStub{
		byID:          &User{ID: 7, UserID: userID, Email: "a@b.c", Role: UserRoleCustomer, IsActive: true},
		walletBalance: 125000.5,
	}
	h := NewHandler(NewService(repo), validator.New())

	r := gin.New()
	r.GET("/admin/users/:userID", h.GetUser)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/admin/users/"+userID.String(), nil))

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d body %s; want 200", w.Code, w.Body.String())
	}
	var env struct {
		Data AdminUser `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("decode: %v", err)
	}
	// Exact decimal string, not a float — the frontend money formatter parses
	// the string rather than routing it through Number().
	if env.Data.WalletBalance != "125000.50" {
		t.Fatalf("wallet_balance = %q; want 125000.50", env.Data.WalletBalance)
	}
	// The write projections never looked the balance up; they must not claim one.
	if got := MapToAdminUser(repo.byID).WalletBalance; got != "" {
		t.Fatalf("MapToAdminUser wallet_balance = %q; want empty", got)
	}
}

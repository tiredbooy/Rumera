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

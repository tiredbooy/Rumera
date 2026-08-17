package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/tiredbooy/internal/features/users"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/response"
	"github.com/tiredbooy/pkg/validator"
	"golang.org/x/crypto/bcrypt"
)

type loginUsersRepo struct {
	users.Repository
	user *users.User
	err  error
}

func (r *loginUsersRepo) GetByEmail(context.Context, string) (*users.User, error) {
	return r.user, r.err
}

func loginJSON(email, password string) *bytes.Buffer {
	b, _ := json.Marshal(SignInInput{Email: email, Password: password})
	return bytes.NewBuffer(b)
}

func doLogin(h *Handler, body *bytes.Buffer) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/login", h.Login)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/login", body)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	return w
}

func TestDummyLoginHashIsCost12Bcrypt(t *testing.T) {
	cost, err := bcrypt.Cost([]byte(dummyLoginHash))
	if err != nil {
		t.Fatalf("dummyLoginHash is not a valid bcrypt hash: %v", err)
	}
	if cost != 12 {
		t.Fatalf("dummyLoginHash cost = %d; want 12 (same as HashPassword)", cost)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(dummyLoginHash), []byte("x")); err == nil {
		t.Fatal("dummyLoginHash matched a throwaway password")
	} else if errors.Is(err, bcrypt.ErrHashTooShort) {
		t.Fatal("dummyLoginHash is not a full bcrypt hash")
	}
}

func TestCompareLoginPasswordUsesDummyOnNilHash(t *testing.T) {
	if compareLoginPassword("any-password", nil) {
		t.Fatal("nil stored hash must not authenticate")
	}
	cheap, err := bcrypt.GenerateFromPassword([]byte("secret"), 4)
	if err != nil {
		t.Fatal(err)
	}
	stored := string(cheap)
	if !compareLoginPassword("secret", &stored) {
		t.Fatal("correct password against a real hash should pass")
	}
	if compareLoginPassword("wrong", &stored) {
		t.Fatal("wrong password against a real hash should fail")
	}
}

func TestLoginUnknownEmailMatchesWrongPasswordStatus(t *testing.T) {
	cheap, err := bcrypt.GenerateFromPassword([]byte("correct-horse"), 4)
	if err != nil {
		t.Fatal(err)
	}
	hash := string(cheap)
	known := users.NewService(&loginUsersRepo{
		user: &users.User{
			ID:           1,
			UserID:       uuid.New(),
			Email:        "jane@example.com",
			PasswordHash: &hash,
			Role:         users.UserRoleCustomer,
			IsActive:     true,
		},
	})
	unknown := users.NewService(&loginUsersRepo{err: models.ErrNotFound})
	otpOnly := users.NewService(&loginUsersRepo{
		user: &users.User{
			ID:           2,
			UserID:       uuid.New(),
			Email:        "otp@example.com",
			PasswordHash: nil,
			Role:         users.UserRoleCustomer,
			IsActive:     true,
		},
	})

	cases := []struct {
		name string
		h    *Handler
		body *bytes.Buffer
	}{
		{"unknown email", New(Handler{Users: unknown, Validator: validator.New()}), loginJSON("ghost@example.com", "whatever")},
		{"wrong password", New(Handler{Users: known, Validator: validator.New()}), loginJSON("jane@example.com", "nope")},
		{"otp-only account", New(Handler{Users: otpOnly, Validator: validator.New()}), loginJSON("otp@example.com", "whatever")},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			w := doLogin(tc.h, tc.body)
			if w.Code != http.StatusUnauthorized {
				t.Fatalf("status = %d; want 401", w.Code)
			}
			var env response.ErrorResponse
			if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
				t.Fatalf("decode: %v", err)
			}
			if env.Error.Code != response.ErrInvalidCredentials.Code {
				t.Fatalf("code = %q; want %q", env.Error.Code, response.ErrInvalidCredentials.Code)
			}
		})
	}
}

package middlewares

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	config "github.com/tiredbooy/configs"
	"github.com/tiredbooy/internal/features/users"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/token"
	"go.uber.org/zap"
)

func ptrTime(t time.Time) *time.Time { return &t }

type authUserReaderStub struct {
	user *users.AuthUser
	err  error
}

func (s authUserReaderStub) GetAuthUserByUID(context.Context, int64) (*users.AuthUser, error) {
	return s.user, s.err
}

func TestAuthRehydratesLiveRoleAndStatus(t *testing.T) {
	gin.SetMode(gin.TestMode)
	userID := uuid.New()
	manager := token.NewManager(&config.Config{
		JWTSecret:         "test-secret",
		JWTAccessTokenTTL: 15,
	}, zap.NewNop())

	tests := []struct {
		name       string
		claimRole  string
		reader     AuthUserReader
		wantStatus int
	}{
		{
			name:      "live admin overrides stale customer claim",
			claimRole: users.UserRoleCustomer,
			reader: authUserReaderStub{user: &users.AuthUser{
				ID: 7, UserID: userID, Role: users.UserRoleAdmin, IsActive: true,
			}},
			wantStatus: http.StatusOK,
		},
		{
			name:      "live customer overrides stale admin claim",
			claimRole: users.UserRoleAdmin,
			reader: authUserReaderStub{user: &users.AuthUser{
				ID: 7, UserID: userID, Role: users.UserRoleCustomer, IsActive: true,
			}},
			wantStatus: http.StatusForbidden,
		},
		{
			name:      "inactive account invalidates token",
			claimRole: users.UserRoleAdmin,
			reader: authUserReaderStub{user: &users.AuthUser{
				ID: 7, UserID: userID, Role: users.UserRoleAdmin, IsActive: false,
			}},
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:      "banned account invalidates token",
			claimRole: users.UserRoleAdmin,
			reader: authUserReaderStub{user: &users.AuthUser{
				ID: 7, UserID: userID, Role: users.UserRoleAdmin, IsActive: true, IsBanned: true,
			}},
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "missing account invalidates token",
			claimRole:  users.UserRoleAdmin,
			reader:     authUserReaderStub{err: models.ErrNotFound},
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "database failure fails closed without blaming permissions",
			claimRole:  users.UserRoleAdmin,
			reader:     authUserReaderStub{err: errors.New("database unavailable")},
			wantStatus: http.StatusInternalServerError,
		},
		{
			name:      "claim and database identity must match",
			claimRole: users.UserRoleAdmin,
			reader: authUserReaderStub{user: &users.AuthUser{
				ID: 7, UserID: uuid.New(), Role: users.UserRoleAdmin, IsActive: true,
			}},
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:      "sessions invalidated after password reset",
			claimRole: users.UserRoleAdmin,
			reader: authUserReaderStub{user: &users.AuthUser{
				ID: 7, UserID: userID, Role: users.UserRoleAdmin, IsActive: true,
				// Cutover in the future → token iat (now) is strictly before it.
				SessionsInvalidatedAt: ptrTime(time.Now().Add(time.Hour)),
			}},
			wantStatus: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			access, err := manager.GenerateAccessToken(7, userID.String(), tt.claimRole)
			if err != nil {
				t.Fatalf("generate access token: %v", err)
			}

			router := gin.New()
			router.GET("/admin", Auth(manager, tt.reader), RequireRole(users.UserRoleAdmin), func(c *gin.Context) {
				if got, ok := UserUUID(c); !ok || got != userID {
					t.Fatalf("live user UUID = %s, %v; want %s, true", got, ok, userID)
				}
				if got := Role(c); got != users.UserRoleAdmin {
					t.Fatalf("live role = %q; want admin", got)
				}
				c.Status(http.StatusOK)
			})
			req := httptest.NewRequest(http.MethodGet, "/admin", nil)
			req.Header.Set("Authorization", "Bearer "+access)
			res := httptest.NewRecorder()
			router.ServeHTTP(res, req)

			if res.Code != tt.wantStatus {
				t.Fatalf("status = %d, body = %s; want %d", res.Code, res.Body.String(), tt.wantStatus)
			}
		})
	}
}

func TestAuthRejectsRefreshTokenBeforeLiveRoleHydration(t *testing.T) {
	gin.SetMode(gin.TestMode)
	userID := uuid.New()
	manager := token.NewManager(&config.Config{
		JWTSecret:          "test-secret",
		JWTRefreshTokenTTL: 60,
	}, zap.NewNop())
	refresh, err := manager.GenerateRefreshToken(7, userID.String())
	if err != nil {
		t.Fatalf("generate refresh token: %v", err)
	}

	router := gin.New()
	router.GET("/admin", Auth(manager, authUserReaderStub{user: &users.AuthUser{
		ID: 7, UserID: userID, Role: users.UserRoleAdmin, IsActive: true,
	}}), RequireRole(users.UserRoleAdmin), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})
	req := httptest.NewRequest(http.MethodGet, "/admin", nil)
	req.Header.Set("Authorization", "Bearer "+refresh)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, body = %s; want %d", res.Code, res.Body.String(), http.StatusUnauthorized)
	}
}

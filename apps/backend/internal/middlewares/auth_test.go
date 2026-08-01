package middlewares

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	config "github.com/tiredbooy/configs"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/token"
	"go.uber.org/zap"
)

type authUserReaderStub struct {
	user *models.AuthUser
	err  error
}

func (s authUserReaderStub) GetAuthUserByUID(context.Context, int64) (*models.AuthUser, error) {
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
			claimRole: models.UserRoleCustomer,
			reader: authUserReaderStub{user: &models.AuthUser{
				ID: 7, UserID: userID, Role: models.UserRoleAdmin, IsActive: true,
			}},
			wantStatus: http.StatusOK,
		},
		{
			name:      "live customer overrides stale admin claim",
			claimRole: models.UserRoleAdmin,
			reader: authUserReaderStub{user: &models.AuthUser{
				ID: 7, UserID: userID, Role: models.UserRoleCustomer, IsActive: true,
			}},
			wantStatus: http.StatusForbidden,
		},
		{
			name:      "inactive account invalidates token",
			claimRole: models.UserRoleAdmin,
			reader: authUserReaderStub{user: &models.AuthUser{
				ID: 7, UserID: userID, Role: models.UserRoleAdmin, IsActive: false,
			}},
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:      "banned account invalidates token",
			claimRole: models.UserRoleAdmin,
			reader: authUserReaderStub{user: &models.AuthUser{
				ID: 7, UserID: userID, Role: models.UserRoleAdmin, IsActive: true, IsBanned: true,
			}},
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "missing account invalidates token",
			claimRole:  models.UserRoleAdmin,
			reader:     authUserReaderStub{err: models.ErrNotFound},
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "database failure fails closed without blaming permissions",
			claimRole:  models.UserRoleAdmin,
			reader:     authUserReaderStub{err: errors.New("database unavailable")},
			wantStatus: http.StatusInternalServerError,
		},
		{
			name:      "claim and database identity must match",
			claimRole: models.UserRoleAdmin,
			reader: authUserReaderStub{user: &models.AuthUser{
				ID: 7, UserID: uuid.New(), Role: models.UserRoleAdmin, IsActive: true,
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
			router.GET("/admin", Auth(manager, tt.reader), RequireRole(models.UserRoleAdmin), func(c *gin.Context) {
				if got, ok := UserUUID(c); !ok || got != userID {
					t.Fatalf("live user UUID = %s, %v; want %s, true", got, ok, userID)
				}
				if got := Role(c); got != models.UserRoleAdmin {
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
	router.GET("/admin", Auth(manager, authUserReaderStub{user: &models.AuthUser{
		ID: 7, UserID: userID, Role: models.UserRoleAdmin, IsActive: true,
	}}), RequireRole(models.UserRoleAdmin), func(c *gin.Context) {
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

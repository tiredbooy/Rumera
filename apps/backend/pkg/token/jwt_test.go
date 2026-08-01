package token

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v4"
	"github.com/google/uuid"
	config "github.com/tiredbooy/configs"
	"go.uber.org/zap"
)

func TestJWTManagerEnforcesTokenPurpose(t *testing.T) {
	manager := NewManager(&config.Config{
		JWTSecret:          "purpose-test-secret",
		JWTAccessTokenTTL:  15,
		JWTRefreshTokenTTL: 60,
	}, zap.NewNop())
	userID := uuid.New().String()

	access, err := manager.GenerateAccessToken(7, userID, "admin")
	if err != nil {
		t.Fatalf("generate access: %v", err)
	}
	accessClaims, err := manager.ValidateAccessToken(access)
	if err != nil || accessClaims.TokenType != TypeAccess {
		t.Fatalf("validate access = %+v, %v", accessClaims, err)
	}
	if _, err := manager.ValidateRefreshToken(access); err == nil {
		t.Fatal("typed access token validated as refresh")
	}

	refresh, err := manager.GenerateRefreshToken(7, userID)
	if err != nil {
		t.Fatalf("generate refresh: %v", err)
	}
	refreshClaims, err := manager.ValidateRefreshToken(refresh)
	if err != nil || refreshClaims.TokenType != TypeRefresh || refreshClaims.ID == "" {
		t.Fatalf("validate refresh = %+v, %v", refreshClaims, err)
	}
	if _, err := manager.ValidateAccessToken(refresh); err == nil {
		t.Fatal("typed refresh token validated as access")
	}
}

func TestJWTManagerPreservesOnlyConcreteLegacyTokenShapes(t *testing.T) {
	const secret = "legacy-test-secret"
	manager := NewManager(&config.Config{JWTSecret: secret}, zap.NewNop())
	userID := uuid.New().String()

	legacyAccess := signLegacyToken(t, secret, Claims{
		UID: 7, UserID: userID, Role: "admin",
		RegisteredClaims: legacyRegisteredClaims(userID, ""),
	})
	if _, err := manager.ValidateAccessToken(legacyAccess); err != nil {
		t.Fatalf("legacy access rejected: %v", err)
	}
	if _, err := manager.ValidateRefreshToken(legacyAccess); err == nil {
		t.Fatal("legacy no-JTI access token validated as refresh")
	}

	legacyRefresh := signLegacyToken(t, secret, Claims{
		UID: 7, UserID: userID,
		RegisteredClaims: legacyRegisteredClaims(userID, uuid.NewString()),
	})
	if _, err := manager.ValidateRefreshToken(legacyRefresh); err != nil {
		t.Fatalf("legacy refresh rejected: %v", err)
	}
	if _, err := manager.ValidateAccessToken(legacyRefresh); err == nil {
		t.Fatal("legacy JTI refresh token validated as access")
	}
}

func signLegacyToken(t *testing.T, secret string, claims Claims) string {
	t.Helper()
	signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("sign legacy token: %v", err)
	}
	return signed
}

func legacyRegisteredClaims(userID, jti string) jwt.RegisteredClaims {
	return jwt.RegisteredClaims{
		ID:        jti,
		Subject:   userID,
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		IssuedAt:  jwt.NewNumericDate(time.Now()),
	}
}

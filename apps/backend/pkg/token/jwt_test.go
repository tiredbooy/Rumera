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

func TestJWTManagerRejectsExpiredTamperedAndEmpty(t *testing.T) {
	const secret = "guard-test-secret"
	manager := NewManager(&config.Config{
		JWTSecret:          secret,
		JWTAccessTokenTTL:  15,
		JWTRefreshTokenTTL: 60,
	}, zap.NewNop())
	userID := uuid.New().String()

	// Expired access token.
	expired := signLegacyToken(t, secret, Claims{
		UID: 1, UserID: userID, Role: "customer", TokenType: TypeAccess,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)),
		},
	})
	if _, err := manager.ValidateAccessToken(expired); err == nil {
		t.Fatal("expired access token accepted")
	}

	// Wrong secret (tampered / different issuer).
	other := NewManager(&config.Config{
		JWTSecret:          "other-secret-value",
		JWTAccessTokenTTL:  15,
		JWTRefreshTokenTTL: 60,
	}, zap.NewNop())
	tok, err := other.GenerateAccessToken(1, userID, "customer")
	if err != nil {
		t.Fatalf("generate: %v", err)
	}
	if _, err := manager.ValidateAccessToken(tok); err == nil {
		t.Fatal("token signed with wrong secret accepted")
	}

	// Empty / garbage.
	if _, err := manager.ValidateAccessToken(""); err == nil {
		t.Fatal("empty token accepted")
	}
	if _, err := manager.ValidateAccessToken("not.a.jwt"); err == nil {
		t.Fatal("garbage token accepted")
	}

	// Refresh without JTI after typed issue always has JTI — reject empty-id typed refresh shape.
	badRefresh := signLegacyToken(t, secret, Claims{
		UID: 1, UserID: userID, TokenType: TypeRefresh,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			// ID empty → missing jti
		},
	})
	if _, err := manager.ValidateRefreshToken(badRefresh); err == nil {
		t.Fatal("typed refresh without jti accepted")
	}
}

func TestJWTManagerGeneratePairRoundTrip(t *testing.T) {
	manager := NewManager(&config.Config{
		JWTSecret:          "pair-secret",
		JWTAccessTokenTTL:  10,
		JWTRefreshTokenTTL: 30,
	}, zap.NewNop())
	userID := uuid.New().String()
	pair, err := manager.Generate(3, userID, "staff")
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	ac, err := manager.ValidateAccessToken(pair.Access)
	if err != nil || ac.Role != "staff" || ac.UID != 3 {
		t.Fatalf("access claims = %+v err=%v", ac, err)
	}
	rc, err := manager.ValidateRefreshToken(pair.Refresh)
	if err != nil || rc.ID == "" {
		t.Fatalf("refresh claims = %+v err=%v", rc, err)
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

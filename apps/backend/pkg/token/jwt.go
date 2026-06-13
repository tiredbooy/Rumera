package token

import (
	"fmt"
	"log"
	"time"

	"github.com/golang-jwt/jwt/v4"
	"github.com/google/uuid"
	config "github.com/tiredbooy/configs"
	"go.uber.org/zap"
)

type JWTManager struct {
	secret string

	AccessTTL  time.Duration
	RefreshTTL time.Duration
}

func NewManager(cfg *config.Config, log *zap.Logger) *JWTManager {
	return &JWTManager{
		secret:     cfg.JWTSecret,
		AccessTTL:  time.Duration(cfg.JWTAccessTokenTTL) * time.Minute,
		RefreshTTL: time.Duration(cfg.JWTRefreshTokenTTL) * time.Minute,
	}
}

func (m *JWTManager) GenerateAccessToken(uid int64, userID, role string) (string, error) {
	accessClaims := Claims{
		UID:    uid,
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(m.AccessTTL)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	access := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessToken, err := access.SignedString([]byte(m.secret))
	if err != nil {
		return "", err
	}

	return accessToken, nil
}

func (m *JWTManager) GenerateRefreshToken(uid int64, userID string) (string, error) {
	claims := Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        uuid.New().String(),
			Subject:   userID,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(m.RefreshTTL)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
		UID:    uid,
		UserID: userID,
		Role:   "",
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(m.secret))
}

func (m *JWTManager) Generate(uid int64, userID, role string) (TokenPair, error) {
	accessTok, err := m.GenerateAccessToken(uid, userID, role)
	if err != nil {
		log.Println("Failed to Generate access token")
		return TokenPair{}, err
	}

	refreshTok, err := m.GenerateRefreshToken(uid, userID)
	if err != nil {
		log.Println("Failed to generate refresh token")
		return TokenPair{}, err
	}

	return TokenPair{
		Access:  accessTok,
		Refresh: refreshTok,
	}, nil
}

func (m *JWTManager) ValidateAccessToken(token string) (*Claims, error) {
	parsed, err := jwt.ParseWithClaims(token, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(m.secret), nil // ← []byte here
	})

	if err != nil {
		return &Claims{}, err
	}

	if !parsed.Valid {
		return &Claims{}, fmt.Errorf("Invalid token: %w", err)
	}

	claims, ok := parsed.Claims.(*Claims)
	if !ok {
		return nil, fmt.Errorf("invalid token claims")
	}
	return claims, nil
}

func (m *JWTManager) ValidateRefreshToken(tokenStr string) (*Claims, error) {
	parsed, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(m.secret), nil
	})
	if err != nil {
		return nil, fmt.Errorf("invalid refresh token: %w", err)
	}

	if !parsed.Valid {
		return nil, fmt.Errorf("refresh token is not valid")
	}

	claims, ok := parsed.Claims.(*Claims)
	if !ok {
		return nil, fmt.Errorf("invalid refresh token claims")
	}

	// jti must be present — refresh tokens without an ID can't be rotated
	if claims.ID == "" {
		return nil, fmt.Errorf("refresh token missing jti")
	}

	return claims, nil
}

var _ Manager = (*JWTManager)(nil)

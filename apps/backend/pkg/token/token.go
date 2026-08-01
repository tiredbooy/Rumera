package token

import "github.com/golang-jwt/jwt/v4"

// 1. claims 2. token pair  3. manager

type Manager interface {
	Generate(uid int64, userID, role string) (TokenPair, error)
	GenerateAccessToken(uid int64, userID, role string) (string, error)
	GenerateRefreshToken(uid int64, userID string) (string, error)
	ValidateAccessToken(token string) (*Claims, error)
	ValidateRefreshToken(token string) (*Claims, error)
}

type TokenPair struct {
	Refresh string
	Access  string
}

type Type string

const (
	TypeAccess  Type = "access"
	TypeRefresh Type = "refresh"
)

// Claims carries both the internal numeric user id (UID → users.id, the fast
// path used by most user-scoped services) and the public UUID (UserID →
// users.user_id) so handlers never need an extra DB round-trip to resolve one
// from the other.
type Claims struct {
	jwt.RegisteredClaims        // embeds exp, iat, jti — standard fields
	UID                  int64  `json:"uid"`
	UserID               string `json:"user_id"`
	Role                 string `json:"role"`
	TokenType            Type   `json:"token_type,omitempty"`
}

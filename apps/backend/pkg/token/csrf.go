package token

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
)

const csrfTokenBytes = 32 // 256 bits

func GenerateCSRF() (string, error) {
	b := make([]byte, csrfTokenBytes)

	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate csrf token: %w", err)
	}

	return hex.EncodeToString(b), nil
}

func ValidateCSRF(provided, stored string) bool {
	if provided == "" || stored == "" {
		return false
	}

	return subtle.ConstantTimeCompare(
		[]byte(provided),
		[]byte(stored),
	) == 1
}

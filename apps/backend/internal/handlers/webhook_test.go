package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"testing"
)

func sign(body []byte, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}

func TestValidSignature(t *testing.T) {
	body := []byte(`{"transaction_id":"abc","status":"succeeded"}`)
	secret := "whsec_test"

	tests := []struct {
		name     string
		provided string
		want     bool
	}{
		{"valid", sign(body, secret), true},
		{"empty", "", false},
		{"wrong secret", sign(body, "other"), false},
		{"tampered", sign([]byte(`{"transaction_id":"abc","status":"failed"}`), secret), false},
		{"garbage", "not-hex", false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := validSignature(body, tc.provided, secret); got != tc.want {
				t.Fatalf("validSignature(%q) = %v, want %v", tc.name, got, tc.want)
			}
		})
	}
}

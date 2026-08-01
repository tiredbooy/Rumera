package crypto

import (
	"strings"
	"testing"
)

func TestPasswordFitsBcryptUsesUTF8Bytes(t *testing.T) {
	if !PasswordFitsBcrypt(strings.Repeat("a", BcryptMaxPasswordBytes)) {
		t.Fatal("72-byte ASCII password was rejected")
	}
	if PasswordFitsBcrypt(strings.Repeat("a", BcryptMaxPasswordBytes+1)) {
		t.Fatal("73-byte ASCII password was accepted")
	}
	if PasswordFitsBcrypt(strings.Repeat("آ", 37)) {
		t.Fatal("74-byte UTF-8 password was accepted")
	}
}

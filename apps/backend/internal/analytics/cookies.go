package analytics

import (
	"net/http"
	"time"

	"github.com/google/uuid"
)

const (
	SessionCookieName = "sid"
	DeviceCookieName  = "did"
	CookieTTL         = 365 * 24 * time.Hour
)

// VisitorIDs are the session/device UUIDs attached to a captured event.
// Issued holds the Set-Cookie values the caller must write so the browser
// keeps the same IDs. The BFF must copy those cookies; it must not mint IDs.
type VisitorIDs struct {
	SessionID uuid.UUID
	DeviceID  uuid.UUID
	Issued    []http.Cookie
}

// ParseCookieID returns the UUID when raw is a valid UUID string.
// Empty or malformed values yield uuid.Nil, false. It never invents an ID.
func ParseCookieID(raw string) (uuid.UUID, bool) {
	if raw == "" {
		return uuid.Nil, false
	}
	id, err := uuid.Parse(raw)
	if err != nil {
		return uuid.Nil, false
	}
	return id, true
}

// Cookie is the Set-Cookie spec for sid/did. Secure is true in production.
func Cookie(name string, id uuid.UUID, secure bool) http.Cookie {
	return http.Cookie{
		Name:     name,
		Value:    id.String(),
		Path:     "/",
		MaxAge:   int(CookieTTL.Seconds()),
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
	}
}

// ResolveVisitorIDs reuses valid incoming sid/did cookies. Missing or
// malformed values are minted once and included in Issued so the caller can
// persist them. Present valid IDs are never replaced.
func ResolveVisitorIDs(sidRaw, didRaw string, secure bool) VisitorIDs {
	sessionID := resolveOrMint(sidRaw)
	deviceID := resolveOrMint(didRaw)
	return VisitorIDs{
		SessionID: sessionID,
		DeviceID:  deviceID,
		Issued: []http.Cookie{
			Cookie(SessionCookieName, sessionID, secure),
			Cookie(DeviceCookieName, deviceID, secure),
		},
	}
}

func resolveOrMint(raw string) uuid.UUID {
	if id, ok := ParseCookieID(raw); ok {
		return id
	}
	return uuid.New()
}

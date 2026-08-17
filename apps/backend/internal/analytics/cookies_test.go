package analytics

import (
	"net/http"
	"testing"

	"github.com/google/uuid"
)

func TestParseCookieIDDoesNotInvent(t *testing.T) {
	t.Parallel()

	if id, ok := ParseCookieID(""); ok || id != uuid.Nil {
		t.Fatalf("empty: got %v %v; want Nil false", id, ok)
	}
	if id, ok := ParseCookieID("not-a-uuid"); ok || id != uuid.Nil {
		t.Fatalf("malformed: got %v %v; want Nil false", id, ok)
	}

	want := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	got, ok := ParseCookieID(want.String())
	if !ok || got != want {
		t.Fatalf("valid: got %v %v; want %v true", got, ok, want)
	}
}

func TestResolveVisitorIDsReusesPresentCookies(t *testing.T) {
	t.Parallel()

	sid := uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	did := uuid.MustParse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")

	got := ResolveVisitorIDs(sid.String(), did.String(), true)
	if got.SessionID != sid {
		t.Fatalf("session = %s, want %s (must not invent)", got.SessionID, sid)
	}
	if got.DeviceID != did {
		t.Fatalf("device = %s, want %s (must not invent)", got.DeviceID, did)
	}
	assertIssuedCookie(t, got.Issued, SessionCookieName, sid.String(), true)
	assertIssuedCookie(t, got.Issued, DeviceCookieName, did.String(), true)
}

func TestResolveVisitorIDsMintsOnlyWhenMissing(t *testing.T) {
	t.Parallel()

	sid := uuid.MustParse("cccccccc-cccc-cccc-cccc-cccccccccccc")
	got := ResolveVisitorIDs(sid.String(), "", false)
	if got.SessionID != sid {
		t.Fatalf("present sid replaced: %s", got.SessionID)
	}
	if got.DeviceID == uuid.Nil {
		t.Fatal("missing did was not minted")
	}
	assertIssuedCookie(t, got.Issued, SessionCookieName, sid.String(), false)
	assertIssuedCookie(t, got.Issued, DeviceCookieName, got.DeviceID.String(), false)
}

func TestCookieAttributes(t *testing.T) {
	t.Parallel()

	id := uuid.MustParse("dddddddd-dddd-dddd-dddd-dddddddddddd")
	ck := Cookie(SessionCookieName, id, true)
	if ck.Name != SessionCookieName || ck.Value != id.String() {
		t.Fatalf("cookie identity = %s=%s", ck.Name, ck.Value)
	}
	if !ck.HttpOnly {
		t.Fatal("cookie must be HttpOnly")
	}
	if !ck.Secure {
		t.Fatal("production cookie must be Secure")
	}
	if ck.Path != "/" {
		t.Fatalf("path = %q, want /", ck.Path)
	}
	if ck.SameSite != http.SameSiteLaxMode {
		t.Fatalf("samesite = %v, want Lax", ck.SameSite)
	}
	if ck.MaxAge != int(CookieTTL.Seconds()) {
		t.Fatalf("max-age = %d, want %d", ck.MaxAge, int(CookieTTL.Seconds()))
	}

	dev := Cookie(DeviceCookieName, id, false)
	if dev.Secure {
		t.Fatal("non-production cookie must not be Secure")
	}
}

func assertIssuedCookie(t *testing.T, cookies []http.Cookie, name, value string, secure bool) {
	t.Helper()
	for _, ck := range cookies {
		if ck.Name != name {
			continue
		}
		if ck.Value != value {
			t.Fatalf("%s value = %q, want %q", name, ck.Value, value)
		}
		if ck.Secure != secure {
			t.Fatalf("%s secure = %v, want %v", name, ck.Secure, secure)
		}
		if !ck.HttpOnly || ck.Path != "/" || ck.SameSite != http.SameSiteLaxMode {
			t.Fatalf("%s attributes = %+v", name, ck)
		}
		return
	}
	t.Fatalf("missing issued cookie %s", name)
}

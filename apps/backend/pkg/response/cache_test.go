package response

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func init() { gin.SetMode(gin.TestMode) }

func newCtx(ifNoneMatch string) (*gin.Context, *httptest.ResponseRecorder) {
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	if ifNoneMatch != "" {
		req.Header.Set("If-None-Match", ifNoneMatch)
	}
	c.Request = req
	return c, rec
}

func TestCachedJSON_SetsHeadersAndBody(t *testing.T) {
	c, rec := newCtx("")
	data := json.RawMessage(`{"id":1}`)

	CachedJSON(c, data, 60*time.Second)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if got := rec.Header().Get("Cache-Control"); got != "public, max-age=60" {
		t.Errorf("Cache-Control = %q, want %q", got, "public, max-age=60")
	}
	if rec.Header().Get("ETag") == "" {
		t.Error("ETag header is empty")
	}
	// Body is wrapped in the standard envelope.
	if want := `{"data":{"id":1}}`; rec.Body.String() != want {
		t.Errorf("body = %q, want %q", rec.Body.String(), want)
	}
}

func TestCachedJSON_NotModifiedOnMatch(t *testing.T) {
	data := json.RawMessage(`{"id":1}`)

	// First request: capture the ETag the server assigns.
	c1, rec1 := newCtx("")
	CachedJSON(c1, data, 60*time.Second)
	etag := rec1.Header().Get("ETag")

	// Second request echoes the ETag back -> expect a bodyless 304.
	c2, rec2 := newCtx(etag)
	CachedJSON(c2, data, 60*time.Second)

	if rec2.Code != http.StatusNotModified {
		t.Fatalf("status = %d, want 304", rec2.Code)
	}
	if rec2.Body.Len() != 0 {
		t.Errorf("304 response carried a body: %q", rec2.Body.String())
	}
	if rec2.Header().Get("ETag") != etag {
		t.Errorf("304 ETag = %q, want %q", rec2.Header().Get("ETag"), etag)
	}
}

func TestCachedJSON_ChangedPayloadDoesNotMatch(t *testing.T) {
	c1, rec1 := newCtx("")
	CachedJSON(c1, json.RawMessage(`{"id":1}`), 60*time.Second)
	oldETag := rec1.Header().Get("ETag")

	// Stale client ETag against new content -> full 200, fresh ETag.
	c2, rec2 := newCtx(oldETag)
	CachedJSON(c2, json.RawMessage(`{"id":2}`), 60*time.Second)

	if rec2.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec2.Code)
	}
	if rec2.Header().Get("ETag") == oldETag {
		t.Error("ETag did not change when payload changed")
	}
}

func TestRevalidateJSON_NoCacheDirective(t *testing.T) {
	c, rec := newCtx("")
	RevalidateJSON(c, json.RawMessage(`{"slug":"x"}`))

	if got := rec.Header().Get("Cache-Control"); got != "no-cache" {
		t.Errorf("Cache-Control = %q, want %q", got, "no-cache")
	}
	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", rec.Code)
	}
}

func TestEtagMatches(t *testing.T) {
	etag := `"abc"`
	cases := []struct {
		header string
		want   bool
	}{
		{`"abc"`, true},
		{`*`, true},
		{`W/"abc"`, true},
		{`"zzz", "abc"`, true},
		{`"zzz"`, false},
		{``, false},
	}
	for _, tc := range cases {
		if got := etagMatches(tc.header, etag); got != tc.want {
			t.Errorf("etagMatches(%q, %q) = %v, want %v", tc.header, etag, got, tc.want)
		}
	}
}

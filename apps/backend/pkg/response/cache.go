package response

import (
	"encoding/json"
	"hash/fnv"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// CachedJSON writes data in the standard envelope with HTTP caching headers for a
// publicly cacheable resource: a strong ETag plus Cache-Control: public,
// max-age=<ttl>. On a matching If-None-Match it returns 304 Not Modified with no
// body. Within max-age clients and shared caches may serve the resource without
// contacting the server, so use it only for responses with NO per-request side
// effects (e.g. product detail, category tree).
//
// data is the already-marshalled payload (the json.RawMessage produced by the
// read-through cache helper). The envelope wrapped around it is deterministic, so
// hashing data alone is a sound representation key.
func CachedJSON(c *gin.Context, data json.RawMessage, ttl time.Duration) {
	writeWithETag(c, data, "public, max-age="+strconv.Itoa(int(ttl.Seconds())))
}

// RevalidateJSON writes data in the standard envelope with a strong ETag and
// Cache-Control: no-cache, forcing clients to revalidate on every request. On a
// matching If-None-Match it returns 304 (saving the response body) while still
// letting the handler run its per-request work. Used by endpoints that have a
// side effect on every GET — e.g. the recipe endpoint, which counts a view and
// therefore must always be reached by the request.
func RevalidateJSON(c *gin.Context, data json.RawMessage) {
	writeWithETag(c, data, "no-cache")
}

func writeWithETag(c *gin.Context, data json.RawMessage, cacheControl string) {
	etag := etagFor(data)
	c.Header("ETag", etag)
	c.Header("Cache-Control", cacheControl)

	if inm := c.GetHeader("If-None-Match"); inm != "" && etagMatches(inm, etag) {
		// AbortWithStatus (not Status) flushes the header immediately for this
		// bodyless response, rather than relying on the engine to finalise it.
		c.AbortWithStatus(http.StatusNotModified)
		return
	}
	OK(c, data)
}

// etagFor returns a strong ETag (a quoted hash) for the response payload. FNV-1a
// 64-bit is non-cryptographic but ample for cache validation: a collision would
// merely serve a stale 304, and the odds across one resource's revisions are
// ~1/2^64.
func etagFor(b []byte) string {
	h := fnv.New64a()
	_, _ = h.Write(b)
	return `"` + strconv.FormatUint(h.Sum64(), 16) + `"`
}

// etagMatches reports whether the If-None-Match header covers etag. The header may
// be "*", or a comma-separated list of validators (each possibly weak, "W/").
func etagMatches(header, etag string) bool {
	header = strings.TrimSpace(header)
	if header == "*" {
		return true
	}
	for tok := range strings.SplitSeq(header, ",") {
		tok = strings.TrimSpace(tok)
		tok = strings.TrimPrefix(tok, "W/")
		if tok == etag {
			return true
		}
	}
	return false
}

package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// DefaultJSONBodyLimit is the max body size for JSON and other non-multipart
// requests. Multipart uploads (media) use MultipartBodyLimit instead.
const DefaultJSONBodyLimit int64 = 1 << 20 // 1 MiB

// DefaultMultipartBodyLimit covers product image uploads (default 15 MiB file
// plus multipart framing overhead). Keep this >= MEDIA_MAX_UPLOAD_MB + 1 MiB.
const DefaultMultipartBodyLimit int64 = 17 << 20 // 17 MiB

// MaxBodySize rejects request bodies larger than the configured limits so
// oversized payloads fail before JSON unmarshalling or multipart parsing
// allocates unbounded memory. Content-Type selects the limit: multipart forms
// get the higher cap; everything else uses the JSON limit.
func MaxBodySize(jsonLimit, multipartLimit int64) gin.HandlerFunc {
	if jsonLimit <= 0 {
		jsonLimit = DefaultJSONBodyLimit
	}
	if multipartLimit <= 0 {
		multipartLimit = DefaultMultipartBodyLimit
	}
	return func(c *gin.Context) {
		if c.Request.Body == nil {
			c.Next()
			return
		}
		limit := jsonLimit
		ct := c.GetHeader("Content-Type")
		if strings.HasPrefix(strings.ToLower(ct), "multipart/") {
			limit = multipartLimit
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, limit)
		c.Next()
	}
}

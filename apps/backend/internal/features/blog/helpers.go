package blog

import (
	"strings"
	"time"
	"unicode"
)

// publicLivePublishedAtSQL is the storefront schedule window. A published post
// with a future published_at stays hidden until that stamp. NULL means already
// live (legacy rows that never received a schedule).
func publicLivePublishedAtSQL(column string) string {
	return "(" + column + " IS NULL OR " + column + " <= NOW())"
}

func isPubliclyLive(status BlogStatus, publishedAt *time.Time, now time.Time) bool {
	if status != BlogStatusPublished {
		return false
	}
	return publishedAt == nil || !publishedAt.After(now)
}

func applyPublicListFilter(f *BlogFilter) {
	published := BlogStatusPublished
	f.Status = &published
	f.LiveOnly = true
}

func nullableArg[T any](value *T) any {
	if value == nil {
		return nil
	}
	return *value
}

func escapeLikePattern(value string) string {
	replacer := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)
	return replacer.Replace(value)
}

// slugify mirrors the shared content slug helper used by journal posts.
func slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	var b strings.Builder
	prevHyphen := false
	for _, r := range s {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
			prevHyphen = false
			continue
		}
		if r == ' ' || r == '-' || r == '_' {
			if !prevHyphen && b.Len() > 0 {
				b.WriteByte('-')
				prevHyphen = true
			}
		}
	}
	out := b.String()
	return strings.Trim(out, "-")
}

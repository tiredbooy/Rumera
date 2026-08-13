package product

import (
	"strings"
	"unicode"
)

func normalizePublicSlug(value string) string {
	var slug strings.Builder
	separator := false
	for _, r := range strings.ToLower(strings.TrimSpace(value)) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			if separator && slug.Len() > 0 {
				slug.WriteByte('-')
			}
			slug.WriteRune(r)
			separator = false
			continue
		}
		if slug.Len() > 0 {
			separator = true
		}
	}
	return slug.String()
}

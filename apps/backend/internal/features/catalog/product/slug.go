package product

import (
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/tiredbooy/pkg/apperr"
)

const maxProductSlugRunes = 255

const (
	errMsgActiveProductNeedsSlug = "slug is required when the product is active"
	errMsgInvalidPublicSlug      = "must be a valid public slug"
	errMsgProductSlugTooLong     = "must be at most 255 characters"
)

// normalizePublicSlug keeps Unicode letters and digits while collapsing every
// separator into one hyphen, producing a stable single URL path segment.
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

// normalizeProductSlug slugifies a submitted product slug. Missing or
// whitespace-only input stays nil so callers can decide whether an active
// product may omit one. Content that does not yield a path segment is 422.
func normalizeProductSlug(value *string) (*string, error) {
	if value == nil || strings.TrimSpace(*value) == "" {
		return nil, nil
	}
	slug := normalizePublicSlug(*value)
	if slug == "" {
		return nil, productSlugFieldError(errMsgInvalidPublicSlug)
	}
	if utf8.RuneCountInString(slug) > maxProductSlugRunes {
		return nil, productSlugFieldError(errMsgProductSlugTooLong)
	}
	return &slug, nil
}

func errActiveProductNeedsSlug() error {
	return productSlugFieldError(errMsgActiveProductNeedsSlug)
}

func productSlugFieldError(message string) error {
	return apperr.WithFields(apperr.ErrValidation, map[string][]string{
		"slug": {message},
	})
}

func storedProductHasSlug(value *string) bool {
	return value != nil && strings.TrimSpace(*value) != ""
}

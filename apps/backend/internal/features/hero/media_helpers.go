package hero

import (
	"net/url"
	"strings"
	"unicode/utf8"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

// Local copies of media URL helpers used by hero validation. When the media
// feature is extracted, prefer importing a shared package instead.

const maxImageAltLength = 255

func sameMediaURL(left, right *string) bool {
	if left == nil || right == nil {
		return left == nil && right == nil
	}
	return *left == *right
}

func normalizeExternalImageURL(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" || len(value) > 2048 || strings.ContainsRune(value, '#') {
		return "", apperr.ErrInvalidRequest
	}
	parsed, err := url.ParseRequestURI(value)
	if err != nil || parsed.User != nil || parsed.Fragment != "" {
		return "", apperr.ErrInvalidRequest
	}
	if strings.ContainsRune(value, '\\') {
		return "", apperr.ErrInvalidRequest
	}
	if strings.HasPrefix(value, "/") {
		if strings.HasPrefix(value, "//") || strings.HasPrefix(value, "/media/") {
			return "", apperr.ErrInvalidRequest
		}
		return value, nil
	}
	if parsed.Scheme != "https" || parsed.Host == "" {
		return "", apperr.ErrInvalidRequest
	}
	return value, nil
}

func normalizeCreateMediaURL(value **string) error {
	if *value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(**value)
	if trimmed == "" {
		*value = nil
		return nil
	}
	normalized, err := normalizeExternalImageURL(trimmed)
	if err != nil {
		return apperr.ErrInvalidRequest
	}
	*value = &normalized
	return nil
}

func normalizeMediaURLPatch(
	patch *models.NullablePatch[string],
	current *string,
) error {
	if !patch.Set || patch.Value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*patch.Value)
	if trimmed == "" {
		patch.Value = nil
		return nil
	}
	if strings.HasPrefix(trimmed, "/media/") {
		if current == nil || strings.TrimSpace(*current) != trimmed {
			return apperr.ErrInvalidRequest
		}
		patch.Set = false
		patch.Value = nil
		return nil
	}
	normalized, err := normalizeExternalImageURL(trimmed)
	if err != nil {
		return apperr.ErrInvalidRequest
	}
	patch.Value = &normalized
	return nil
}

func normalizeCreateImageAlt(value **string) error {
	if *value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(**value)
	if trimmed == "" {
		*value = nil
		return nil
	}
	if utf8.RuneCountInString(trimmed) > maxImageAltLength {
		return apperr.ErrInvalidRequest
	}
	*value = &trimmed
	return nil
}

func normalizeImageAltPatch(patch *models.NullablePatch[string]) error {
	if !patch.Set || patch.Value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*patch.Value)
	if trimmed == "" {
		patch.Value = nil
		return nil
	}
	if utf8.RuneCountInString(trimmed) > maxImageAltLength {
		return apperr.ErrInvalidRequest
	}
	patch.Value = &trimmed
	return nil
}

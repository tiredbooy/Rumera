package services

import (
	"strings"
	"unicode/utf8"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

const maxImageAltLength = 255

func mediaExpectation(current *string) models.NullablePatch[string] {
	if current == nil {
		return models.NullablePatch[string]{Set: true}
	}
	value := *current
	return models.NullablePatch[string]{Set: true, Value: &value}
}

// normalizeCreateMediaURL accepts external/static media only. Canonical
// /media/... values must be produced by an owner-aware upload so a storage key
// can be persisted with the URL.
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

// normalizeMediaURLPatch turns an existing canonical local URL into an omitted
// patch. This preserves its server-owned key and prevents a stale round-trip
// value from overwriting a newer owner-aware attachment.
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

func normalizeProductImageAlt(value *string) (*string, error) {
	copy := value
	if err := normalizeCreateImageAlt(&copy); err != nil {
		return nil, err
	}
	return copy, nil
}

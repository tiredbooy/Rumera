package hero

import (
	"net/url"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

const (
	maxHeroTitleLength = 255
	maxHeroLabelLength = 120
	maxHeroHrefLength  = 255
)

func normalizeAndValidateHeroSlideCreate(req *HeroSlideReq) error {
	fields := make(map[string][]string)

	req.Title = strings.TrimSpace(req.Title)
	normalizeHeroOptionalString(&req.Eyebrow)
	normalizeHeroOptionalString(&req.Subtitle)
	normalizeHeroOptionalString(&req.Badge)
	normalizeHeroOptionalString(&req.CTALabel)
	normalizeHeroOptionalString(&req.CTAHref)
	normalizeHeroOptionalString(&req.SecondaryCTALabel)
	normalizeHeroOptionalString(&req.SecondaryCTAHref)
	normalizeHeroOptionalTime(&req.StartsAt)
	normalizeHeroOptionalTime(&req.EndsAt)
	if req.Theme != nil {
		trimmed := strings.TrimSpace(*req.Theme)
		req.Theme = &trimmed
	}

	if err := normalizeCreateMediaURL(&req.ImageURL); err != nil {
		addHeroFieldError(fields, "image_url", "must be a supported root-relative path or absolute HTTPS URL")
	}
	if err := normalizeCreateMediaURL(&req.MobileImageURL); err != nil {
		addHeroFieldError(fields, "mobile_image_url", "must be a supported root-relative path or absolute HTTPS URL")
	}
	if err := normalizeCreateImageAlt(&req.ImageAlt); err != nil {
		addHeroFieldError(fields, "image_alt", "must be at most 255 characters")
	}

	theme := "dark"
	if req.Theme != nil {
		theme = *req.Theme
	}
	active := true
	if req.IsActive != nil {
		active = *req.IsActive
	}
	validateHeroSlideState(&HeroSlide{
		Eyebrow:           req.Eyebrow,
		Title:             req.Title,
		Subtitle:          req.Subtitle,
		Badge:             req.Badge,
		ImageURL:          req.ImageURL,
		MobileImageURL:    req.MobileImageURL,
		ImageAlt:          req.ImageAlt,
		CTALabel:          req.CTALabel,
		CTAHref:           req.CTAHref,
		SecondaryCTALabel: req.SecondaryCTALabel,
		SecondaryCTAHref:  req.SecondaryCTAHref,
		Theme:             theme,
		IsActive:          active,
		StartsAt:          req.StartsAt,
		EndsAt:            req.EndsAt,
	}, fields)
	return heroSlideValidationError(fields)
}

func normalizeAndValidateHeroSlideUpdate(
	req *HeroSlideUpdateReq,
	current *HeroSlide,
) error {
	fields := make(map[string][]string)

	if req.Title != nil {
		trimmed := strings.TrimSpace(*req.Title)
		req.Title = &trimmed
	}
	normalizeHeroStringPatch(&req.Eyebrow)
	normalizeHeroStringPatch(&req.Subtitle)
	normalizeHeroStringPatch(&req.Badge)
	normalizeHeroStringPatch(&req.CTALabel)
	normalizeHeroStringPatch(&req.CTAHref)
	normalizeHeroStringPatch(&req.SecondaryCTALabel)
	normalizeHeroStringPatch(&req.SecondaryCTAHref)
	normalizeHeroTimePatch(&req.StartsAt)
	normalizeHeroTimePatch(&req.EndsAt)
	if req.Theme != nil {
		trimmed := strings.TrimSpace(*req.Theme)
		req.Theme = &trimmed
	}

	if err := normalizeMediaURLPatch(&req.ImageURL, current.ImageURL); err != nil {
		addHeroFieldError(fields, "image_url", "must preserve the current local media URL, clear it, or use a supported external URL")
	}
	if err := normalizeMediaURLPatch(&req.MobileImageURL, current.MobileImageURL); err != nil {
		addHeroFieldError(fields, "mobile_image_url", "must preserve the current local media URL, clear it, or use a supported external URL")
	}
	if err := normalizeImageAltPatch(&req.ImageAlt); err != nil {
		addHeroFieldError(fields, "image_alt", "must be at most 255 characters")
	}

	merged := *current
	merged.Eyebrow = heroPatchedValue(current.Eyebrow, req.Eyebrow)
	if req.Title != nil {
		merged.Title = *req.Title
	}
	merged.Subtitle = heroPatchedValue(current.Subtitle, req.Subtitle)
	merged.Badge = heroPatchedValue(current.Badge, req.Badge)
	merged.ImageURL = heroPatchedValue(current.ImageURL, req.ImageURL)
	merged.MobileImageURL = heroPatchedValue(current.MobileImageURL, req.MobileImageURL)
	merged.ImageAlt = heroPatchedValue(current.ImageAlt, req.ImageAlt)
	merged.CTALabel = heroPatchedValue(current.CTALabel, req.CTALabel)
	merged.CTAHref = heroPatchedValue(current.CTAHref, req.CTAHref)
	merged.SecondaryCTALabel = heroPatchedValue(current.SecondaryCTALabel, req.SecondaryCTALabel)
	merged.SecondaryCTAHref = heroPatchedValue(current.SecondaryCTAHref, req.SecondaryCTAHref)
	if req.Theme != nil {
		merged.Theme = *req.Theme
	}
	if req.SortOrder != nil {
		merged.SortOrder = *req.SortOrder
	}
	if req.IsActive != nil {
		merged.IsActive = *req.IsActive
	}
	merged.StartsAt = heroPatchedValue(current.StartsAt, req.StartsAt)
	merged.EndsAt = heroPatchedValue(current.EndsAt, req.EndsAt)

	validateHeroSlideState(&merged, fields)
	return heroSlideValidationError(fields)
}

func validateHeroSlideState(slide *HeroSlide, fields map[string][]string) {
	title := strings.TrimSpace(slide.Title)
	if title == "" {
		addHeroFieldError(fields, "title", "must not be blank")
	} else if utf8.RuneCountInString(title) > maxHeroTitleLength {
		addHeroFieldError(fields, "title", "must be at most 255 characters")
	}
	validateHeroOptionalLength(fields, "eyebrow", slide.Eyebrow, maxHeroLabelLength)
	validateHeroOptionalLength(fields, "badge", slide.Badge, maxHeroLabelLength)
	validateHeroOptionalLength(fields, "cta_label", slide.CTALabel, maxHeroLabelLength)
	validateHeroOptionalLength(fields, "cta_href", slide.CTAHref, maxHeroHrefLength)
	validateHeroOptionalLength(fields, "secondary_cta_label", slide.SecondaryCTALabel, maxHeroLabelLength)
	validateHeroOptionalLength(fields, "secondary_cta_href", slide.SecondaryCTAHref, maxHeroHrefLength)

	validateHeroCTAPair(fields, "cta_label", slide.CTALabel, "cta_href", slide.CTAHref)
	validateHeroCTAPair(
		fields,
		"secondary_cta_label", slide.SecondaryCTALabel,
		"secondary_cta_href", slide.SecondaryCTAHref,
	)
	if slide.CTAHref != nil && !validHeroHref(*slide.CTAHref) {
		addHeroFieldError(fields, "cta_href", "must be a single-slash root-relative path or an absolute HTTPS URL without credentials")
	}
	if slide.SecondaryCTAHref != nil && !validHeroHref(*slide.SecondaryCTAHref) {
		addHeroFieldError(fields, "secondary_cta_href", "must be a single-slash root-relative path or an absolute HTTPS URL without credentials")
	}
	if slide.Theme != "light" && slide.Theme != "dark" {
		addHeroFieldError(fields, "theme", "must be one of: light dark")
	}
	if slide.StartsAt != nil && slide.EndsAt != nil && !slide.EndsAt.After(*slide.StartsAt) {
		addHeroFieldError(fields, "ends_at", "must be after starts_at")
	}
	if slide.IsActive && !hasHeroImage(slide.ImageURL) {
		addHeroFieldError(fields, "image_url", "is required when is_active is true")
	}
}

func validateHeroCTAPair(
	fields map[string][]string,
	labelField string,
	label *string,
	hrefField string,
	href *string,
) {
	labelPresent := hasHeroText(label)
	hrefPresent := hasHeroText(href)
	if labelPresent && !hrefPresent {
		addHeroFieldError(fields, hrefField, "is required when "+labelField+" is set")
	}
	if hrefPresent && !labelPresent {
		addHeroFieldError(fields, labelField, "is required when "+hrefField+" is set")
	}
}

func validHeroHref(value string) bool {
	value = strings.TrimSpace(value)
	decoded, err := url.PathUnescape(value)
	if err != nil || value == "" || strings.ContainsRune(decoded, '\\') {
		return false
	}
	for _, r := range decoded {
		if unicode.IsControl(r) {
			return false
		}
	}

	parsed, err := url.Parse(value)
	if err != nil {
		return false
	}
	if strings.HasPrefix(value, "/") {
		return !strings.HasPrefix(decoded, "//") && parsed.Scheme == "" && parsed.Host == ""
	}
	return strings.EqualFold(parsed.Scheme, "https") && parsed.Hostname() != "" && parsed.User == nil
}

func normalizeHeroOptionalString(value **string) {
	if *value == nil {
		return
	}
	trimmed := strings.TrimSpace(**value)
	if trimmed == "" {
		*value = nil
		return
	}
	*value = &trimmed
}

func normalizeHeroOptionalTime(value **time.Time) {
	if *value == nil {
		return
	}
	normalized := (*value).Truncate(time.Microsecond)
	*value = &normalized
}

func normalizeHeroTimePatch(value *models.NullablePatch[time.Time]) {
	if !value.Set || value.Value == nil {
		return
	}
	normalized := value.Value.Truncate(time.Microsecond)
	value.Value = &normalized
}

func normalizeHeroStringPatch(patch *models.NullablePatch[string]) {
	if !patch.Set || patch.Value == nil {
		return
	}
	trimmed := strings.TrimSpace(*patch.Value)
	if trimmed == "" {
		patch.Value = nil
		return
	}
	patch.Value = &trimmed
}

func heroPatchedValue[T any](current *T, patch models.NullablePatch[T]) *T {
	if patch.Set {
		return patch.Value
	}
	return current
}

func validateHeroOptionalLength(fields map[string][]string, field string, value *string, max int) {
	if value != nil && utf8.RuneCountInString(*value) > max {
		addHeroFieldError(fields, field, "must be at most "+strconv.Itoa(max)+" characters")
	}
}

func hasHeroText(value *string) bool {
	return value != nil && strings.TrimSpace(*value) != ""
}

func addHeroFieldError(fields map[string][]string, field, message string) {
	fields[field] = append(fields[field], message)
}

func heroSlideValidationError(fields map[string][]string) error {
	if len(fields) == 0 {
		return nil
	}
	return apperr.WithFields(apperr.ErrValidation, fields)
}

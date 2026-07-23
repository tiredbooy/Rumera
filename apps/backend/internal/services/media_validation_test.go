package services

import (
	"errors"
	"strings"
	"testing"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

func TestNormalizeCreateMediaURL(t *testing.T) {
	tests := []struct {
		name    string
		value   *string
		want    *string
		wantErr bool
	}{
		{name: "missing"},
		{name: "blank", value: stringPointer("  ")},
		{name: "external", value: stringPointer(" https://images.example/cover.webp "), want: stringPointer("https://images.example/cover.webp")},
		{name: "static", value: stringPointer(" /images/cover.webp "), want: stringPointer("/images/cover.webp")},
		{name: "canonical local needs key", value: stringPointer("/media/recipes/1/cover.webp"), wantErr: true},
		{name: "unsafe scheme", value: stringPointer("javascript:alert(1)"), wantErr: true},
		{name: "backslash authority bypass", value: stringPointer(`/\\images.example/cover.webp`), wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			value := tt.value
			err := normalizeCreateMediaURL(&value)
			if tt.wantErr {
				if !errors.Is(err, apperr.ErrInvalidRequest) {
					t.Fatalf("error = %v; want invalid request", err)
				}
				return
			}
			if err != nil {
				t.Fatalf("normalizeCreateMediaURL: %v", err)
			}
			if !equalStringPointers(value, tt.want) {
				t.Fatalf("value = %v; want %v", value, tt.want)
			}
		})
	}
}

func TestNormalizeMediaURLPatch(t *testing.T) {
	canonical := "/media/recipes/9/cover-owned.webp"
	unchanged := models.NullablePatch[string]{Set: true, Value: stringPointer(" " + canonical + " ")}
	if err := normalizeMediaURLPatch(&unchanged, &canonical); err != nil {
		t.Fatalf("unchanged canonical URL: %v", err)
	}
	if unchanged.Set || unchanged.Value != nil {
		t.Fatalf("unchanged patch = %+v; want omitted no-op", unchanged)
	}

	changed := models.NullablePatch[string]{Set: true, Value: stringPointer("/media/recipes/9/unowned.webp")}
	if err := normalizeMediaURLPatch(&changed, &canonical); !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("changed canonical error = %v; want invalid request", err)
	}

	cleared := models.NullablePatch[string]{Set: true}
	if err := normalizeMediaURLPatch(&cleared, &canonical); err != nil || cleared.Value != nil {
		t.Fatalf("clear patch = %+v, %v", cleared, err)
	}
}

func TestNormalizeProductImageAlt(t *testing.T) {
	alt, err := normalizeProductImageAlt(stringPointer("  Bottle front  "))
	if err != nil || alt == nil || *alt != "Bottle front" {
		t.Fatalf("normalized alt = %v, %v", alt, err)
	}
	blank, err := normalizeProductImageAlt(stringPointer("  "))
	if err != nil || blank != nil {
		t.Fatalf("blank alt = %v, %v; want nil, nil", blank, err)
	}
	tooLong := strings.Repeat("x", maxImageAltLength+1)
	if _, err := normalizeProductImageAlt(&tooLong); !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("long alt error = %v; want invalid request", err)
	}
}

func stringPointer(value string) *string { return &value }

func equalStringPointers(left, right *string) bool {
	if left == nil || right == nil {
		return left == nil && right == nil
	}
	return *left == *right
}

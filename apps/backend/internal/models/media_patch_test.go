package models

import (
	"encoding/json"
	"testing"
)

func TestMediaURLPatchDistinguishesOmittedNullAndValue(t *testing.T) {
	tests := []struct {
		name   string
		body   string
		read   func() NullablePatch[string]
		decode func([]byte) error
	}{
		{
			name: "hero image",
			body: `{"image_url":null}`,
			read: func() NullablePatch[string] { return heroPatch.ImageURL },
			decode: func(data []byte) error {
				heroPatch = HeroSlideUpdateReq{}
				return json.Unmarshal(data, &heroPatch)
			},
		},
		{
			name: "recipe image",
			body: `{"image_url":null}`,
			read: func() NullablePatch[string] { return recipePatch.ImageURL },
			decode: func(data []byte) error {
				recipePatch = RecipeUpdateReq{}
				return json.Unmarshal(data, &recipePatch)
			},
		},
		{
			name: "journal image",
			body: `{"image_url":null}`,
			read: func() NullablePatch[string] { return blogPatch.ImageURL },
			decode: func(data []byte) error {
				blogPatch = BlogUpdateReq{}
				return json.Unmarshal(data, &blogPatch)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := tt.decode([]byte(`{}`)); err != nil {
				t.Fatalf("decode omitted: %v", err)
			}
			if tt.read().Set {
				t.Fatal("omitted image URL was marked set")
			}
			if err := tt.decode([]byte(tt.body)); err != nil {
				t.Fatalf("decode null: %v", err)
			}
			if patch := tt.read(); !patch.Set || patch.Value != nil {
				t.Fatalf("null patch = %+v; want set nil", patch)
			}
		})
	}
}

func TestProductImageAltPatchDistinguishesOmittedNullAndValue(t *testing.T) {
	tests := []struct {
		body      string
		wantSet   bool
		wantValue *string
	}{
		{body: `{}`},
		{body: `{"alt_text":null}`, wantSet: true},
		{body: `{"alt_text":"Bottle front"}`, wantSet: true, wantValue: mediaPatchString("Bottle front")},
	}
	for _, tt := range tests {
		var request struct {
			AltText NullablePatch[string] `json:"alt_text"`
		}
		if err := json.Unmarshal([]byte(tt.body), &request); err != nil {
			t.Fatalf("decode %s: %v", tt.body, err)
		}
		if request.AltText.Set != tt.wantSet {
			t.Fatalf("patch set for %s = %v; want %v", tt.body, request.AltText.Set, tt.wantSet)
		}
		if !mediaPatchStringsEqual(request.AltText.Value, tt.wantValue) {
			t.Fatalf("patch value for %s = %v; want %v", tt.body, request.AltText.Value, tt.wantValue)
		}
	}
}

var (
	heroPatch   HeroSlideUpdateReq
	recipePatch RecipeUpdateReq
	blogPatch   BlogUpdateReq
)

func mediaPatchString(value string) *string { return &value }

func mediaPatchStringsEqual(left, right *string) bool {
	if left == nil || right == nil {
		return left == nil && right == nil
	}
	return *left == *right
}

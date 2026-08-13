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
			// Hero slides live in features/hero; keep a local shape so models
			// tests still cover NullablePatch JSON null vs omit for image_url.
			name: "hero-like image patch",
			body: `{"image_url":null}`,
			read: func() NullablePatch[string] { return heroLikePatch.ImageURL },
			decode: func(data []byte) error {
				heroLikePatch = struct {
					ImageURL NullablePatch[string] `json:"image_url"`
				}{}
				return json.Unmarshal(data, &heroLikePatch)
			},
		},
		{
			// Recipes live in features/recipes; keep a local shape for patch JSON.
			name: "recipe-like image patch",
			body: `{"image_url":null}`,
			read: func() NullablePatch[string] { return recipeLikePatch.ImageURL },
			decode: func(data []byte) error {
				recipeLikePatch = struct {
					ImageURL NullablePatch[string] `json:"image_url"`
				}{}
				return json.Unmarshal(data, &recipeLikePatch)
			},
		},
		{
			// Journal posts live in features/blog; keep a local shape for patch JSON.
			name: "journal-like image patch",
			body: `{"image_url":null}`,
			read: func() NullablePatch[string] { return journalLikePatch.ImageURL },
			decode: func(data []byte) error {
				journalLikePatch = struct {
					ImageURL NullablePatch[string] `json:"image_url"`
				}{}
				return json.Unmarshal(data, &journalLikePatch)
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
	heroLikePatch struct {
		ImageURL NullablePatch[string] `json:"image_url"`
	}
	recipeLikePatch struct {
		ImageURL NullablePatch[string] `json:"image_url"`
	}
	journalLikePatch struct {
		ImageURL NullablePatch[string] `json:"image_url"`
	}
)

func mediaPatchString(value string) *string { return &value }

func mediaPatchStringsEqual(left, right *string) bool {
	if left == nil || right == nil {
		return left == nil && right == nil
	}
	return *left == *right
}

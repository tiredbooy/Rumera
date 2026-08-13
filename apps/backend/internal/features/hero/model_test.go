package hero

import (
	"github.com/tiredbooy/internal/models"
	"encoding/json"
	"testing"
	"time"
)

func TestHeroSlideUpdateNullableStringPatchesDistinguishOmittedNullAndValue(t *testing.T) {
	var omitted HeroSlideUpdateReq
	if err := json.Unmarshal([]byte(`{}`), &omitted); err != nil {
		t.Fatalf("decode omitted fields: %v", err)
	}
	for field, patch := range heroNullableStringPatches(omitted) {
		if patch.Set {
			t.Errorf("omitted %s patch = %+v; want unset", field, patch)
		}
	}

	var cleared HeroSlideUpdateReq
	if err := json.Unmarshal([]byte(`{
		"eyebrow": null,
		"subtitle": null,
		"badge": null,
		"cta_label": null,
		"cta_href": null,
		"secondary_cta_label": null,
		"secondary_cta_href": null
	}`), &cleared); err != nil {
		t.Fatalf("decode null fields: %v", err)
	}
	for field, patch := range heroNullableStringPatches(cleared) {
		if !patch.Set || patch.Value != nil {
			t.Errorf("null %s patch = %+v; want set with nil value", field, patch)
		}
	}

	var populated HeroSlideUpdateReq
	if err := json.Unmarshal([]byte(`{
		"eyebrow": "New",
		"subtitle": "Seasonal",
		"badge": "Limited",
		"cta_label": "Shop",
		"cta_href": "/products",
		"secondary_cta_label": "Read",
		"secondary_cta_href": "https://example.com/journal"
	}`), &populated); err != nil {
		t.Fatalf("decode populated fields: %v", err)
	}
	for field, patch := range heroNullableStringPatches(populated) {
		if !patch.Set || patch.Value == nil || *patch.Value == "" {
			t.Errorf("populated %s patch = %+v; want a non-empty value", field, patch)
		}
	}
}

func TestHeroSlideUpdateSchedulePatchesDistinguishOmittedNullAndValue(t *testing.T) {
	var omitted HeroSlideUpdateReq
	if err := json.Unmarshal([]byte(`{}`), &omitted); err != nil {
		t.Fatalf("decode omitted schedule: %v", err)
	}
	if omitted.StartsAt.Set || omitted.EndsAt.Set {
		t.Fatalf("omitted schedule = starts %+v, ends %+v; want unset", omitted.StartsAt, omitted.EndsAt)
	}

	var cleared HeroSlideUpdateReq
	if err := json.Unmarshal([]byte(`{"starts_at":null,"ends_at":null}`), &cleared); err != nil {
		t.Fatalf("decode null schedule: %v", err)
	}
	if !cleared.StartsAt.Set || cleared.StartsAt.Value != nil || !cleared.EndsAt.Set || cleared.EndsAt.Value != nil {
		t.Fatalf("null schedule = starts %+v, ends %+v; want explicit clears", cleared.StartsAt, cleared.EndsAt)
	}

	const startsAt = "2026-08-01T12:00:00Z"
	const endsAt = "2026-08-02T12:00:00Z"
	var populated HeroSlideUpdateReq
	if err := json.Unmarshal([]byte(`{"starts_at":"`+startsAt+`","ends_at":"`+endsAt+`"}`), &populated); err != nil {
		t.Fatalf("decode populated schedule: %v", err)
	}
	wantStart, _ := time.Parse(time.RFC3339, startsAt)
	wantEnd, _ := time.Parse(time.RFC3339, endsAt)
	if !populated.StartsAt.Set || populated.StartsAt.Value == nil || !populated.StartsAt.Value.Equal(wantStart) {
		t.Fatalf("starts_at = %+v; want %s", populated.StartsAt, wantStart)
	}
	if !populated.EndsAt.Set || populated.EndsAt.Value == nil || !populated.EndsAt.Value.Equal(wantEnd) {
		t.Fatalf("ends_at = %+v; want %s", populated.EndsAt, wantEnd)
	}
}

func heroNullableStringPatches(req HeroSlideUpdateReq) map[string]models.NullablePatch[string] {
	return map[string]models.NullablePatch[string]{
		"eyebrow":             req.Eyebrow,
		"subtitle":            req.Subtitle,
		"badge":               req.Badge,
		"cta_label":           req.CTALabel,
		"cta_href":            req.CTAHref,
		"secondary_cta_label": req.SecondaryCTALabel,
		"secondary_cta_href":  req.SecondaryCTAHref,
	}
}

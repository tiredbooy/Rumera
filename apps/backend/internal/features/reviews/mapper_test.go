package reviews

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestToReviewAdminResponseIncludesProductLabel(t *testing.T) {
	slug := "shiraz-bottle"
	out := ToReviewAdminResponse(&Review{
		ID:           12,
		Title:        "Excellent",
		Content:      "Smooth and smoky.",
		Rating:       5,
		UserID:       42,
		ProductID:    7,
		ProductTitle: "بطری شیراز",
		ProductSlug:  &slug,
		Status:       ReviewStatusPending,
	})

	if out.ProductID != 7 {
		t.Fatalf("ProductID = %d, want 7", out.ProductID)
	}
	if out.ProductTitle != "بطری شیراز" {
		t.Fatalf("ProductTitle = %q, want بطری شیراز", out.ProductTitle)
	}
	if out.ProductSlug == nil || *out.ProductSlug != slug {
		t.Fatalf("ProductSlug = %#v, want %q", out.ProductSlug, slug)
	}

	raw, err := json.Marshal(out)
	if err != nil {
		t.Fatalf("json.Marshal() error = %v", err)
	}
	body := string(raw)
	if !strings.Contains(body, `"product_title":"بطری شیراز"`) {
		t.Fatalf("json missing product_title: %s", body)
	}
	if !strings.Contains(body, `"product_slug":"shiraz-bottle"`) {
		t.Fatalf("json missing product_slug: %s", body)
	}
}

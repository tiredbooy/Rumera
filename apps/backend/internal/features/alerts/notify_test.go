package alerts

import (
	"strings"
	"testing"
)

func TestEmailCopy_RestockAndPriceDrop(t *testing.T) {
	slug := "shiraz"
	restock := PendingAlert{
		ID:           11,
		AlertType:    AlertRestock,
		ProductTitle: "شیراز",
		ProductSlug:  &slug,
	}
	subj, body := EmailCopy(restock, "https://rumera.example")
	if !strings.Contains(subj, "دوباره موجود شد") || !strings.Contains(subj, "شیراز") {
		t.Fatalf("restock subject = %q", subj)
	}
	if !strings.Contains(body, "https://rumera.example/products/shiraz") {
		t.Fatalf("restock body missing PDP link: %s", body)
	}

	drop := PendingAlert{ID: 22, AlertType: AlertPriceDrop, ProductTitle: "جین"}
	subj, body = EmailCopy(drop, "https://rumera.example")
	if !strings.Contains(subj, "کاهش قیمت") {
		t.Fatalf("price-drop subject = %q", subj)
	}
	if !strings.Contains(body, "https://rumera.example") || strings.Contains(body, "/products/") {
		t.Fatalf("price-drop without slug should use site root: %s", body)
	}
}

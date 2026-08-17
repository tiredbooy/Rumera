package alerts

import (
	"context"
	"fmt"
)

// ProductAlertNotifier delivers restock / price-drop email (inline or async outbox).
// Prefer notifications.Dispatcher via the cron job when the outbox is wired.
type ProductAlertNotifier interface {
	DispatchAlert(ctx context.Context, to, subject, htmlBody string, alertID int64, correlationID string) error
}

// EmailCopy is the Persian restock / price-drop body the checker cron sends.
func EmailCopy(a PendingAlert, siteURL string) (subject, body string) {
	link := siteURL
	if a.ProductSlug != nil {
		link = fmt.Sprintf("%s/products/%s", siteURL, *a.ProductSlug)
	}
	if a.AlertType == AlertRestock {
		subject = "دوباره موجود شد — " + a.ProductTitle
		body = fmt.Sprintf(
			`<p>خبر خوب! «%s» دوباره موجود شد.</p><p><a href="%s">همین حالا ببینید</a></p>`,
			a.ProductTitle, link,
		)
		return
	}
	subject = "کاهش قیمت — " + a.ProductTitle
	body = fmt.Sprintf(
		`<p>قیمت «%s» کاهش یافت.</p><p><a href="%s">مشاهدهٔ محصول</a></p>`,
		a.ProductTitle, link,
	)
	return
}

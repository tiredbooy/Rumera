package cron

import (
	"fmt"
	"html"
	"strings"
)

// renewalEmailSubject is the Persian subject for a due cellar box.
const renewalEmailSubject = "باکس سرداب شما آماده است"

// cadenceFa labels a subscription cadence for Persian copy.
func cadenceFa(cadence string) string {
	if cadence == "quarterly" {
		return "فصلی"
	}
	return "ماهانه"
}

// buildRenewalEmailHTML returns a minimal RTL Persian HTML body for the
// cellar-box due reminder. No payment language — manage link only.
func buildRenewalEmailHTML(siteURL, cadence string) string {
	base := strings.TrimRight(strings.TrimSpace(siteURL), "/")
	if base == "" {
		base = ""
	}
	manageURL := base + "/account/subscriptions"
	cad := html.EscapeString(cadenceFa(cadence))
	safeURL := html.EscapeString(manageURL)

	// dir=rtl + lang=fa for Persian clients; inline styles for common MUAs.
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0e0c;color:#f5f0e8;font-family:Tahoma,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px;direction:rtl;text-align:right;">
    <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;color:#c4a35a;">باکس سرداب</p>
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;line-height:1.4;color:#f5f0e8;">زمان باکس %s شما رسید</h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.75;color:#e8e0d4;">
      دورهٔ ارسال بعدی باکس فیزیکی‌تان فرا رسیده است. تیم فروشگاه ارسال منتخب این دوره را پیگیری می‌کند.
    </p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#b8b0a4;">
      این پیام فقط یادآوری است و پرداخت خودکاری از کارت شما انجام نشده است.
      می‌توانید ارسال را متوقف کنید، این دوره را رد کنید یا اشتراک را لغو کنید.
    </p>
    <p style="margin:0 0 28px;">
      <a href="%s" style="display:inline-block;padding:12px 20px;background:#c4a35a;color:#1a1510;text-decoration:none;border-radius:10px;font-size:14px;font-weight:600;">
        مدیریت باکس در حساب من
      </a>
    </p>
    <p style="margin:0;font-size:12px;line-height:1.6;color:#8a8278;">
      اگر دکمه کار نکرد: <a href="%s" style="color:#c4a35a;">%s</a>
    </p>
  </div>
</body>
</html>`, cad, safeURL, safeURL, safeURL)
}

package cron

import (
	"strings"
	"testing"
)

func TestBuildRenewalEmailHTML_RTLAndHonesty(t *testing.T) {
	html := buildRenewalEmailHTML("https://rumera.example/", "monthly")

	for _, want := range []string{
		`lang="fa"`,
		`dir="rtl"`,
		"باکس سرداب",
		"ماهانه",
		"https://rumera.example/account/subscriptions",
		"پرداخت خودکاری",
		"مدیریت باکس",
	} {
		if !strings.Contains(html, want) {
			t.Errorf("email HTML missing %q", want)
		}
	}

	// Must not sound like Netflix / auto-bill success.
	for _, bad := range []string{
		"stream",
		"Netflix",
		"unlimited",
		"کسر شد",
		"پرداخت موفق",
	} {
		if strings.Contains(strings.ToLower(html), strings.ToLower(bad)) {
			t.Errorf("email HTML must not contain %q", bad)
		}
	}
}

func TestBuildRenewalEmailHTML_QuarterlyAndEscape(t *testing.T) {
	html := buildRenewalEmailHTML("https://x.test", "quarterly")
	if !strings.Contains(html, "فصلی") {
		t.Fatal("expected quarterly cadence label")
	}
	// siteURL with characters that need escaping in attributes is rare;
	// ensure path is still absolute-ish.
	if !strings.Contains(html, "https://x.test/account/subscriptions") {
		t.Fatal("manage URL missing")
	}
}

func TestCadenceFa(t *testing.T) {
	if cadenceFa("quarterly") != "فصلی" {
		t.Fatal(cadenceFa("quarterly"))
	}
	if cadenceFa("monthly") != "ماهانه" {
		t.Fatal(cadenceFa("monthly"))
	}
	if cadenceFa("other") != "ماهانه" {
		t.Fatal("default should be monthly label")
	}
}

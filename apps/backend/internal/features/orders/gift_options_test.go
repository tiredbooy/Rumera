package orders

import (
	"testing"

	"github.com/tiredbooy/internal/features/site_settings"
	"github.com/tiredbooy/pkg/apperr"
)

func TestResolveGiftAddonsPricesEnabledOptions(t *testing.T) {
	cfg := site_settings.GiftCheckoutSettings{
		Enabled: true,
		Options: []site_settings.GiftCheckoutOption{
			{ID: "gift_wrap", Label: "Wrap", Price: 10_000, Enabled: true},
			{ID: "card", Label: "Card", Price: 5_000, Enabled: true},
			{ID: "off", Label: "Off", Price: 1, Enabled: false},
		},
	}
	snaps, fee, wrap, err := resolveGiftAddons(cfg, true, false, []string{"gift_wrap", "card", "card"})
	if err != nil {
		t.Fatal(err)
	}
	if fee != 15_000 || !wrap || len(snaps) != 2 {
		t.Fatalf("fee=%v wrap=%v snaps=%+v", fee, wrap, snaps)
	}
}

func TestResolveGiftAddonsRejectsDisabled(t *testing.T) {
	cfg := site_settings.GiftCheckoutSettings{
		Enabled: true,
		Options: []site_settings.GiftCheckoutOption{
			{ID: "card", Label: "Card", Price: 1, Enabled: false},
		},
	}
	_, _, _, err := resolveGiftAddons(cfg, true, false, []string{"card"})
	if err == nil {
		t.Fatal("expected error")
	}
	var ae *apperr.AppError
	if !apperrAs(err, &ae) || ae.Code != "INVALID_GIFT_OPTION" {
		t.Fatalf("err=%v", err)
	}
}

func TestResolveGiftAddonsLegacyWrap(t *testing.T) {
	cfg := site_settings.DefaultGiftCheckout()
	snaps, fee, wrap, err := resolveGiftAddons(cfg, true, true, nil)
	if err != nil {
		t.Fatal(err)
	}
	if !wrap || fee != 0 || len(snaps) != 1 || snaps[0].ID != "gift_wrap" {
		t.Fatalf("%+v fee=%v wrap=%v", snaps, fee, wrap)
	}
}

func TestResolveGiftAddonsNotGift(t *testing.T) {
	snaps, fee, wrap, err := resolveGiftAddons(site_settings.DefaultGiftCheckout(), false, true, []string{"gift_wrap"})
	if err != nil || snaps != nil || fee != 0 || wrap {
		t.Fatalf("snaps=%v fee=%v wrap=%v err=%v", snaps, fee, wrap, err)
	}
}

func apperrAs(err error, target **apperr.AppError) bool {
	if err == nil {
		return false
	}
	if e, ok := err.(*apperr.AppError); ok {
		*target = e
		return true
	}
	return false
}

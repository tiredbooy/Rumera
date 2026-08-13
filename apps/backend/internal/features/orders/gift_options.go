package orders

import (
	"fmt"
	"strings"

	"github.com/tiredbooy/internal/features/site_settings"
	"github.com/tiredbooy/pkg/apperr"
)

// resolveGiftAddons prices selected option IDs against admin gift settings.
// Legacy gift_wrap=true without IDs selects the "gift_wrap" option when present.
func resolveGiftAddons(
	cfg site_settings.GiftCheckoutSettings,
	isGift bool,
	legacyWrap bool,
	optionIDs []string,
) (snapshots []GiftAddonSnapshot, fee float64, giftWrap bool, err error) {
	if !isGift {
		return nil, 0, false, nil
	}
	cfg = site_settings.NormalizeGiftCheckout(cfg)
	if !cfg.Enabled {
		return nil, 0, false, apperr.New("GIFT_DISABLED", "خرید به‌عنوان هدیه در حال حاضر فعال نیست")
	}

	ids := make([]string, 0, len(optionIDs)+1)
	seen := map[string]struct{}{}
	for _, raw := range optionIDs {
		id := strings.ToLower(strings.TrimSpace(raw))
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	// Backward compat: checkbox wrap without modular ids.
	if legacyWrap {
		if _, ok := seen["gift_wrap"]; !ok {
			ids = append(ids, "gift_wrap")
			seen["gift_wrap"] = struct{}{}
		}
	}

	byID := make(map[string]site_settings.GiftCheckoutOption, len(cfg.Options))
	for _, o := range cfg.EnabledGiftOptions() {
		byID[o.ID] = o
	}

	snapshots = make([]GiftAddonSnapshot, 0, len(ids))
	for _, id := range ids {
		o, ok := byID[id]
		if !ok {
			return nil, 0, false, apperr.New(
				"INVALID_GIFT_OPTION",
				fmt.Sprintf("گزینهٔ هدیه «%s» موجود یا فعال نیست", id),
			)
		}
		snapshots = append(snapshots, GiftAddonSnapshot{
			ID:    o.ID,
			Label: o.Label,
			Price: o.Price,
		})
		fee += o.Price
		if o.ID == "gift_wrap" || strings.Contains(o.ID, "wrap") {
			giftWrap = true
		}
	}
	if legacyWrap {
		giftWrap = true
	}
	return snapshots, fee, giftWrap, nil
}

package site_settings

import (
	"sort"
	"strings"
)

// DefaultGiftCheckout is applied when the JSONB document has never configured gift.
func DefaultGiftCheckout() GiftCheckoutSettings {
	return GiftCheckoutSettings{
		Enabled:          true,
		MessageEnabled:   true,
		MessageMaxLength: 500,
		HidePriceEnabled: true,
		Options: []GiftCheckoutOption{
			{
				ID:          "gift_wrap",
				Label:       "بسته‌بندی هدیه",
				Description: "بسته‌بندی شیک مناسب هدیه",
				Price:       0,
				Enabled:     true,
				SortOrder:   0,
			},
		},
	}
}

// NormalizeGiftCheckout fills defaults and drops invalid option rows.
func NormalizeGiftCheckout(g GiftCheckoutSettings) GiftCheckoutSettings {
	// Zero-value document → first-time defaults (gift on, free wrap option).
	if !g.Enabled && !g.MessageEnabled && !g.HidePriceEnabled &&
		g.MessageMaxLength == 0 && len(g.Options) == 0 {
		return DefaultGiftCheckout()
	}
	if g.MessageMaxLength <= 0 || g.MessageMaxLength > 500 {
		g.MessageMaxLength = 500
	}
	seen := make(map[string]struct{}, len(g.Options))
	out := make([]GiftCheckoutOption, 0, len(g.Options))
	for _, o := range g.Options {
		id := strings.ToLower(strings.TrimSpace(o.ID))
		label := strings.TrimSpace(o.Label)
		if id == "" || label == "" {
			continue
		}
		if _, dup := seen[id]; dup {
			continue
		}
		seen[id] = struct{}{}
		if o.Price < 0 {
			o.Price = 0
		}
		o.ID = id
		o.Label = label
		o.Description = strings.TrimSpace(o.Description)
		out = append(out, o)
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].SortOrder == out[j].SortOrder {
			return out[i].ID < out[j].ID
		}
		return out[i].SortOrder < out[j].SortOrder
	})
	g.Options = out
	return g
}

// EnabledGiftOptions returns enabled options sorted for checkout.
func (g GiftCheckoutSettings) EnabledGiftOptions() []GiftCheckoutOption {
	g = NormalizeGiftCheckout(g)
	out := make([]GiftCheckoutOption, 0, len(g.Options))
	for _, o := range g.Options {
		if o.Enabled {
			out = append(out, o)
		}
	}
	return out
}

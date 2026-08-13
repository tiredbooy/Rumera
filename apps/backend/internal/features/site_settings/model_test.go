package site_settings

import "testing"

func TestUpdateApplyReplacesOnlyPresentGroups(t *testing.T) {
	cur := SiteSettings{
		Store:   StoreSettings{Name: "Old"},
		Contact: ContactSettings{SupportEmail: "a@b.com"},
	}
	req := UpdateSiteSettingsReq{
		Store: &UpdateStoreReq{Name: "New", Tagline: "t"},
	}
	out := req.Apply(cur)
	if out.Store.Name != "New" || out.Store.Tagline != "t" {
		t.Fatalf("store = %+v", out.Store)
	}
	if out.Contact.SupportEmail != "a@b.com" {
		t.Fatalf("contact should be preserved: %+v", out.Contact)
	}
}

func TestToPublicOmitsUpdatedAtConcern(t *testing.T) {
	s := &SiteSettings{Store: StoreSettings{Name: "R"}}
	p := ToPublic(s)
	if p.Store.Name != "R" {
		t.Fatalf("%+v", p)
	}
	// Zero gift → defaults for storefront.
	if !p.Gift.Enabled || len(p.Gift.Options) == 0 {
		t.Fatalf("gift defaults = %+v", p.Gift)
	}
}

func TestGiftNormalizeAndApply(t *testing.T) {
	cur := SiteSettings{}
	req := UpdateSiteSettingsReq{
		Gift: &UpdateGiftReq{
			Enabled:          true,
			MessageEnabled:   true,
			MessageMaxLength: 200,
			HidePriceEnabled: true,
			Options: []UpdateGiftOptionReq{
				{ID: "wrap", Label: "Wrap", Price: 12_000, Enabled: true, SortOrder: 1},
				{ID: "wrap", Label: "Dup", Price: 1, Enabled: true}, // dedupe
			},
		},
	}
	out := req.Apply(cur)
	if len(out.Gift.Options) != 1 || out.Gift.Options[0].Price != 12_000 {
		t.Fatalf("%+v", out.Gift)
	}
}

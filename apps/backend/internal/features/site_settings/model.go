package site_settings

import (
	"strings"
	"time"
)

// ─────────────────────────────────────────────────────────────
// Typed settings groups
//
// SiteSettings is the storefront's single configuration document. It is stored
// as one JSONB blob (see migrations/.../create_site_settings.sql) of typed
// groups so the shape can grow without a schema migration. The admin edits every
// group; the public API exposes only the storefront-safe subset (see
// PublicSiteSettings and the site-settings mappers).
// ─────────────────────────────────────────────────────────────

// StoreSettings holds the store's public identity.
type StoreSettings struct {
	Name        string `json:"name"`
	Tagline     string `json:"tagline"`
	LogoURL     string `json:"logoUrl"`
	Description string `json:"description"`
}

// ContactSettings holds customer-facing contact details.
type ContactSettings struct {
	SupportEmail string `json:"supportEmail"`
	SupportPhone string `json:"supportPhone"`
	Address      string `json:"address"`
	WorkingHours string `json:"workingHours"`
}

// SocialSettings holds social/messaging handles. Empty strings are hidden by the
// frontend.
type SocialSettings struct {
	Instagram string `json:"instagram"`
	Telegram  string `json:"telegram"`
	WhatsApp  string `json:"whatsapp"`
	Twitter   string `json:"twitter"`
	YouTube   string `json:"youtube"`
	LinkedIn  string `json:"linkedin"`
}

// ShippingSettings holds storefront shipping copy and the free-shipping
// threshold (in the store's minor currency unit, matching order totals).
type ShippingSettings struct {
	FreeThreshold int64  `json:"freeThreshold"`
	Note          string `json:"note"`
}

// SEOSettings holds default meta tags used when a page does not supply its own.
type SEOSettings struct {
	DefaultTitle       string `json:"defaultTitle"`
	DefaultDescription string `json:"defaultDescription"`
	OGImage            string `json:"ogImage"`
	Keywords           string `json:"keywords"`
}

// MaintenanceSettings toggles the storefront maintenance banner / lock screen.
type MaintenanceSettings struct {
	Enabled bool   `json:"enabled"`
	Message string `json:"message"`
}

// GiftCheckoutOption is one admin-priced modular add-on (wrap, card, extras…).
// ID is a stable slug clients send on CreateOrder; price is in store currency units.
type GiftCheckoutOption struct {
	ID          string  `json:"id"`
	Label       string  `json:"label"`
	Description string  `json:"description"`
	Price       float64 `json:"price"`
	Enabled     bool    `json:"enabled"`
	SortOrder   int     `json:"sortOrder"`
}

// GiftCheckoutSettings configures storefront “buy as gift” (PH-060).
// Stored inside site_settings JSONB so admins can change options without migrations.
type GiftCheckoutSettings struct {
	Enabled          bool                 `json:"enabled"`
	MessageEnabled   bool                 `json:"messageEnabled"`
	MessageMaxLength int                  `json:"messageMaxLength"`
	HidePriceEnabled bool                 `json:"hidePriceEnabled"`
	Options          []GiftCheckoutOption `json:"options"`
}

// ─────────────────────────────────────────────────────────────
// Full document + DB row model
// ─────────────────────────────────────────────────────────────

// SiteSettings is the full, admin-visible settings document.
type SiteSettings struct {
	Store       StoreSettings        `json:"store"`
	Contact     ContactSettings      `json:"contact"`
	Social      SocialSettings       `json:"social"`
	Shipping    ShippingSettings     `json:"shipping"`
	SEO         SEOSettings          `json:"seo"`
	Maintenance MaintenanceSettings  `json:"maintenance"`
	Gift        GiftCheckoutSettings `json:"gift"`

	// UpdatedAt is the last time the document was written. Populated from the
	// row's updated_at column, not the JSONB body.
	UpdatedAt time.Time `json:"-"`
}

// PublicSiteSettings is the storefront-safe projection returned by the public
// GET /settings. It omits nothing sensitive today, but is a distinct type so the
// public contract stays stable as admin-only groups are added.
type PublicSiteSettings struct {
	Store       StoreSettings        `json:"store"`
	Contact     ContactSettings      `json:"contact"`
	Social      SocialSettings       `json:"social"`
	Shipping    ShippingSettings     `json:"shipping"`
	SEO         SEOSettings          `json:"seo"`
	Maintenance MaintenanceSettings  `json:"maintenance"`
	Gift        GiftCheckoutSettings `json:"gift"`
}

// SiteSettingsResponse is the full admin response. UpdatedAt belongs to this
// transport DTO rather than the JSONB-backed entity.
type SiteSettingsResponse struct {
	Store       StoreSettings        `json:"store"`
	Contact     ContactSettings      `json:"contact"`
	Social      SocialSettings       `json:"social"`
	Shipping    ShippingSettings     `json:"shipping"`
	SEO         SEOSettings          `json:"seo"`
	Maintenance MaintenanceSettings  `json:"maintenance"`
	Gift        GiftCheckoutSettings `json:"gift"`
	UpdatedAt   time.Time            `json:"updatedAt"`
}

// ─────────────────────────────────────────────────────────────
// Update request DTO
//
// The PUT body mirrors the document: every group is optional (a pointer), so the
// admin UI can send a partial update touching only the groups it changed. A nil
// group is left untouched; a present group fully replaces the stored one.
// ─────────────────────────────────────────────────────────────

type UpdateStoreReq struct {
	Name        string `json:"name"        validate:"required,max=255"`
	Tagline     string `json:"tagline"     validate:"omitempty,max=255"`
	LogoURL     string `json:"logoUrl"     validate:"omitempty,max=2048"`
	Description string `json:"description" validate:"omitempty,max=2000"`
}

type UpdateContactReq struct {
	SupportEmail string `json:"supportEmail" validate:"omitempty,email,max=255"`
	SupportPhone string `json:"supportPhone" validate:"omitempty,max=40"`
	Address      string `json:"address"      validate:"omitempty,max=500"`
	WorkingHours string `json:"workingHours" validate:"omitempty,max=255"`
}

type UpdateSocialReq struct {
	Instagram string `json:"instagram" validate:"omitempty,max=255"`
	Telegram  string `json:"telegram"  validate:"omitempty,max=255"`
	WhatsApp  string `json:"whatsapp"  validate:"omitempty,max=255"`
	Twitter   string `json:"twitter"   validate:"omitempty,max=255"`
	YouTube   string `json:"youtube"   validate:"omitempty,max=255"`
	LinkedIn  string `json:"linkedin"  validate:"omitempty,max=255"`
}

type UpdateShippingReq struct {
	FreeThreshold int64  `json:"freeThreshold" validate:"omitempty,min=0"`
	Note          string `json:"note"          validate:"omitempty,max=1000"`
}

type UpdateSEOReq struct {
	DefaultTitle       string `json:"defaultTitle"       validate:"omitempty,max=255"`
	DefaultDescription string `json:"defaultDescription" validate:"omitempty,max=500"`
	OGImage            string `json:"ogImage"            validate:"omitempty,max=2048"`
	Keywords           string `json:"keywords"           validate:"omitempty,max=500"`
}

type UpdateMaintenanceReq struct {
	Enabled bool   `json:"enabled"`
	Message string `json:"message" validate:"omitempty,max=500"`
}

type UpdateGiftOptionReq struct {
	ID          string  `json:"id"          validate:"required,max=64"`
	Label       string  `json:"label"       validate:"required,max=120"`
	Description string  `json:"description" validate:"omitempty,max=500"`
	Price       float64 `json:"price"       validate:"omitempty,min=0"`
	Enabled     bool    `json:"enabled"`
	SortOrder   int     `json:"sortOrder"`
}

type UpdateGiftReq struct {
	Enabled          bool                  `json:"enabled"`
	MessageEnabled   bool                  `json:"messageEnabled"`
	MessageMaxLength int                   `json:"messageMaxLength" validate:"omitempty,min=1,max=500"`
	HidePriceEnabled bool                  `json:"hidePriceEnabled"`
	Options          []UpdateGiftOptionReq `json:"options" validate:"omitempty,dive"`
}

// UpdateSiteSettingsReq is the PUT /admin/settings body. Each group is a pointer:
// nil = leave that group unchanged; present = replace that group wholesale.
//
// ExpectedUpdatedAt is the optimistic revision (admin GET `updatedAt`). It is
// required so two editors cannot last-write-win the JSONB document (gift prices
// included). JSON key is snake_case to match the product-aggregate lock field.
type UpdateSiteSettingsReq struct {
	ExpectedUpdatedAt *time.Time            `json:"expected_updated_at" validate:"required"`
	Store             *UpdateStoreReq       `json:"store"       validate:"omitempty"`
	Contact           *UpdateContactReq     `json:"contact"     validate:"omitempty"`
	Social            *UpdateSocialReq      `json:"social"      validate:"omitempty"`
	Shipping          *UpdateShippingReq    `json:"shipping"    validate:"omitempty"`
	SEO               *UpdateSEOReq         `json:"seo"         validate:"omitempty"`
	Maintenance       *UpdateMaintenanceReq `json:"maintenance" validate:"omitempty"`
	Gift              *UpdateGiftReq        `json:"gift"        validate:"omitempty"`
}

// Apply merges the non-nil groups of the request onto the current settings,
// returning the updated document. Present groups replace the stored group; nil
// groups are preserved.
func (req UpdateSiteSettingsReq) Apply(cur SiteSettings) SiteSettings {
	if req.Store != nil {
		cur.Store = StoreSettings{
			Name:        req.Store.Name,
			Tagline:     req.Store.Tagline,
			LogoURL:     req.Store.LogoURL,
			Description: req.Store.Description,
		}
	}
	if req.Contact != nil {
		cur.Contact = ContactSettings{
			SupportEmail: req.Contact.SupportEmail,
			SupportPhone: req.Contact.SupportPhone,
			Address:      req.Contact.Address,
			WorkingHours: req.Contact.WorkingHours,
		}
	}
	if req.Social != nil {
		cur.Social = SocialSettings{
			Instagram: req.Social.Instagram,
			Telegram:  req.Social.Telegram,
			WhatsApp:  req.Social.WhatsApp,
			Twitter:   req.Social.Twitter,
			YouTube:   req.Social.YouTube,
			LinkedIn:  req.Social.LinkedIn,
		}
	}
	if req.Shipping != nil {
		cur.Shipping = ShippingSettings{
			FreeThreshold: req.Shipping.FreeThreshold,
			Note:          req.Shipping.Note,
		}
	}
	if req.SEO != nil {
		cur.SEO = SEOSettings{
			DefaultTitle:       req.SEO.DefaultTitle,
			DefaultDescription: req.SEO.DefaultDescription,
			OGImage:            req.SEO.OGImage,
			Keywords:           req.SEO.Keywords,
		}
	}
	if req.Maintenance != nil {
		cur.Maintenance = MaintenanceSettings{
			Enabled: req.Maintenance.Enabled,
			Message: req.Maintenance.Message,
		}
	}
	if req.Gift != nil {
		opts := make([]GiftCheckoutOption, 0, len(req.Gift.Options))
		for _, o := range req.Gift.Options {
			opts = append(opts, GiftCheckoutOption{
				ID:          strings.TrimSpace(o.ID),
				Label:       strings.TrimSpace(o.Label),
				Description: strings.TrimSpace(o.Description),
				Price:       o.Price,
				Enabled:     o.Enabled,
				SortOrder:   o.SortOrder,
			})
		}
		maxLen := req.Gift.MessageMaxLength
		if maxLen <= 0 {
			maxLen = 500
		}
		if maxLen > 500 {
			maxLen = 500
		}
		cur.Gift = NormalizeGiftCheckout(GiftCheckoutSettings{
			Enabled:          req.Gift.Enabled,
			MessageEnabled:   req.Gift.MessageEnabled,
			MessageMaxLength: maxLen,
			HidePriceEnabled: req.Gift.HidePriceEnabled,
			Options:          opts,
		})
	}
	return cur
}

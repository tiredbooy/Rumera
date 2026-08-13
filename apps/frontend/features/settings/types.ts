export interface StoreSettings {
  name: string;
  tagline: string;
  logoUrl: string;
  description: string;
}

export interface ContactSettings {
  supportEmail: string;
  supportPhone: string;
  address: string;
  workingHours: string;
}

export interface SocialSettings {
  instagram: string;
  telegram: string;
  whatsapp: string;
  twitter: string;
  youtube: string;
  linkedin: string;
}

export interface SiteShippingSettings {
  freeThreshold: number;
  note: string;
}

export interface SeoSettings {
  defaultTitle: string;
  defaultDescription: string;
  ogImage: string;
  keywords: string;
}

export interface MaintenanceSettings {
  enabled: boolean;
  message: string;
}

/** Modular checkout gift packaging / add-on (admin-priced). */
export interface GiftCheckoutOption {
  id: string;
  label: string;
  description: string;
  price: number;
  enabled: boolean;
  sortOrder: number;
}

export interface GiftCheckoutSettings {
  enabled: boolean;
  messageEnabled: boolean;
  messageMaxLength: number;
  hidePriceEnabled: boolean;
  options: GiftCheckoutOption[];
}

/** Storefront-safe GET /settings response. The admin-only updatedAt is omitted. */
export interface PublicSiteSettings {
  store: StoreSettings;
  contact: ContactSettings;
  social: SocialSettings;
  shipping: SiteShippingSettings;
  seo: SeoSettings;
  maintenance: MaintenanceSettings;
  gift: GiftCheckoutSettings;
}

/** Full admin GET/PUT response. */
export interface SiteSettings extends PublicSiteSettings {
  updatedAt: string;
}

/** Present groups replace the corresponding stored group; omitted/null groups remain unchanged. */
export interface UpdateSiteSettingsInput {
  store?: StoreSettings | null;
  contact?: ContactSettings | null;
  social?: SocialSettings | null;
  shipping?: SiteShippingSettings | null;
  seo?: SeoSettings | null;
  maintenance?: MaintenanceSettings | null;
  gift?: GiftCheckoutSettings | null;
}

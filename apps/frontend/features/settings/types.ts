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

/** Storefront-safe GET /settings response. The admin-only updatedAt is omitted. */
export interface PublicSiteSettings {
  store: StoreSettings;
  contact: ContactSettings;
  social: SocialSettings;
  shipping: SiteShippingSettings;
  seo: SeoSettings;
  maintenance: MaintenanceSettings;
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
}

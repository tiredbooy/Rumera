import { describe, expect, it } from "vitest";

import { addressFormSchema } from "./addresses/validations";
import {
  BRAND_CURRENT_YEAR,
  brandFormSchema,
} from "./catalog/brands/validations";
import { categoryFormSchema } from "./catalog/categories/validations";
import {
  adminUserCreateFormSchema,
  customerEditFormSchema,
  parseAdminUserID,
} from "./customers/validations";
import {
  heroDateTimeInputValue,
  heroDateTimeISO,
  heroSlideFormSchema,
} from "./hero-slides/validations";
import { profileFormSchema } from "./profile/validations";
import { recipeFormSchema } from "./recipes/validations";
import { siteSettingsFormSchema } from "./settings/validations";

describe("extracted validation contracts", () => {
  it("preserves settings string and integer behavior", () => {
    const base = {
      name: " رومرا ",
      tagline: "",
      logoUrl: "",
      description: "  توضیح  ",
      supportEmail: "",
      supportPhone: "",
      address: "",
      workingHours: "",
      instagram: "",
      telegram: "",
      whatsapp: "",
      twitter: "",
      youtube: "",
      linkedin: "",
      freeThreshold: "12",
      note: "",
      defaultTitle: "",
      defaultDescription: "",
      ogImage: "",
      keywords: "",
      enabled: false,
      message: "",
      giftEnabled: true,
      giftMessageEnabled: true,
      giftHidePriceEnabled: true,
      giftOptions: [],
    };

    const parsed = siteSettingsFormSchema.parse(base);
    expect(parsed.name).toBe("رومرا");
    expect(parsed.description).toBe("  توضیح  ");
    expect(
      siteSettingsFormSchema.safeParse({ ...base, freeThreshold: "1e2" })
        .success,
    ).toBe(false);
    expect(
      siteSettingsFormSchema.safeParse({ ...base, name: "" }).success,
    ).toBe(false);
    expect(
      siteSettingsFormSchema.safeParse({ ...base, name: "x".repeat(255) })
        .success,
    ).toBe(true);
    expect(
      siteSettingsFormSchema.safeParse({ ...base, name: "x".repeat(256) })
        .success,
    ).toBe(false);
  });

  it("preserves brand year and URL refinement", () => {
    const base = {
      title: "برند",
      slug: "",
      country: "",
      founded_year: String(BRAND_CURRENT_YEAR),
      image_url: "https://example.com/logo.png",
      description: "",
    };
    expect(brandFormSchema.safeParse(base).success).toBe(true);
    expect(
      brandFormSchema.safeParse({
        ...base,
        founded_year: String(BRAND_CURRENT_YEAR + 1),
      }).success,
    ).toBe(false);
    expect(
      brandFormSchema.safeParse({ ...base, image_url: "/media/logo.png" })
        .success,
    ).toBe(false);
  });

  it("preserves customer role, gender, and localized digit rules", () => {
    const base = {
      first_name: "",
      last_name: "",
      phone: "+۹۸ ۹۱۲۳۴۵۶۷۸۹",
      national_code: "۱۲۳۴۵۶۷۸۹۰",
      birth_date: "",
      gender: "" as const,
      role: "admin" as const,
      is_active: true,
    };
    expect(customerEditFormSchema.safeParse(base).success).toBe(true);
    expect(
      customerEditFormSchema.safeParse({ ...base, role: "operator" }).success,
    ).toBe(false);
    expect(
      customerEditFormSchema.safeParse({ ...base, gender: "unknown" }).success,
    ).toBe(false);
    expect(
      customerEditFormSchema.safeParse({ ...base, birth_date: "2026-02-30" })
        .success,
    ).toBe(false);
    expect(parseAdminUserID("8b5948a0-d150-4c78-86cd-d16e63da940d")).toBe(
      "8b5948a0-d150-4c78-86cd-d16e63da940d",
    );
    expect(parseAdminUserID("../roles")).toBeNull();

    const createBase = {
      ...base,
      email: "admin@example.com",
      password: "password123",
    };
    expect(adminUserCreateFormSchema.safeParse(createBase).success).toBe(true);
    expect(
      adminUserCreateFormSchema.safeParse({
        ...createBase,
        password: "آ".repeat(37),
      }).success,
    ).toBe(false);
  });

  it("preserves recipe rich-text and integer-like behavior", () => {
    const base = {
      title: "دستور",
      slug: "",
      excerpt: "",
      content: "<p>متن</p>",
      difficulty: "easy" as const,
      prep_time_minutes: "1e2",
      cook_time_minutes: "",
      servings: "1",
      status: "draft" as const,
      image_url: "",
      image_alt: "",
      og_image_url: "",
      is_featured: false,
      meta_title: "",
      meta_description: "",
      tag_ids: [],
      ingredients: [],
      products: [],
    };
    expect(recipeFormSchema.safeParse(base).success).toBe(true);
    expect(
      recipeFormSchema.safeParse({ ...base, content: "<p></p>" }).success,
    ).toBe(false);
  });

  it("preserves hero untrimmed subtitle and integer-like sort order", () => {
    const parsed = heroSlideFormSchema.parse({
      title: "اسلاید",
      eyebrow: "",
      subtitle: "  متن  ",
      badge: "",
      image_url: "/media/hero.jpg",
      mobile_image_url: "",
      image_alt: "",
      cta_label: "",
      cta_href: "",
      secondary_cta_label: "",
      secondary_cta_href: "",
      starts_at: "",
      ends_at: "",
      theme: "dark",
      sort_order: "1e2",
      is_active: true,
      desktop_file_staged: false,
    });
    expect(parsed.subtitle).toBe("  متن  ");
  });

  it("requires desktop media only when a hero is active", () => {
    const base = {
      title: "اسلاید",
      eyebrow: "",
      subtitle: "",
      badge: "",
      image_url: "",
      mobile_image_url: "",
      image_alt: "",
      cta_label: "",
      cta_href: "",
      secondary_cta_label: "",
      secondary_cta_href: "",
      starts_at: "",
      ends_at: "",
      theme: "dark" as const,
      sort_order: "0",
      is_active: true,
      desktop_file_staged: false,
    };
    expect(heroSlideFormSchema.safeParse(base).success).toBe(false);
    expect(
      heroSlideFormSchema.safeParse({ ...base, desktop_file_staged: true })
        .success,
    ).toBe(true);
    expect(
      heroSlideFormSchema.safeParse({ ...base, is_active: false }).success,
    ).toBe(true);
    expect(
      heroSlideFormSchema.safeParse({
        ...base,
        is_active: false,
        starts_at: "2026-02-30T10:00:00",
      }).success,
    ).toBe(false);
  });

  it("round-trips hero schedules between local controls and API timestamps", () => {
    const timestamp = "2026-07-27T08:45:30.000Z";
    const localValue = heroDateTimeInputValue(timestamp);

    expect(heroDateTimeISO(localValue)).toBe(timestamp);
    expect(heroDateTimeInputValue(null)).toBe("");
    expect(heroDateTimeISO("")).toBeNull();
  });

  it("validates hero CTA pairs, safe links, and schedule ordering", () => {
    const base = {
      title: "اسلاید",
      eyebrow: "",
      subtitle: "",
      badge: "",
      image_url: "/media/hero.jpg",
      mobile_image_url: "",
      image_alt: "",
      cta_label: "مشاهده",
      cta_href: "/products",
      secondary_cta_label: "",
      secondary_cta_href: "",
      starts_at: "2026-08-01T10:00:00",
      ends_at: "2026-08-02T10:00:00",
      theme: "dark" as const,
      sort_order: "0",
      is_active: true,
      desktop_file_staged: false,
    };

    expect(heroSlideFormSchema.safeParse(base).success).toBe(true);
    expect(
      heroSlideFormSchema.safeParse({ ...base, cta_href: "" }).success,
    ).toBe(false);
    expect(
      heroSlideFormSchema.safeParse({
        ...base,
        cta_href: "javascript:alert(1)",
      }).success,
    ).toBe(false);
    expect(
      heroSlideFormSchema.safeParse({
        ...base,
        cta_href: "/products%5Cunsafe",
      }).success,
    ).toBe(false);
    expect(
      heroSlideFormSchema.safeParse({
        ...base,
        cta_href: "/%2Fexample.com/products",
      }).success,
    ).toBe(false);
    expect(
      heroSlideFormSchema.safeParse({
        ...base,
        cta_href: "https:example.com/products",
      }).success,
    ).toBe(false);
    expect(
      heroSlideFormSchema.safeParse({
        ...base,
        cta_href: "https:/example.com/products",
      }).success,
    ).toBe(false);
    expect(
      heroSlideFormSchema.safeParse({
        ...base,
        cta_href: "HTTPS://example.com/products",
      }).success,
    ).toBe(true);
    expect(
      heroSlideFormSchema.safeParse({
        ...base,
        ends_at: base.starts_at,
      }).success,
    ).toBe(false);
  });

  it("preserves unrestricted category numeric strings and relative images", () => {
    expect(
      categoryFormSchema.safeParse({
        title: "دسته",
        slug: "category",
        parent_id: "not-a-number",
        description: "",
        image_url: "/media/category.jpg",
        is_featured: false,
        card_size: "small",
        display_order: "also-not-a-number",
      }).success,
    ).toBe(true);
  });

  it("preserves Iran-specific address constraints", () => {
    expect(
      addressFormSchema.safeParse({
        title: "خانه",
        full_name: "نام گیرنده",
        phone_number: "09123456789",
        state_province: "تهران",
        city: "تهران",
        postal_code: "1234567890",
        address_line1: "نشانی کامل",
        address_line2: "",
        is_default: false,
      }).success,
    ).toBe(true);
  });

  it("preserves optional-empty profile phone semantics", () => {
    const base = { first_name: "علی", last_name: "رضایی", phone: "" };
    expect(profileFormSchema.safeParse(base).success).toBe(true);
    expect(profileFormSchema.safeParse({ ...base, phone: " " }).success).toBe(
      false,
    );
  });
});

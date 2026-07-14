import { describe, expect, it } from "vitest";

import { addressFormSchema } from "./addresses/validations";
import {
  BRAND_CURRENT_YEAR,
  brandFormSchema,
} from "./catalog/brands/validations";
import { categoryFormSchema } from "./catalog/categories/validations";
import { customerEditFormSchema } from "./customers/validations";
import { heroSlideFormSchema } from "./hero-slides/validations";
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
    };

    const parsed = siteSettingsFormSchema.parse(base);
    expect(parsed.name).toBe("رومرا");
    expect(parsed.description).toBe("  توضیح  ");
    expect(
      siteSettingsFormSchema.safeParse({ ...base, freeThreshold: "1e2" }).success,
    ).toBe(false);
    expect(siteSettingsFormSchema.safeParse({ ...base, name: "" }).success).toBe(
      false,
    );
    expect(
      siteSettingsFormSchema.safeParse({ ...base, name: "x".repeat(255) }).success,
    ).toBe(true);
    expect(
      siteSettingsFormSchema.safeParse({ ...base, name: "x".repeat(256) }).success,
    ).toBe(false);
  });

  it("preserves brand year and URL refinement", () => {
    const base = {
      title: "برند",
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
      brandFormSchema.safeParse({ ...base, image_url: "/media/logo.png" }).success,
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
      customerEditFormSchema.safeParse({ ...base, role: "support" }).success,
    ).toBe(false);
    expect(
      customerEditFormSchema.safeParse({ ...base, role: "manager" }).success,
    ).toBe(false);
    expect(
      customerEditFormSchema.safeParse({ ...base, gender: "unknown" }).success,
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
      theme: "dark",
      sort_order: "1e2",
      is_active: true,
    });
    expect(parsed.subtitle).toBe("  متن  ");
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
    expect(profileFormSchema.safeParse({ ...base, phone: " " }).success).toBe(false);
  });
});

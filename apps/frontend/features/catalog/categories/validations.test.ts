import { describe, expect, it } from "vitest";

import { categoryFormSchema } from "./validations";

const validForm = {
  title: "ویسکی",
  slug: "ویسکی-ویژه",
  parent_id: "",
  description: "",
  image_url: "",
  is_featured: false,
  card_size: "small" as const,
  display_order: "0",
};

describe("categoryFormSchema slug contract", () => {
  it("accepts one Unicode path segment or an intentionally blank structural slug", () => {
    expect(categoryFormSchema.safeParse(validForm).success).toBe(true);
    expect(
      categoryFormSchema.safeParse({ ...validForm, slug: "single-malt-18" })
        .success,
    ).toBe(true);
    expect(
      categoryFormSchema.safeParse({ ...validForm, slug: "" }).success,
    ).toBe(true);
  });

  it("rejects path separators and ambiguous repeated separators", () => {
    expect(
      categoryFormSchema.safeParse({ ...validForm, slug: "single/malt" })
        .success,
    ).toBe(false);
    expect(
      categoryFormSchema.safeParse({ ...validForm, slug: "single--malt" })
        .success,
    ).toBe(false);
  });

  it("accepts uploaded/static images and rejects unsafe image URLs", () => {
    expect(
      categoryFormSchema.safeParse({
        ...validForm,
        image_url: "/media/categories/cover.webp",
      }).success,
    ).toBe(true);
    expect(
      categoryFormSchema.safeParse({
        ...validForm,
        image_url: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import {
  normalizeTagSlug,
  tagFormSchema,
  toCreateTagInput,
  toUpdateTagInput,
} from "./validations";

describe("tag validation", () => {
  it("normalizes Persian and Latin slugs with the backend rules", () => {
    expect(normalizeTagSlug("  نوشیدنی ویژه  ")).toBe("نوشیدنی-ویژه");
    expect(normalizeTagSlug(" Summer  Sale! ")).toBe("summer-sale");
  });

  it("rejects malformed slugs but permits backend derivation", () => {
    expect(
      tagFormSchema.safeParse({ title: "هدیه", slug: "", description: "" })
        .success,
    ).toBe(true);
    expect(
      tagFormSchema.safeParse({
        title: "هدیه",
        slug: "gift--set",
        description: "",
      }).success,
    ).toBe(false);
    expect(
      tagFormSchema.safeParse({ title: "---", slug: "", description: "" })
        .success,
    ).toBe(false);
  });

  it("preserves nullable description semantics in write payloads", () => {
    const values = {
      title: "  هدیه  ",
      slug: " Gift Set ",
      description: "   ",
    };
    expect(toCreateTagInput(values)).toEqual({
      title: "هدیه",
      slug: "gift-set",
      description: null,
    });
    expect(toUpdateTagInput(values)).toEqual({
      title: "هدیه",
      slug: "gift-set",
      description: null,
    });
  });

  it("regenerates a cleared edit slug from the title", () => {
    expect(
      toUpdateTagInput({
        title: "هدیه ویژه",
        slug: "",
        description: "",
      }),
    ).toEqual({
      title: "هدیه ویژه",
      slug: "هدیه-ویژه",
      description: null,
    });
  });
});

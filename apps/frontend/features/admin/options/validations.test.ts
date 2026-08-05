import { describe, expect, it } from "vitest";

import {
  normalizeOptionTitle,
  optionTypeFormSchema,
  optionValueFormSchema,
} from "./validations";

describe("option validations", () => {
  it("normalizes titles to stable codes", () => {
    expect(normalizeOptionTitle("  Bottle Volume ")).toBe("bottle-volume");
    expect(normalizeOptionTitle("حجم")).toBe("");
  });

  it("accepts volume type payload", () => {
    const parsed = optionTypeFormSchema.parse({
      title: "volume",
      display_name: "حجم",
    });
    expect(parsed.title).toBe("volume");
    expect(parsed.display_name).toBe("حجم");
  });

  it("rejects empty value", () => {
    expect(() => optionValueFormSchema.parse({ value: "  " })).toThrow();
  });

  it("accepts value with sort order", () => {
    expect(
      optionValueFormSchema.parse({ value: "۷۵۰ میلی‌لیتر", sort_order: 1 }),
    ).toMatchObject({ value: "۷۵۰ میلی‌لیتر", sort_order: 1 });
  });
});

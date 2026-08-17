import { describe, expect, it } from "vitest";

import {
  editorialExcerptHint,
  editorialSlugHint,
  normalizeEditorialSlug,
} from "./editorial-fields";

describe("editorial field copy", () => {
  it("uses the same slug hint in both editors", () => {
    expect(editorialSlugHint("create")).toContain("از روی عنوان");
    expect(editorialSlugHint("edit")).toContain("نشانی عمومی");
    expect(editorialExcerptHint()).toContain("کارت‌ها");
  });

  it("normalizes Unicode slugs the same way journal already did", () => {
    expect(normalizeEditorialSlug("  راهنمای انتخاب نوشیدنی  ")).toBe(
      "راهنمای-انتخاب-نوشیدنی",
    );
    expect(normalizeEditorialSlug("Negroni Classico")).toBe("negroni-classico");
  });
});

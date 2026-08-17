import { describe, expect, it } from "vitest";

import { siteConfig } from "@/lib/site";

import {
  firstNonEmpty,
  formatKeywordList,
  parseKeywordList,
  previewPath,
  seoDocumentTitle,
  seoSnippetDescription,
  truncateSeo,
} from "./seo-preview";

describe("seo preview helpers", () => {
  it("falls back through empty title and description fields", () => {
    expect(seoDocumentTitle("", "موهیتو")).toBe(`موهیتو · ${siteConfig.name}`);
    expect(seoSnippetDescription("", "  ", "خلاصه")).toBe("خلاصه");
    expect(firstNonEmpty("", "  ", "عنوان")).toBe("عنوان");
  });

  it("truncates at the Google snippet lengths", () => {
    expect(truncateSeo("کوتاه", 60)).toBe("کوتاه");
    expect(truncateSeo("الف".repeat(70), 60).length).toBe(60);
    expect(truncateSeo("الف".repeat(70), 60).endsWith("…")).toBe(true);
  });

  it("parses keyword lists and canonical fallbacks", () => {
    expect(parseKeywordList("نعنا، یخ, رم")).toEqual(["نعنا", "یخ", "رم"]);
    expect(formatKeywordList(["نعنا", "یخ"])).toBe("نعنا، یخ");
    expect(previewPath("", "/recipes/mojito")).toBe("/recipes/mojito");
    expect(previewPath("https://example.com/r/mojito", "/recipes/x")).toBe(
      "/r/mojito",
    );
  });
});

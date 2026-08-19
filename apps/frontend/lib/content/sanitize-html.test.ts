import { describe, expect, it } from "vitest";

import {
  extractContentSteps,
  looksLikeHtml,
  sanitizeHtml,
} from "./sanitize-html";

describe("editorial content sanitation", () => {
  it("removes active content and unsafe attributes while retaining safe markup", () => {
    const result = sanitizeHtml(
      '<h1 onclick="bad()">عنوان</h1><p>متن <a href="javascript:bad()">بد</a></p><script>alert(1)</script>',
    );

    expect(result).toBe("<h2>عنوان</h2><p>متن <a>بد</a></p>");
    expect(result).not.toContain("onclick");
    expect(result).not.toContain("alert");
  });

  it("normalizes heading levels beneath the single page heading", () => {
    expect(sanitizeHtml("<h1>یک</h1><h4>چهار</h4><h6>شش</h6>")).toBe(
      "<h2>یک</h2><h3>چهار</h3><h3>شش</h3>",
    );
    expect(sanitizeHtml('<img src="/safe.webp">')).toBe(
      '<img src="/safe.webp" alt="" />',
    );
  });

  it("extracts semantic JSON-LD steps from HTML and legacy Markdown", () => {
    expect(
      extractContentSteps(
        "<ol><li>یخ را اضافه کنید</li><li>هم بزنید</li></ol>",
      ),
    ).toEqual([{ text: "یخ را اضافه کنید" }, { text: "هم بزنید" }]);
    expect(extractContentSteps("1. یخ را اضافه کنید\n2. هم بزنید")).toEqual([
      { text: "یخ را اضافه کنید" },
      { text: "هم بزنید" },
    ]);
    expect(extractContentSteps("<p>مرحلهٔ نخست</p><p>مرحلهٔ دوم</p>")).toEqual([
      { text: "مرحلهٔ نخست" },
      { text: "مرحلهٔ دوم" },
    ]);
    expect(
      extractContentSteps("<h2>مرحلهٔ نخست</h2><p>یخ را اضافه کنید</p>"),
    ).toEqual([{ text: "یخ را اضافه کنید" }]);
  });

  it("reads the method list, not every list, and keeps per-step images", () => {
    // CE-5. A tips <ul> next to the method used to land in recipeInstructions;
    // the ordered list is now the only thing that can be a step.
    expect(
      extractContentSteps(
        "<ul><li>نکته: یخ تازه</li></ul>" +
          "<ol><li><p>یخ را اضافه کنید</p><img src=\"/media/recipes/1/step.webp\" alt=\"\" />" +
          "<ul><li>ریز نکته</li></ul></li><li>هم بزنید</li></ol>",
      ),
    ).toEqual([
      {
        text: "یخ را اضافه کنید ریز نکته",
        image: "/media/recipes/1/step.webp",
      },
      { text: "هم بزنید" },
    ]);
  });

  it("distinguishes HTML from Markdown and handles empty content", () => {
    expect(looksLikeHtml("<p>متن</p>")).toBe(true);
    expect(looksLikeHtml("# متن")).toBe(false);
    expect(looksLikeHtml("<https://example.com>")).toBe(false);
    expect(looksLikeHtml("متن Markdown\n\n<div>HTML</div>")).toBe(false);
    expect(extractContentSteps("   ")).toEqual([]);
  });
});

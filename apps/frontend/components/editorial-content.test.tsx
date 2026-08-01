import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EditorialContent } from "./editorial-content";

describe("EditorialContent", () => {
  it("renders CMS HTML semantically after sanitizing it", () => {
    const markup = renderToStaticMarkup(
      <EditorialContent
        content="<h1>عنوان داخلی</h1><ol><li>مرحلهٔ نخست</li></ol>"
        emptyMessage="خالی"
      />,
    );

    expect(markup).toContain("<h2>عنوان داخلی</h2>");
    expect(markup).toContain("<ol><li>مرحلهٔ نخست</li></ol>");
    expect(markup).not.toContain("<h1>");
  });

  it("normalizes legacy Markdown headings and hardens external links", () => {
    const markup = renderToStaticMarkup(
      <EditorialContent
        content={"# عنوان\n\n[منبع](https://example.com)"}
        emptyMessage="خالی"
      />,
    );

    expect(markup).toContain("<h2>عنوان</h2>");
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noopener noreferrer"');
  });

  it("keeps Markdown autolinks and mixed documents in the Markdown path", () => {
    const autolink = renderToStaticMarkup(
      <EditorialContent
        content="نشانی <https://example.com>"
        emptyMessage="خالی"
      />,
    );
    const mixed = renderToStaticMarkup(
      <EditorialContent
        content={"**متن مهم**\n\n<div>یادداشت</div>"}
        emptyMessage="خالی"
      />,
    );

    expect(autolink).toContain('href="https://example.com"');
    expect(mixed).toContain("<strong>متن مهم</strong>");
  });

  it("uses the empty state when sanitation removes the whole body", () => {
    const markup = renderToStaticMarkup(
      <EditorialContent
        content="<script>alert('bad')</script>"
        emptyMessage="محتوا در دسترس نیست"
      />,
    );
    expect(markup).toContain('role="status"');
    expect(markup).toContain("محتوا در دسترس نیست");
  });

  it("announces a truthful empty-body state", () => {
    const markup = renderToStaticMarkup(
      <EditorialContent content=" " emptyMessage="محتوا در دسترس نیست" />,
    );
    expect(markup).toContain('role="status"');
    expect(markup).toContain("محتوا در دسترس نیست");
  });
});

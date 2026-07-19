import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SiteFooter } from "./site-footer";

describe("SiteFooter storefront discovery", () => {
  it("links to the public tag directory exactly once", () => {
    const markup = renderToStaticMarkup(<SiteFooter />);

    expect(markup.match(/href="\/tags"/g)).toHaveLength(1);
    expect(markup).toContain(">برچسب‌ها</a>");
  });
});

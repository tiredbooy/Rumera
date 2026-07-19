import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { JsonLd } from "./json-ld";

function scriptBodies(markup: string): string[] {
  return Array.from(
    markup.matchAll(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
    ),
    (match) => match[1],
  );
}

describe("JsonLd", () => {
  it("escapes API-managed markup without changing the JSON value", () => {
    const unsafe = "</script><script>alert('xss')</script>";
    const markup = renderToStaticMarkup(<JsonLd data={{ name: unsafe }} />);
    const [body] = scriptBodies(markup);

    expect(markup).not.toContain(unsafe);
    expect(markup).not.toContain("</script><script>");
    expect(body).toContain("\\u003c/script>");
    expect(JSON.parse(body)).toEqual({ name: unsafe });
  });

  it("renders one structured-data script per object", () => {
    const markup = renderToStaticMarkup(
      <JsonLd
        data={[{ "@type": "ItemList" }, { "@type": "BreadcrumbList" }]}
      />,
    );

    expect(scriptBodies(markup).map((body) => JSON.parse(body))).toEqual([
      { "@type": "ItemList" },
      { "@type": "BreadcrumbList" },
    ]);
  });
});

import { describe, expect, it } from "vitest";

import { absoluteUrl } from "@/lib/site";
import robots from "./robots";

describe("robots", () => {
  it("disallows /checkout with other private and transient surfaces", () => {
    const manifest = robots();
    const rules = Array.isArray(manifest.rules) ? manifest.rules[0] : manifest.rules;
    const disallow = rules?.disallow;

    expect(rules?.userAgent).toBe("*");
    expect(rules?.allow).toBe("/");
    expect(disallow).toEqual(
      expect.arrayContaining([
        "/api/",
        "/admin",
        "/account",
        "/login",
        "/register",
        "/reset-password",
        "/forgot-password",
        "/cart",
        "/checkout",
        "/search",
        "/forbidden",
      ]),
    );
    expect(manifest.sitemap).toBe(absoluteUrl("/sitemap.xml"));
    expect(manifest.host).toBe(absoluteUrl("/"));
  });
});

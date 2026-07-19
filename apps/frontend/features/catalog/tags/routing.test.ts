import { describe, expect, it } from "vitest";

import { parseTagID, parseTagPage, tagPageHref } from "./routing";

describe("tag storefront routing", () => {
  it("accepts only canonical positive safe-integer tag IDs", () => {
    expect(parseTagID("1")).toBe(1);
    expect(parseTagID(String(Number.MAX_SAFE_INTEGER))).toBe(
      Number.MAX_SAFE_INTEGER,
    );

    for (const value of [
      "",
      "0",
      "-1",
      "1.5",
      "01",
      " 1",
      "1 ",
      String(Number.MAX_SAFE_INTEGER + 1),
    ]) {
      expect(parseTagID(value)).toBeNull();
    }
  });

  it("defaults an omitted page and rejects ambiguous page values", () => {
    expect(parseTagPage(undefined)).toBe(1);
    expect(parseTagPage("2")).toBe(2);

    for (const value of ["", "0", "-1", "1.5", "01", " 2", ["1", "2"]]) {
      expect(parseTagPage(value)).toBeNull();
    }
  });

  it("omits the page query for page one", () => {
    expect(tagPageHref("/tags", 1)).toBe("/tags");
    expect(tagPageHref("/tags/7", 3)).toBe("/tags/7?page=3");
  });
});

import { describe, expect, it } from "vitest";

import { decodePaymentRawResponse, formatPaymentAmount } from "./presentation";

describe("payment presentation", () => {
  it("formats large decimal strings without losing precision", () => {
    expect(formatPaymentAmount("123456789012345678.90", "IRT")).toBe(
      "۱۲۳٬۴۵۶٬۷۸۹٬۰۱۲٬۳۴۵٬۶۷۸٫۹۰ تومان",
    );
    expect(formatPaymentAmount("89.90", "usd")).toBe("۸۹٫۹۰ USD");
  });

  it("decodes and formats a base64 JSON gateway response", () => {
    const raw = Buffer.from('{"id":"gateway-501","ok":true}').toString(
      "base64",
    );
    expect(decodePaymentRawResponse(raw)).toBe(
      '{\n  "id": "gateway-501",\n  "ok": true\n}',
    );
    expect(decodePaymentRawResponse("not valid base64 ***")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import { adminCustomerHref } from "./customer-href";

describe("adminCustomerHref", () => {
  it("links only a public customer UUID", () => {
    expect(
      adminCustomerHref("11111111-1111-1111-1111-111111111111"),
    ).toBe("/admin/customers/11111111-1111-1111-1111-111111111111");
  });

  it("does not invent a customer path from an internal integer", () => {
    expect(adminCustomerHref(7)).toBeUndefined();
    expect(adminCustomerHref("7")).toBeUndefined();
    expect(adminCustomerHref(undefined)).toBeUndefined();
  });
});

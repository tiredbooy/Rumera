import { describe, expect, it } from "vitest";

import { buildAdminProxyTarget } from "./admin-proxy-path";

describe("buildAdminProxyTarget", () => {
  it("encodes safe path segments and preserves the query", () => {
    const target = buildAdminProxyTarget(
      "https://api.example.com/api/v1",
      ["admin", "users", "a b"],
      "?page=2",
    );

    expect(target).toEqual({
      decodedSegments: ["admin", "users", "a b"],
      url: "https://api.example.com/api/v1/admin/users/a%20b?page=2",
    });
  });

  it.each([
    [".."],
    ["%2e%2e"],
    ["%252e%252e"],
    ["users%2f..%2fauth"],
    ["users%5c..%5cauth"],
    ["%252f"],
  ])("rejects traversal segment %s", (segment) => {
    expect(
      buildAdminProxyTarget("https://api.example.com/api/v1", [
        "admin",
        segment,
      ]),
    ).toBeNull();
  });
});

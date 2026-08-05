import { describe, expect, it } from "vitest";

import {
  isPwaRuntimeEnabled,
  pathHasSensitiveQuery,
  shouldNeverCachePath,
} from "./config";

describe("PWA cache policy", () => {
  it("blocks auth, account, admin, checkout, and API surfaces", () => {
    for (const path of [
      "/api/store/cart",
      "/admin/products",
      "/account/orders",
      "/checkout",
      "/login",
      "/register",
      "/forbidden",
    ]) {
      expect(shouldNeverCachePath(path)).toBe(true);
    }
  });

  it("allows public catalogue documents", () => {
    for (const path of ["/", "/products", "/recipes/mojito", "/offline"]) {
      expect(shouldNeverCachePath(path)).toBe(false);
    }
  });

  it("flags sensitive query tokens", () => {
    expect(pathHasSensitiveQuery("?callbackUrl=%2Faccount")).toBe(true);
    expect(pathHasSensitiveQuery("?q=whisky")).toBe(false);
  });

  it("enables runtime in production and opt-in dev", () => {
    expect(isPwaRuntimeEnabled({ NODE_ENV: "production" })).toBe(true);
    expect(isPwaRuntimeEnabled({ NODE_ENV: "development" })).toBe(false);
    expect(
      isPwaRuntimeEnabled({ NODE_ENV: "development", NEXT_PUBLIC_PWA: "1" }),
    ).toBe(true);
    expect(
      isPwaRuntimeEnabled({ NODE_ENV: "production", NEXT_PUBLIC_PWA: "0" }),
    ).toBe(false);
  });
});

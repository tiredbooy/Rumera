import { describe, expect, it } from "vitest";

import {
  accessTokenNeedsRotation,
  hasTerminalRefreshError,
} from "./access-token";

function token(exp: number) {
  const payload = btoa(JSON.stringify({ exp }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `header.${payload}.signature`;
}

describe("accessTokenNeedsRotation", () => {
  it("rotates missing, malformed, expired, and near-expiry access tokens", () => {
    const now = 1_000_000;
    expect(accessTokenNeedsRotation(undefined, now)).toBe(true);
    expect(accessTokenNeedsRotation("invalid", now)).toBe(true);
    expect(accessTokenNeedsRotation(token(1_000), now)).toBe(true);
    expect(accessTokenNeedsRotation(token(1_059), now)).toBe(true);
  });

  it("keeps access tokens with more than one minute remaining", () => {
    expect(accessTokenNeedsRotation(token(1_061), 1_000_000)).toBe(false);
  });
});

describe("hasTerminalRefreshError", () => {
  it("does not treat a persistable refresh request as terminal", () => {
    expect(hasTerminalRefreshError("RefreshRequired")).toBe(false);
    expect(hasTerminalRefreshError("RefreshAccessTokenError")).toBe(true);
  });
});

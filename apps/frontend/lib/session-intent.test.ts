// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import { stashSessionIntent, takeSessionIntent } from "./session-intent";

const KEY = "rumera_test_intent";

afterEach(() => {
  sessionStorage.clear();
});

describe("session intent", () => {
  it("round-trips a payload and clears it in the same read", () => {
    stashSessionIntent(KEY, { product_variant_id: 8 });

    expect(
      takeSessionIntent(KEY, (raw) => {
        const id = Number(raw.product_variant_id);
        return Number.isFinite(id) && id > 0 ? { id } : null;
      }),
    ).toEqual({ id: 8 });
    expect(sessionStorage.getItem(KEY)).toBeNull();
    expect(takeSessionIntent(KEY, () => ({ id: 1 }))).toBeNull();
  });

  it("drops an expired or corrupt stash", () => {
    stashSessionIntent(KEY, { product_variant_id: 8 });
    expect(
      takeSessionIntent(KEY, (raw) => ({ id: Number(raw.product_variant_id) }), Date.now() + 11 * 60 * 1000),
    ).toBeNull();

    sessionStorage.setItem(KEY, "{not json");
    expect(takeSessionIntent(KEY, () => ({ id: 1 }))).toBeNull();
  });
});

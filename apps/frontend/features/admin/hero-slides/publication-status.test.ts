import { describe, expect, it } from "vitest";

import { getHeroPublicationStatus } from "./publication-status";

const now = new Date("2026-07-27T12:00:00.000Z").getTime();

describe("hero publication status", () => {
  it("keeps explicitly inactive slides inactive regardless of their window", () => {
    expect(
      getHeroPublicationStatus(
        {
          is_active: false,
          starts_at: "2026-07-28T00:00:00.000Z",
          ends_at: null,
        },
        now,
      ),
    ).toBe("inactive");
  });

  it("distinguishes scheduled, expired, and currently active windows", () => {
    expect(
      getHeroPublicationStatus(
        { is_active: true, starts_at: "2026-07-28T00:00:00.000Z" },
        now,
      ),
    ).toBe("scheduled");
    expect(
      getHeroPublicationStatus(
        { is_active: true, ends_at: "2026-07-27T11:59:59.999Z" },
        now,
      ),
    ).toBe("expired");
    expect(
      getHeroPublicationStatus(
        {
          is_active: true,
          starts_at: "2026-07-27T12:00:00.000Z",
          ends_at: "2026-07-27T12:00:00.000Z",
        },
        now,
      ),
    ).toBe("active");
  });
});

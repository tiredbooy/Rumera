import { describe, expect, it } from "vitest";

import {
  datetimeLocalToIso,
  isoToDatetimeLocal,
  publicationKind,
  shouldConfirmUnpublish,
} from "./publication";

describe("publicationKind", () => {
  const now = new Date("2026-08-17T12:00:00Z");

  it("treats a future published_at as scheduled", () => {
    expect(publicationKind("published", "2026-08-20T09:00:00Z", now)).toBe(
      "scheduled",
    );
    expect(publicationKind("published", "2026-08-17T11:00:00Z", now)).toBe(
      "published",
    );
    expect(publicationKind("published", null, now)).toBe("published");
    expect(publicationKind("draft", "2026-08-20T09:00:00Z", now)).toBe("draft");
    expect(publicationKind("archived", null, now)).toBe("archived");
  });
});

describe("datetime conversion", () => {
  it("round-trips an ISO stamp through the local field", () => {
    const iso = "2026-08-08T14:30:00.000Z";
    const local = isoToDatetimeLocal(iso);
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    expect(datetimeLocalToIso(local)).toBe(iso);
  });

  it("treats a blank schedule as omitted, not invalid", () => {
    expect(isoToDatetimeLocal(null)).toBe("");
    expect(datetimeLocalToIso("")).toBeNull();
    expect(datetimeLocalToIso("not-a-date")).toBeNull();
  });
});

describe("shouldConfirmUnpublish", () => {
  it("only flags pulling a published item down", () => {
    expect(shouldConfirmUnpublish("published", "2026-08-01T00:00:00Z", "draft")).toBe(
      true,
    );
    expect(shouldConfirmUnpublish("published", null, "archived")).toBe(true);
    expect(
      shouldConfirmUnpublish("published", "2099-01-01T00:00:00Z", "draft"),
    ).toBe(false);
    expect(shouldConfirmUnpublish("draft", null, "published")).toBe(false);
    expect(shouldConfirmUnpublish(undefined, null, "draft")).toBe(false);
  });
});

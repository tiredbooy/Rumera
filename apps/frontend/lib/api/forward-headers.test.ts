import { describe, expect, it } from "vitest";

import {
  pickAnalyticsCookieHeader,
  pickAnalyticsSetCookies,
  pickIdempotencyKeyHeader,
} from "./forward-headers";

describe("pickIdempotencyKeyHeader", () => {
  it("forwards Idempotency-Key when present", () => {
    const headers = new Headers({ "Idempotency-Key": "intent-abc" });
    expect(pickIdempotencyKeyHeader(headers)).toEqual({
      "Idempotency-Key": "intent-abc",
    });
  });

  it("normalizes a lowercase incoming name to Idempotency-Key", () => {
    const headers = new Headers({ "idempotency-key": "intent-abc" });
    expect(pickIdempotencyKeyHeader(headers)).toEqual({
      "Idempotency-Key": "intent-abc",
    });
  });

  it("does not invent a key when the header is missing", () => {
    expect(pickIdempotencyKeyHeader(new Headers())).toEqual({});
  });

  it("does not invent a key when the header is empty", () => {
    expect(
      pickIdempotencyKeyHeader(new Headers({ "Idempotency-Key": "" })),
    ).toEqual({});
  });
});

describe("pickAnalyticsCookieHeader", () => {
  it("forwards only sid and did when present", () => {
    const headers = new Headers({
      cookie: "sid=aaaa; other=nope; did=bbbb; session=auth",
    });
    expect(pickAnalyticsCookieHeader(headers)).toEqual({
      Cookie: "sid=aaaa; did=bbbb",
    });
  });

  it("forwards a single analytics cookie without inventing the other", () => {
    expect(
      pickAnalyticsCookieHeader(new Headers({ cookie: "sid=only-sid" })),
    ).toEqual({ Cookie: "sid=only-sid" });
  });

  it("does not invent sid/did when cookies are missing", () => {
    expect(pickAnalyticsCookieHeader(new Headers())).toEqual({});
    expect(
      pickAnalyticsCookieHeader(new Headers({ cookie: "session=auth" })),
    ).toEqual({});
  });

  it("does not invent sid/did when values are empty", () => {
    expect(
      pickAnalyticsCookieHeader(new Headers({ cookie: "sid=; did=" })),
    ).toEqual({});
  });
});

describe("pickAnalyticsSetCookies", () => {
  it("keeps only sid/did Set-Cookie lines", () => {
    expect(
      pickAnalyticsSetCookies([
        "sid=aaaa; Path=/; HttpOnly",
        "session=auth; Path=/",
        "did=bbbb; Path=/; HttpOnly",
      ]),
    ).toEqual(["sid=aaaa; Path=/; HttpOnly", "did=bbbb; Path=/; HttpOnly"]);
  });

  it("does not invent Set-Cookie lines", () => {
    expect(pickAnalyticsSetCookies(["session=auth; Path=/"])).toEqual([]);
    expect(pickAnalyticsSetCookies([])).toEqual([]);
  });
});

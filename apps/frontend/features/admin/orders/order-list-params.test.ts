import { describe, expect, it } from "vitest";

import {
  adminOrdersHref,
  dayBoundRFC3339,
  hasAdminOrderListFilters,
  parseAdminOrderListParams,
  parseIsoDate,
  toAdminOrderListQuery,
} from "./order-list-params";

describe("parseAdminOrderListParams", () => {
  it("defaults to page 1 with no filters", () => {
    expect(parseAdminOrderListParams({})).toEqual({ page: 1 });
  });

  it("keeps allowlisted status, user_id, and calendar dates", () => {
    expect(
      parseAdminOrderListParams({
        page: "2",
        status: "paid",
        user_id: "7",
        paid_from: "2026-08-01",
        paid_to: "2026-08-16",
      }),
    ).toEqual({
      page: 2,
      status: "paid",
      userId: 7,
      paidFrom: "2026-08-01",
      paidTo: "2026-08-16",
    });
  });

  it("drops invalid status, user_id, dates, and pages", () => {
    expect(
      parseAdminOrderListParams({
        page: "0",
        status: "not-a-status",
        user_id: "00",
        paid_from: "2026-13-01",
        paid_to: "yesterday",
      }),
    ).toEqual({ page: 1 });
  });
});

describe("dayBoundRFC3339", () => {
  it("emits RFC3339 UTC without fractional seconds", () => {
    const start = dayBoundRFC3339("2026-08-16", "start");
    const end = dayBoundRFC3339("2026-08-16", "end");
    expect(start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(end).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(Date.parse(start!)).toBeLessThan(Date.parse(end!));
  });

  it("rejects non-calendar values", () => {
    expect(parseIsoDate("2026-02-31")).toBeUndefined();
    expect(dayBoundRFC3339("2026-02-31", "start")).toBeUndefined();
  });
});

describe("toAdminOrderListQuery", () => {
  it("sends status, user_id, and paid_at bounds to GET /admin/orders", () => {
    const query = toAdminOrderListQuery({
      page: 2,
      status: "shipped",
      userId: 9,
      paidFrom: "2026-08-01",
      paidTo: "2026-08-16",
    });
    expect(query).toMatchObject({
      page: 2,
      limit: 50,
      sortBy: "created_at",
      orderBy: "desc",
      status: "shipped",
      user_id: 9,
    });
    expect(query.paid_from).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(query.paid_to).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(Date.parse(query.paid_from!)).toBeLessThan(
      Date.parse(query.paid_to!),
    );
  });

  it("omits unset filters so the API is not client-filtered", () => {
    expect(toAdminOrderListQuery({ page: 1 })).toEqual({
      page: 1,
      limit: 50,
      sortBy: "created_at",
      orderBy: "desc",
    });
  });
});

describe("adminOrdersHref", () => {
  it("omits page 1 and empty filters", () => {
    expect(adminOrdersHref({ page: 1 })).toBe("/admin/orders");
    expect(
      adminOrdersHref(
        {
          page: 3,
          status: "paid",
          userId: 4,
          paidFrom: "2026-08-01",
        },
        3,
      ),
    ).toBe("/admin/orders?status=paid&user_id=4&paid_from=2026-08-01&page=3");
  });

  it("resets to page 1 when building a filter href", () => {
    expect(hasAdminOrderListFilters({ page: 2, status: "paid" })).toBe(true);
    expect(adminOrdersHref({ page: 2, status: "paid" }, 1)).toBe(
      "/admin/orders?status=paid",
    );
  });
});

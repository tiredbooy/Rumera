import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OrderListFilters } from "./order-list-filters";

describe("OrderListFilters", () => {
  it("does not ask the operator to type a Gregorian native date", () => {
    const html = renderToStaticMarkup(
      <OrderListFilters
        filters={{ page: 1, paidFrom: "2026-08-01", paidTo: "2026-08-09" }}
      />,
    );
    expect(html).not.toContain('type="date"');
    expect(html).toContain('name="paid_from"');
    expect(html).toContain('name="paid_to"');
  });

  it("does not name an HTTP endpoint on the filter bar", () => {
    const html = renderToStaticMarkup(
      <OrderListFilters filters={{ page: 1 }} />,
    );
    expect(html).not.toContain("GET /admin/orders");
    expect(html).toContain("همهٔ سفارش‌ها");
  });
});

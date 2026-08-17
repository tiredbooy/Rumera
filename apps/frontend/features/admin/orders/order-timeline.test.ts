import { describe, expect, it } from "vitest";

import { buildOrderTimeline } from "./order-timeline";
import type { AdminOrder } from "./types";

const order = {
  id: 1,
  status: "paid",
  payment_method: "wallet",
  subtotal: 1,
  discount_amount: 0,
  shipping_cost: 0,
  tax_amount: 0,
  total_amount: 1,
  created_at: "2026-06-11T10:00:00Z",
  items: [],
} as AdminOrder;

describe("buildOrderTimeline", () => {
  it("uses only stamps the order already carries", () => {
    const events = buildOrderTimeline({
      ...order,
      status: "delivered",
      paid_at: "2026-06-11T10:05:00Z",
      shipped_at: "2026-06-12T08:00:00Z",
      delivered_at: "2026-06-13T16:00:00Z",
    });
    expect(events.map((event) => event.key)).toEqual([
      "created",
      "paid",
      "shipped",
      "delivered",
    ]);
    expect(events.at(-1)?.current).toBe(true);
    expect(events.at(-1)?.at).toBe("2026-06-13T16:00:00Z");
  });

  it("adds the live status when it has no stamp of its own", () => {
    const events = buildOrderTimeline({
      ...order,
      status: "processing",
      paid_at: "2026-06-11T10:05:00Z",
    });
    expect(events.map((event) => [event.key, event.current])).toEqual([
      ["created", false],
      ["paid", false],
      ["processing", true],
    ]);
    expect(events.at(-1)?.at).toBeUndefined();
  });
});

/**
 * Guards the semantic mapping of every status badge. Colour is meaning here:
 * a refund is not a success, a ban is not merely "inactive". If a mapping
 * moves, that is a product decision and this file should be the thing that
 * makes you say it out loud.
 */
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GiftCardStatusBadge } from "@/features/admin/gift-cards/components/gift-card-status-badge";
import { ProductStatusBadge } from "@/features/admin/products/components/product-status-badge";
import { PaymentStatusBadge } from "@/features/admin/payments/components/payment-status-badge";
import { UserStatusBadge } from "@/features/customers/components/user-status-badge";
import { InventoryStockBadge } from "@/features/inventory/components/inventory-stock-badge";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import type { OrderStatus } from "@/features/orders/types";
import type { PaymentStatus } from "@/features/payments/types";
import { ReviewStatusBadge } from "@/features/reviews/review-status-badge";
import type { ReviewStatus } from "@/features/reviews/types";

/** The rendered semantic: the tone token, or the variant when no tone is set. */
function semantic(node: ReactElement): string {
  const html = renderToStaticMarkup(node);
  return (
    html.match(/data-tone="([^"]+)"/)?.[1] ??
    html.match(/data-variant="([^"]+)"/)?.[1] ??
    "none"
  );
}

describe("order status semantics", () => {
  const cases: Array<[OrderStatus, string]> = [
    ["pending", "warning"],
    ["payment_failed", "destructive"],
    ["paid", "success"],
    ["processing", "info"],
    ["ready_to_ship", "info"],
    ["shipped", "info"],
    ["out_for_delivery", "info"],
    ["delivered", "success"],
    ["refund_requested", "warning"],
    ["refund_approved", "info"],
    ["refunded", "neutral"],
    ["partially_refunded", "neutral"],
    ["cancelled", "destructive"],
  ];

  it.each(cases)("%s reads as %s", (status, tone) => {
    expect(semantic(<OrderStatusBadge status={status} />)).toBe(tone);
  });

  it("never paints a refund as success", () => {
    for (const status of [
      "refunded",
      "partially_refunded",
    ] as const satisfies readonly OrderStatus[]) {
      expect(semantic(<OrderStatusBadge status={status} />)).not.toBe("success");
    }
  });
});

describe("payment status semantics", () => {
  const cases: Array<[PaymentStatus, string]> = [
    ["pending", "warning"],
    ["succeeded", "success"],
    ["failed", "destructive"],
    ["refunded", "neutral"],
    ["partially_refunded", "neutral"],
  ];

  it.each(cases)("%s reads as %s", (status, tone) => {
    expect(semantic(<PaymentStatusBadge status={status} />)).toBe(tone);
  });
});

describe("review status semantics", () => {
  const cases: Array<[ReviewStatus, string]> = [
    ["pending", "warning"],
    ["approved", "success"],
    ["rejected", "destructive"],
  ];

  it.each(cases)("%s reads as %s", (status, tone) => {
    expect(semantic(<ReviewStatusBadge status={status} />)).toBe(tone);
  });
});

describe("inventory stock semantics", () => {
  it.each([
    ["in_stock", "success"],
    ["low", "warning"],
    ["out", "destructive"],
  ] as const)("%s reads as %s", (status, tone) => {
    expect(semantic(<InventoryStockBadge status={status} />)).toBe(tone);
  });
});

describe("user status semantics", () => {
  it("active is success", () => {
    expect(semantic(<UserStatusBadge active />)).toBe("success");
  });

  it("banned is destructive, and outranks the active flag", () => {
    expect(semantic(<UserStatusBadge active banned />)).toBe("destructive");
    expect(semantic(<UserStatusBadge active={false} banned />)).toBe(
      "destructive",
    );
  });

  it("merely inactive is neutral, not a failure", () => {
    expect(semantic(<UserStatusBadge active={false} />)).toBe("neutral");
  });
});

describe("product publish semantics", () => {
  it("published is success and draft is warning", () => {
    expect(semantic(<ProductStatusBadge active />)).toBe("success");
    expect(semantic(<ProductStatusBadge active={false} />)).toBe("warning");
  });
});

describe("gift card status semantics", () => {
  it("active is success but a spent card is neutral", () => {
    expect(semantic(<GiftCardStatusBadge status="active" />)).toBe("success");
    expect(semantic(<GiftCardStatusBadge status="redeemed" />)).toBe("neutral");
    expect(semantic(<GiftCardStatusBadge status="disabled" />)).toBe("neutral");
  });
});

describe("no status badge ships a raw Tailwind ramp", () => {
  it("renders only semantic tokens", () => {
    const html = [
      <OrderStatusBadge key="o" status="pending" />,
      <PaymentStatusBadge key="p" status="refunded" />,
      <ReviewStatusBadge key="r" status="approved" />,
      <InventoryStockBadge key="i" status="low" />,
      <UserStatusBadge key="u" active />,
      <GiftCardStatusBadge key="g" status="active" />,
      <ProductStatusBadge key="pr" active />,
    ]
      .map((node) => renderToStaticMarkup(node))
      .join("");

    expect(html).not.toMatch(
      /-(emerald|amber|green|red|blue|yellow|sky|rose|orange)-\d/,
    );
  });
});

"use client";

import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { usePayOrder } from "@/features/orders/hooks";
import {
  canStartOrderPay,
  orderPayCtaLabel,
  usablePaymentUrl,
} from "@/features/orders/labels";
import type { Order } from "@/features/orders/types";
import { apiErrorToast } from "@/lib/api/user-facing-error";

/**
 * Starts (or resumes) gateway payment for an unpaid order and redirects.
 *
 * Renders nothing when the order cannot start a gateway payment — paid-like,
 * cancelled, or wallet, which settles at checkout and is refused by
 * `POST /orders/:id/pay`. Callers can render it unconditionally.
 */
export function OrderPayButton({
  order,
  className,
}: {
  order: Order;
  className?: string;
}) {
  const pay = usePayOrder();

  if (!canStartOrderPay(order)) return null;

  function doPay() {
    pay.mutate(order.id, {
      onSuccess: (paid) => {
        const href = usablePaymentUrl(paid.payment_url);
        if (href) {
          window.location.assign(href);
          return;
        }
        // Never fabricate a start URL from transaction_id — surface the gap.
        toast.message("لینک درگاه برنگشت", {
          description: noGatewayUrlCopy(paid),
        });
      },
      onError: (err) => {
        const t = apiErrorToast(err, "شروع پرداخت ناموفق بود");
        toast.error(t.title, { description: t.description });
      },
    });
  }

  return (
    <Button
      className={className}
      disabled={pay.isPending}
      data-testid="order-pay-cta"
      onClick={doPay}
    >
      {pay.isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <CreditCard className="size-4" />
      )}
      {orderPayCtaLabel(order.status)}
    </Button>
  );
}

export function noGatewayUrlCopy(order: Order): string {
  const tx = order.transaction_id?.trim();
  if (tx) {
    return `شناسهٔ پرداخت: ${tx}. لینک شروع از سرور نیامد و لینکی ساخته نشد.`;
  }
  return "لینک شروع پرداخت از سرور نیامد و لینکی ساخته نشد.";
}

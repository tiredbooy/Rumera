"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import { useCreateProductAlert } from "@/features/product-alerts/hooks";
import type { ProductAlertType } from "@/features/product-alerts/types";
import { ApiClientError } from "@/lib/api/store-client";
import { stashSessionIntent, takeSessionIntent } from "@/lib/session-intent";

export const ALERT_INTENT_KEY = "rumera_alert_intent";

export type AlertIntent = {
  product_variant_id: number;
  alert_type: ProductAlertType;
};

function parseAlertIntent(raw: Record<string, unknown>): AlertIntent | null {
  const variantId = Number(raw.product_variant_id);
  const type = raw.alert_type;
  if (!Number.isFinite(variantId) || variantId < 1) return null;
  if (type !== "restock" && type !== "price_drop") return null;
  return {
    product_variant_id: Math.trunc(variantId),
    alert_type: type,
  };
}

export function stashAlertIntent(intent: AlertIntent): void {
  stashSessionIntent(ALERT_INTENT_KEY, intent);
}

export function takeAlertIntent(now = Date.now()): AlertIntent | null {
  return takeSessionIntent(ALERT_INTENT_KEY, parseAlertIntent, now);
}

export function PendingAlertIntent() {
  const { status } = useSession();
  const { mutate } = useCreateProductAlert();

  React.useEffect(() => {
    if (status !== "authenticated") return;
    const intent = takeAlertIntent();
    if (!intent) return;

    mutate(intent, {
      onSuccess: () =>
        toast.success(
          intent.alert_type === "restock"
            ? "هنگام موجود شدن به شما اطلاع می‌دهیم"
            : "هنگام کاهش قیمت به شما اطلاع می‌دهیم",
        ),
      onError: (error) =>
        toast.error(
          error instanceof ApiClientError && error.code === "CONFLICT"
            ? "این محصول هم‌اکنون موجود است"
            : "ثبت اعلان ناموفق بود",
        ),
    });
  }, [status, mutate]);

  return null;
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import { useBulkAddCartItems } from "@/features/cart/api";
import type { AddCartItemInput, BulkAddCartResult } from "@/features/cart/types";
import { stashSessionIntent, takeSessionIntent } from "@/lib/session-intent";
import { apiErrorToast } from "@/lib/api/user-facing-error";

import { bulkFeedback } from "./bulk-feedback";

export const BULK_ADD_INTENT_KEY = "rumera_bulk_add_intent";

function parseBulkIntent(raw: Record<string, unknown>): AddCartItemInput[] | null {
  if (!Array.isArray(raw.items)) return null;
  const items: AddCartItemInput[] = [];
  for (const entry of raw.items) {
    if (!entry || typeof entry !== "object") return null;
    const variantId = Number((entry as { product_variant_id?: unknown }).product_variant_id);
    const quantity = Number((entry as { quantity?: unknown }).quantity);
    if (!Number.isFinite(variantId) || variantId < 1) return null;
    if (!Number.isFinite(quantity) || quantity < 1) return null;
    items.push({
      product_variant_id: Math.trunc(variantId),
      quantity: Math.trunc(quantity),
    });
  }
  return items.length > 0 ? items : null;
}

export function stashBulkAddIntent(items: AddCartItemInput[]): void {
  stashSessionIntent(BULK_ADD_INTENT_KEY, { items });
}

export function takeBulkAddIntent(now = Date.now()): AddCartItemInput[] | null {
  return takeSessionIntent(BULK_ADD_INTENT_KEY, parseBulkIntent, now);
}

function reportBulk(result: BulkAddCartResult, router: { push: (href: string) => void }) {
  const feedback = bulkFeedback(result);
  if (feedback.tone === "success") {
    toast.success(feedback.title, {
      action: { label: "مشاهدهٔ سبد", onClick: () => router.push("/cart") },
    });
    return;
  }
  if (feedback.tone === "warning") {
    toast.warning(feedback.title, { description: feedback.description });
    return;
  }
  toast.error(feedback.title, { description: feedback.description });
}

export function PendingBulkAddIntent() {
  const { status } = useSession();
  const router = useRouter();
  const { mutate } = useBulkAddCartItems();

  React.useEffect(() => {
    if (status !== "authenticated") return;
    const items = takeBulkAddIntent();
    if (!items) return;

    mutate(items, {
      onSuccess: (result) => reportBulk(result, router),
      onError: (error) => {
        const t = apiErrorToast(error, "افزودن خودکار مواد انجام نشد");
        toast.error(t.title, { description: t.description });
      },
    });
  }, [status, mutate, router]);

  return null;
}

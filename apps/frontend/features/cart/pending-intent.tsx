"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import { useAddCartItem } from "@/features/cart/api";
import { isLineUnorderable } from "@/features/cart/availability";
import { cartMutationErrorMessage } from "@/features/cart/errors";
import type { AddCartItemInput } from "@/features/cart/types";

const KEY = "rumera_cart_intent";

/**
 * A stashed intent means "I pressed add-to-cart seconds ago", not "add this
 * some day". Ten minutes covers a login (or a registration + login) round trip
 * with room to spare; anything older is dropped rather than replayed.
 */
const TTL_MS = 10 * 60 * 1000;

type StoredIntent = AddCartItemInput & { expires_at: number };

/**
 * Remember the add-to-cart a guest just attempted so the login bounce
 * (`add-to-cart-button.tsx`) does not silently lose it.
 *
 * sessionStorage, not localStorage: the stash dies with the tab, so it can
 * never fire on some unrelated later visit. Only the variant id and the
 * quantity are kept — price, stock and availability are re-read from the
 * server by the normal add path on replay.
 */
export function stashAddToCartIntent(input: AddCartItemInput): void {
  try {
    const intent: StoredIntent = { ...input, expires_at: Date.now() + TTL_MS };
    sessionStorage.setItem(KEY, JSON.stringify(intent));
  } catch {
    // Private mode / quota: losing the intent is just today's behaviour.
  }
}

/**
 * Read-and-clear. The removal happens *before* the value is handed back, so a
 * refresh, a back-navigation or a second effect pass finds an empty stash and
 * the replay can only ever run once — even if the replay itself then fails.
 */
export function takeAddToCartIntent(now = Date.now()): AddCartItemInput | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredIntent> | null;
    const expiresAt = Number(parsed?.expires_at);
    const variantId = Number(parsed?.product_variant_id);
    const quantity = Number(parsed?.quantity);
    if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;
    if (!Number.isFinite(variantId) || variantId < 1) return null;
    if (!Number.isFinite(quantity) || quantity < 1) return null;
    return {
      product_variant_id: Math.trunc(variantId),
      quantity: Math.trunc(quantity),
    };
  } catch {
    return null;
  }
}

/**
 * PendingCartIntent — invisible. Replays the add-to-cart a guest was bounced
 * out of, once, right after they authenticate. Mounted in the storefront
 * layout so it sees whichever `callbackUrl` the shopper was returned to.
 *
 * The replay goes through the ordinary `POST /cart/items`, so stock, price and
 * availability are re-validated server-side; nothing from the stash is trusted
 * beyond "which variant, how many".
 */
export function PendingCartIntent() {
  const { status } = useSession();
  const router = useRouter();
  const { mutate } = useAddCartItem();

  React.useEffect(() => {
    if (status !== "authenticated") return;
    const intent = takeAddToCartIntent();
    if (!intent) return;

    mutate(intent, {
      onSuccess: (cart) => {
        const action = {
          label: "مشاهدهٔ سبد",
          onClick: () => router.push("/cart"),
        };
        const line = cart.items?.find(
          (item) => item.variant_id === intent.product_variant_id,
        );
        // U-3: the server accepted the row but it is above sellable stock —
        // say so here instead of letting checkout be the one to break the news.
        if (line && isLineUnorderable(line)) {
          toast.warning("کالای انتخابی به سبد افزوده شد اما موجودی کافی نیست", {
            description: "پیش از پرداخت، تعداد را در سبد خرید اصلاح کنید.",
            action,
          });
          return;
        }
        toast.success("کالای انتخابی پس از ورود به سبد خرید افزوده شد", {
          action,
        });
      },
      onError: (error) =>
        toast.error("افزودن خودکار به سبد انجام نشد", {
          description: cartMutationErrorMessage(error),
        }),
    });
  }, [status, mutate, router]);

  return null;
}

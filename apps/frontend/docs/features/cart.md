# Storefront cart

**Who this is for:** FE engineers changing cart lines, qty, or remove UX.

**Journey context:** [storefront-commerce.md](./storefront-commerce.md) ·
backend [cart API](../../../backend/docs/api/cart.md)

---

## Surfaces

| Surface | Path |
|---------|------|
| Cart page | `/cart` → `features/cart/components/cart-view.tsx` |
| Header drawer | `cart-button.tsx` → shared `CartLines` |
| Add from catalogue | `add-to-cart-button.tsx` (PR-004 — not this file) |

Cart is **auth-only**. Guests see a login wall; `useCart(enabled)` stays off
until signed in. There is no cookie/guest basket.

## Line edits (PR-031a)

Qty and remove go through `useUpdateCartItem` / `useRemoveCartItem`:

1. `onMutate` cancels in-flight cart queries, snapshots the cache, writes
   optimistic qty/line totals (or drops the line).
2. `onError` rolls the snapshot back. Shopper copy stays on
   `cartMutationErrorMessage` (`OUT_OF_STOCK` and other stock codes are not
   swallowed).
3. `onSuccess` seeds the server cart; `onSettled` invalidates so drawer and
   page stay aligned.

Only the mutating `item.id` is disabled/dimmed. Sibling lines stay usable.

Remove toasts «از سبد خرید حذف شد» with a «بازگردانی» action that
`addCartItem`s the snapshot (`product_variant_id` + qty). Undo failures use
the same error mapper.

## Related

- Errors: `features/cart/errors.ts` · [api-layer.md](../platform/api-layer.md)
- Wishlist gold-standard optimistic hooks: `features/wishlist/hooks.ts`

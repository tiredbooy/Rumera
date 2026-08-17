---
tags:
  - frontend
  - commerce
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 04 Frontend]]


# Storefront Commerce FE

Browse → card/PDP → cart → checkout → confirmation.

- Truthful price/stock: `catalogue-presentation`
- Card wishlist is variant-scoped (PR-080n). Multi-option cards link the heart to the PDP and say options must be chosen; they do not invent a product-level wishlist.
- `/search` and `/products` distinguish `listProducts` failure from zero hits (PR-080f). Outage = retry card, not empty catalogue copy.
- `/products` list metadata noindexes search/brand/sort/`page>1` variants and canonicalizes to `/products` (PR-080l · [[Content and SEO]])
- Home `getFeaturedBrands` is live `GET /brands` (PR-080i). Empty → `[]`; outage throws. No hardcoded liquor names.
- Unknown category slug, or a slug that is not in the public tree, is `notFound()` (PR-080e)
- Totals/shipping from API only
- **Auth-required cart is intended** (PR-004c). Store [[BFF Proxies]] + Go cart are login-gated; guests get `401`, not a cookie/anonymous basket. Product must ask before anyone builds a guest cart. See [[Auth and Sessions]] · [[Cart and Checkout]]
- Guest UI: add-to-cart toasts login + `/login?callbackUrl=…`; `/cart` and the header drawer show a login wall and do **not** fetch (`useCart(enabled=authed)`). Edge proxy does not bounce `/cart` (only `/account` + `/admin`); checkout uses `requireUser` ([[Journey First purchase]])
- Post-login add-to-cart **500** was `UNIQUE NOT NULL carts.user_id` (PR-004a, [[Cart Backend]]), not a missing guest cart
- Cart mutation failures (`AddToCartButton`, wishlist add, cart-line qty/remove) use `cartMutationErrorMessage` → [[Error model]] (PH-012d)
- Qty/remove are optimistic (PR-031a): `useUpdateCartItem` / `useRemoveCartItem` snapshot the cart, roll back on error, and reconcile from the server cart. Only the mutating line is busy. Remove toasts «از سبد خرید حذف شد» with «بازگردانی» that re-adds the snapshot via `addCartItem`. See [[Cart and Checkout]] · `apps/frontend/docs/features/cart.md`
- Place order → [[Orders]] · reserve [[Inventory]] · pending [[Payments]]
- Checkout payment step links to `/account/rewards` ([[Loyalty FE]]); no invented unpaid earn (PR-003m)
- Wallet top-up / gift purchase pending: «پرداخت در درگاه» only if API `payment_url` is non-empty (PR-030c · [[Journey Account wallet top-up]]). Order create has no `payment_url` yet (PR-020f) — do not invent one.
- Confirmation hero matches order status (PR-030a): pending / failed must not say «سفارش تأیید شد» ([[Playbook Confirmation status copy]])
- Checkout has no local `api.ts` / `types.ts` / `validations.ts` (PR-035d). Wizard consumes [[Cart and Checkout]] domain modules (`addresses`, `cart`, `orders`, `shipping`, `coupons`)

Related: [[Catalogue]] · [[Cart and Checkout]] · [[Search FE]] · [[Recipes and Journal]]

Bridge: `apps/frontend/docs/features/storefront-commerce.md`

#frontend #commerce

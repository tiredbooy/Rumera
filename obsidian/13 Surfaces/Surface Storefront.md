---
tags: [surface]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 13 Surfaces]]


# Surface: Storefront

Public shopping experience under `(storefront)` route group (no URL prefix).

Examples: `/`, `/products`, `/categories`, `/search`, `/cart`, `/checkout`, `/recipes`, `/journal`, `/offline`, `/contact`

Chrome: header/nav, footer, [[Compliance Age Gate]]. Layout loads `getCategoryTree` for the header only and settles a throw to `[]` so a tree 5xx cannot 500 the whole public site (PR-080d). Empty nav is honest — no invented fallback list. Depth: `apps/frontend/docs/features/storefront.md`

Header and footer read live `GET /settings` (PR-080a): `store.name`, socials (omit empty / `#`), `shipping.freeThreshold` for the promo bar. Settings 5xx settles in chrome so it cannot 500 the public site. Do not invent contact claims — published email / phone / hours only.

Maintenance gate (PR-080b): `(storefront)` layout reads `getPublicSiteSettingsOrNull`. When `maintenance.enabled`, shopping chrome and page content are replaced by `maintenance.message` (or «در حال تعمیر» if empty). Settings 5xx fails open. Admin, account, and auth layouts stay up.

`/contact` reads live `GET /settings` (`contact.supportEmail` / `supportPhone` / `address` / `workingHours`). Missing fields are omitted — no invented WhatsApp or hours. Settings 5xx is an error state; published-but-empty contact is an empty state.

`/search` and `/products` keep the same split for `listProducts` (PR-080f): API failure is a retryable alert, not «۰ نتیجه» / «محصولی برای نمایش نیست». See [[Search FE]] · [[Storefront Commerce FE]].

Newsletter (PR-080g): no subscribe API. Home band and footer show «به‌زودی» and do **not** take an email or promise first-order free ship. Home may link to `/contact`. Depth: `apps/frontend/docs/features/storefront.md`

About / FAQ (PR-080h): no invented +۱٬۲۰۰ / +۸۰ / ۴٫۹ / ۳۲ استان. FAQ does not claim a returns page; support is `/contact`. Age gate does not invent `/terms` or `/privacy`. `#` socials stay omitted by chrome settings (PR-080a).

Home brands (PR-080i): `getFeaturedBrands` is live `GET /brands`. Empty → `[]`. 5xx/network **throws** (home `error.tsx`). No hardcoded Johnnie Walker / Hennessy list. · [[Hero and Home]] · [[Catalogue]]

`/cart` is a public URL (edge proxy does **not** bounce it). The view login-walls guests and does not fetch. Cart data lives only on the authenticated store BFF (`/api/store/cart`). **No guest/cookie cart** — intended, PR-004c. Checkout is `requireUser`. See [[Cart and Checkout]] · [[Auth and Sessions]] · [[Journey First purchase]] · [[Storefront Commerce FE]]

Related: [[Hero and Home]] · [[Catalogue]] · [[Cart and Checkout]] · [[Search FE]] · [[PWA and Brand]] · [[Surfaces MOC]]

# Storefront chrome

**Who this is for:** anyone changing the public header, footer, age gate, or
`(storefront)` layout.

Commerce flows (catalogue, cart, checkout) live in
[storefront-commerce.md](./storefront-commerce.md). This note is the **shell**
that wraps every public URL.

---

## Shell

```
app/(storefront)/layout.tsx
  ├── SiteHeader (category tree → mega-menu / mobile drawer)
  ├── <main id="main-content">  {children}
  ├── SiteFooter
  ├── AgeGate
  └── ReferralTracker
```

The route group adds **no URL prefix**. Auth and account dashboards have their
own layouts and do not inherit this chrome.

| Piece | Path |
|-------|------|
| Layout | `app/(storefront)/layout.tsx` |
| Header | `features/storefront/navigation/components/site-header.tsx` |
| Footer | `components/site-footer.tsx` |
| Age gate | `features/compliance/components/age-gate.tsx` |
| Referral capture | `features/referral/components/referral-tracker.tsx` |
| Tree fetch | `features/catalog/categories/api.ts` → `getCategoryTree` |

---

## Category tree isolation (PR-080d)

`getCategoryTree()` is called **only** to feed the header. The shared fetcher
still throws on 5xx/network — category index/detail pages handle that themselves.

The **layout** must not let that throw escape. A rejected tree becomes `[]`.
Header already tolerates an empty list (no mega-menu nodes). Do **not** invent a
fallback brand/category list; an empty tree is the honest outage state.

If this settle is omitted, one upstream failure 500s **every** public page,
including pages that do not need categories (cart, journal, about, age gate).

---

## Contact page (PR-080c)

`/contact` is a real public route (`app/(storefront)/contact`). Footer and FAQ
already link here. The page reads `getPublicSiteSettings()` (`GET /settings`)
and shows only the published `contact` fields:

| Field | Shown as |
|-------|----------|
| `supportEmail` | ایمیل پشتیبانی (`mailto:`) |
| `supportPhone` | تلفن پشتیبانی (`tel:` when the value is a phone) |
| `address` | نشانی |
| `workingHours` | ساعات کاری |

Empty, whitespace-only, or absent fields are **omitted**. Do not invent
WhatsApp, socials, a contact form, or default hours. A failed settings read is
an error state; a successful read with no published contact fields is an empty
state. Those two must stay distinct.

---

## Public settings in chrome (PR-080a)

Header and footer read `getPublicSiteSettings()` (`GET /settings`) themselves so
the storefront layout does not have to change. A failed read settles to `null`
via `getPublicSiteSettingsOrNull` — chrome still renders. Do **not** let a
settings 5xx 500 every public page. The fetcher is React-`cache`d per request so
header, footer, and `/contact` share one upstream call.

| Field | Chrome |
|-------|--------|
| `store.name` | Header home label, mobile drawer title, footer copyright. Empty / missing falls back to the brand wordmark `رومرا`. |
| `store.tagline` | Header logo caption when published. |
| `store.description` | Footer blurb when published; otherwise the generic catalogue line. |
| `shipping.freeThreshold` | Promo bar: «ارسال رایگان برای سفارش‌های بالای {formatPrice}». `0` / missing → no invented ۵٬۰۰۰٬۰۰۰. |
| `shipping.note` | Promo bar only when there is no positive threshold. |
| `social.*` | Footer icons. Empty, whitespace, and `#` are omitted. Handles become platform URLs; `http(s)` URLs are used as-is. No Threads / RSS unless those keys exist. |
| `contact.supportEmail` / `supportPhone` / `workingHours` | Footer shows **published** fields only. No invented WhatsApp, hours, or placeholder numbers. Full contact is `/contact` (PR-080c). |
| `maintenance` | `(storefront)` layout: `enabled` replaces chrome + children with `MaintenanceScreen`. Empty message → «در حال تعمیر». Settings 5xx fails open. Admin / account / auth stay up. |

Helpers live in `features/storefront/navigation/chrome-settings.ts`.

---

## About and FAQ (PR-080h)

`/about` and `/faq` are static marketing pages. They must not invent
catalogue counts, ratings, coverage, or routes that do not exist.

| Surface | Honest state |
|---------|--------------|
| About highlights / timeline | Qualitative copy only. No «+۱٬۲۰۰ محصول», «+۸۰ برند», «۴٫۹», or «۳۲ استان». |
| FAQ returns | Damage / mismatch is handled with support. There is **no** `/returns` page — point shoppers to `/contact`. |
| FAQ shipping | Do not hardcode a ۵٬۰۰۰٬۰۰۰ free-ship threshold. Checkout shows live cost; the promo bar reads `shipping.freeThreshold` (PR-080a). |
| FAQ account | Cart and checkout require login (PR-004c). Do not claim guest checkout. |
| Age gate | May mention terms / privacy in prose. Do **not** invent `/terms` or `/privacy` URLs. |
| Footer socials | Already settings-backed (PR-080a). Empty / `#` hrefs stay omitted. |

FAQ JSON-LD is the same answer list as the accordion — keep them in one
source.

---

## Newsletter (PR-080g)

There is **no** public subscribe API. Home (`NewsletterSection`) and the footer
must not collect an email or toast success.

| Surface | Honest state |
|---------|--------------|
| Home band | Copy + «به‌زودی». No `<form>`, no email input. No first-order free-ship (or other member perk) promise. Optional link to the real `/contact` page. |
| Footer | One-line «خبرنامه به‌زودی — فعلاً ایمیلی دریافت نمی‌شود.» No input or submit. |

Do not invent a mailing-list backend on the frontend. When a subscribe endpoint
exists, wire both surfaces to it and drop the stub copy.

---

## Home brands (PR-080i)

`getFeaturedBrands()` (`features/catalog/brands/api.ts`) reads `GET /brands`.
It must not invent Western liquor names.

| Catalogue state | Result |
|-----------------|--------|
| Success + rows | Real `{id, title, slug}` chips (marquee deep-links when `slug` is set). |
| Success + 0 valid rows | `[]`. Home renders an empty marquee — not Johnnie Walker / Hennessy / … |
| 5xx / network | The error **propagates**. Home's nearest `error.tsx` is the outage state. |

Do not catch-all to a hardcoded `FALLBACK_BRANDS` list. Empty and error stay
distinct: `[]` vs throw.

---

## Home JSON-LD (PR-080k)

`HomeView` mounts `HomeStructuredData` (`components/structured-data.tsx`):
`organizationLd()` + `websiteLd()` from live `siteConfig`. Search engines get
Organization + WebSite (`SearchAction`). Do **not** reintroduce a mock product
`ItemList`.

---

## Search and product list (PR-080f)

`/search` and `/products` must not present a catalogue outage as an empty
result set.

| Surface | Success + 0 rows | `listProducts` 5xx / network |
|---------|------------------|------------------------------|
| `/search` | «نتیجه‌ای پیدا نشد» | `CatalogueLoadError` + retry. Never settle search to `[]`. |
| `/products` | «محصولی برای نمایش نیست» (no outage copy) | Same retry card. Do not say «۰ محصول». |

Soft chrome on search (categories, idle suggestions) may still fail closed to
empty. The **queried** product list is the primary read.

See [search.md](./search.md) and [storefront-commerce.md](./storefront-commerce.md).

---

## Related

- [Architecture](../platform/architecture.md) — route groups and layout error bubbling
- [Data fetching](../platform/data-fetching.md) — empty success vs thrown list/tree
- [Storefront commerce](./storefront-commerce.md) — browse → cart → checkout
- [Search](./search.md) — `/search` query, empty vs outage

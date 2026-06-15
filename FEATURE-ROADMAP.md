# Rumera — Feature Roadmap

> **Working agreement**
> - Build each feature **end-to-end**: DB migration → repo → service → handler → routes → frontend lib/proxy → **polished UI/UX** (RTL, design tokens, a11y) → verify.
> - UI/UX is first-class — design with the `ui-ux-pro-max` guidance (premium dark+gold, editorial, 150–300ms transitions, 44px touch targets, focus states, `prefers-reduced-motion`, responsive 375/768/1024/1440).
> - When a feature is **fully done**, delete its checklist box **and** its spec section from this file.
> - Keep the existing design tokens: gold/wine, `font-serif`, `container-px`, `.cellar-glow`, `.text-foil`, `SmartImage`, `Reveal`.
> - Conventions: `/api/v1` prefix · `{data}` / `{error:{code,message}}` envelope · route groups public/customer(Auth)/admin · goose migrations in `apps/backend/migrations/main` · browser→API only through `/api/store` (auth) or `/api/public` (unauth) proxies.

## Build order / checklist

🎉 **All planned features shipped.** Add new ones below as they come up.

## Known follow-ups (intentionally deferred)

- **Loyalty:** earn-on-review and birthday-bonus triggers, and an admin UI to tune
  earn rates / tiers (rates are env-configurable today: `LOYALTY_*`).
- **Gift cards:** online "buy a gift card" purchase flow (today they're issued by
  staff via `POST /api/v1/admin/gift-cards` and redeemed by customers to wallet).
- **Subscriptions:** auto-fulfilment + auto-charge on renewal — needs a tokenized
  recurring payment method + box-contents selection. Today the renewal cron emails
  the customer when a box is due and rolls the date; management (pause/skip/cancel)
  is fully wired.
- **Recommendations:** feed the taste-profile into the behavioural rec engine's
  weighting (today the profile powers a category/budget "برای شما" rail).

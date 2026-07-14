# Rumera Frontend Refactor Audit

**Workstream ID:** `gpt56-domain-refactor-20260713`
**Date:** 2026-07-13
**Scope:** Next.js frontend architecture, Go API contracts, frontend type parity,
and UI/UX risk.

## Executive Finding

The repository is in the middle of an incomplete refactor. This is not a green
baseline: `npm exec tsc -- --noEmit` currently reports extensive unresolved
imports and downstream implicit-`any` errors. The migration that introduced
feature-domain files deleted `apps/frontend/lib/catalog/*` while many consumers
still import it. The admin client exists only as `lib/api/admin-client.txt`, and
multiple callers import a nonexistent `serverApi` export.

The safe sequence is therefore:

1. Repair mechanical stale imports.
2. Establish exact backend-derived domain contracts.
3. Migrate consumers off deleted central modules into domain APIs/types.
4. Restore a green typecheck/lint/build baseline.
5. Move components and thin routes.
6. Make explicit, tested UI/UX behavior improvements.

## Evidence

### Baseline Breakage

- `apps/frontend/lib/catalog/` is absent, with many remaining imports.
- Commit `9139498` deleted `categories.ts`, `labels.ts`, `products.ts`,
  `recommendations.ts`, `reviews.ts`, and `types.ts` from that directory.
- `apps/frontend/lib/api/admin-client.txt` is imported as a TypeScript module by
  admin features but cannot resolve.
- `apps/frontend/lib/api/client.ts` exports `apiFetch`, not `serverApi`.
- Stale route imports exist in checkout, account order detail, rewards, and admin
  categories.
- `features/image-uploader/use-image-uploader.ts` references undefined
  `ProductImage` and calls an incompatible upload signature.

### Architecture Violations

- Business APIs and types are duplicated under `features/admin/**` and
  `features/account/**` rather than owned by domains.
- `lib/api/hooks.ts` and `account-hooks.ts` combine cart, addresses, shipping,
  coupons, orders, wishlist, loyalty, referrals, subscriptions, wallet, taste,
  recommendations, and other domains.
- `features/catalog/products/api.ts` imports types from admin, reversing the
  required dependency direction.
- A product feature imports a Server Action from `app/**`.
- Top-level `/components` contains product, category, cart, auth, navigation,
  age-policy, and multi-domain admin components.
- Storefront and admin pages contain fetching, transformations, domain helpers,
  error handling, and full feature rendering.

### Type And Contract Drift

- Orders have four contradictory type sets. The canonical status enum has 13
  values, but field casing, pagination, and included fields disagree.
- Product response pointers use `omitempty`; several frontend fields incorrectly
  combine optional and nullable semantics.
- Tags do not have a backend `slug`, use snake_case timestamps, and admin calls
  currently target incorrect paths/expect bodies from `204` operations.
- Category response types invent timestamps.
- Brand types are duplicated nearly field-for-field as `Brand` and
  `BrandResponse`.
- Analytics frontend shapes diverge from backend timeseries, top-product, search,
  and event-breakdown responses; decimal values are JSON strings.
- Customer types invent `email_verified` and weaken required backend fields.
- Wallet unions append `| string`, defeating exhaustiveness.
- Payment admin types currently model revenue analytics rather than payment
  transactions.

### Confirmed Backend Contract Defects / Blockers

These should be tracked rather than hidden in frontend types:

- Coupon validation embeds a database `Coupon` with PascalCase JSON keys and may
  return null.
- Analytics product IDs are UUIDs while catalog product IDs are integers.
- Shipping `estimated_cost` is declared but currently always mapped as zero.
- Order-list `item_count` is currently mapped as zero.
- Product option type/value CRUD has no API surface.
- User list mapping omits phone and currently sets total orders to zero.

### UI/UX Risks

- No consistent route-level error/not-found/loading recovery.
- Admin order failures can display realistic sample data.
- Checkout mutates selected-address state during render and relies on toast-only
  errors.
- Account failures can look like valid zero metrics.
- Clickable table rows, checkout choices, image ordering, and carousel focus have
  keyboard/semantic gaps.
- Form errors are often not connected through `aria-describedby`.
- No global skip link or consistent main-content target.
- Shared button sizes permit sub-44px touch targets.
- Narrow OTP, variant rows, settings tabs, mobile drawer, and fixed cart summary
  need responsive verification and correction.

## Type Modeling Decision

Frontend API contracts will model the actual wire payload, not persistence
models and not idealized UI objects. Exact snake_case stays at the API boundary.
Where UI components benefit from camelCase, a named mapper and view-model type
will make the conversion explicit. This prevents the current failure mode where
camelCase TypeScript compiles but receives snake_case runtime data.

## Verification Baseline

Available frontend scripts are `dev`, `build`, `start`, and `lint`. TypeScript,
Vitest, Playwright, and Testing Library are installed but typecheck/test scripts
are absent. The stabilization plan adds deterministic scripts only after existing
compile failures are resolved enough to make them meaningful.

## Audit Boundary

This audit did not modify application behavior. Static inspection cannot certify
computed color contrast, actual viewport overflow, focus order, screen-reader
announcements, touch behavior, or reduced-motion behavior; those require browser
verification in the explicit UX phase.

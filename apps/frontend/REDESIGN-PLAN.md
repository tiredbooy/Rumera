# Rumera Storefront Redesign — Two-Agent Execution Plan

> **Goal:** Redesign every customer-facing page (storefront, auth, account, shared shell) of `apps/frontend` to a cohesive, premium editorial-luxury standard using the `ui-ux-pro-max` design intelligence. **The admin dashboard (`/admin/*`) is OUT OF SCOPE.**
>
> **Method:** Two agents (**Agent A** and **Agent B**) work in parallel on **disjoint file sets**. This document is the single source of truth. Both agents read §1–§4 in full before touching code, then execute only their own task list (§6 or §7).

---

## 1. Project Context (read first)

| Aspect | Detail |
|---|---|
| Product | **Rumera (رومرا)** — premium spirits & wine e-commerce |
| Language / direction | **Persian (Farsi), RTL.** Use logical properties everywhere: `ps/pe`, `ms/me`, `start-*/end-*`, `text-start/text-end`. Never `pl/pr/left/right`. |
| Framework | **Next.js 16.2.6 — NON-STANDARD.** `apps/frontend/AGENTS.md`: "This is NOT the Next.js you know." **Before writing any routing/data/metadata code, read the relevant guide in `node_modules/next/dist/docs/`.** Heed deprecation notices. |
| React | 19.2.4 (Server Components by default; `"use client"` only when needed) |
| Styling | **Tailwind v4** (`@theme inline` in `app/globals.css`), `tw-animate-css`, `shadcn/tailwind.css` |
| Components | **shadcn/ui** already installed in `components/ui/*` (60+ primitives). Reuse them — do not hand-roll buttons/dialogs/inputs. |
| Animation | **`motion`** v12 (`import { motion } from "motion/react"`). A `components/motion/reveal.tsx` helper already exists — prefer it. |
| Carousels | **`embla-carousel-react`** (already used in `components/home/hero-carousel.tsx`) |
| Icons | **`lucide-react` ONLY.** Never emojis as icons. Fixed sizing (`size-4`, `size-5`). |
| Theme | `next-themes` with light + dark. **Both modes must be designed and verified.** Dark ("candle-lit cellar") is the signature look. |
| Forms | `react-hook-form` + `zod` + `@hookform/resolvers` |
| Data | `@tanstack/react-query` (`lib/api/*`), with graceful sample-data fallbacks |
| Toasts | `sonner` |

---

## 2. Shared Design Language — THE CONTRACT (frozen; both agents obey)

This is the visual vocabulary. Do **not** invent new tokens, fonts, or one-off colors. If a genuinely new token is needed, see §5 escalation rule.

### 2.1 Design direction
**"Refined Cellar" — Editorial Luxury.** Generous whitespace, large serif display headings, calm warm-neutral surfaces, gold-foil accents used sparingly, deep-wine for emphasis. **Restrained glassmorphism only** (the existing `bg-background/80 backdrop-blur-xl` header, `bg-card/80 backdrop-blur-sm` auth card) — no heavy chromatic/liquid-glass effects (perf + contrast risk). Motion is subtle and purposeful.

### 2.2 Color tokens (already in `globals.css` — use the Tailwind classes)
| Token | Class | Use |
|---|---|---|
| `--primary` (aged gold) | `bg-primary` `text-primary` `ring-primary` | Primary CTA, active/selected, links, accents |
| `--gold` / `--gold-foreground` | `bg-gold` `text-gold` | Brand gold (same family as primary) |
| `--wine` / `--wine-foreground` | `bg-wine` `text-wine` | Deep accent: sale badges, emphasis, secondary CTA |
| `--background` / `--foreground` | `bg-background` `text-foreground` | Base parchment/ink |
| `--card` / `--card-foreground` | `bg-card` | Cards, panels |
| `--muted` / `--muted-foreground` | `bg-muted` `text-muted-foreground` | Subdued surfaces & secondary text |
| `--secondary` / `--accent` | `bg-secondary` `bg-accent` | Chips, hover states |
| `--border` | `border-border` | Hairlines |
| `--destructive` | `text-destructive` | Errors |

### 2.3 Typography
- **Headings:** `font-serif` (Playfair Display, via `--font-heading`). Display sizes for hero/section titles.
- **Body:** default sans (Inter). Body min 16px on mobile, line-height 1.5–1.75, line-length 65–75ch for prose.
- **Eyebrow:** the `.eyebrow` utility (gold, semibold) above section titles.

### 2.4 Brand utility classes (defined in `app/globals.css` — REUSE, don't redefine)
| Class | Purpose |
|---|---|
| `.eyebrow` | Gold semibold label above section titles |
| `.cellar-glow` | Warm radial gold+wine spotlight for hero/feature sections |
| `.text-foil` | Gold-foil gradient text (wordmark, display numbers) |
| `.border-hairline` | `border border-border/70` |
| `.fade-x` | Edge-fade mask for horizontal scroll rows / marquees |
| `.animate-marquee` | Infinite marquee (reduced-motion safe) |
| `container-px` | Responsive page gutters `px-5 sm:px-8 lg:px-12` |

### 2.5 Layout & rhythm
- Page container: `mx-auto max-w-7xl container-px` (prose/article pages may use `max-w-3xl`/`max-w-4xl`).
- Section vertical rhythm: `py-16 sm:py-20 lg:py-24` for marketing sections; tighter (`py-8/py-10`) for utility pages.
- Radius scale already defined (`rounded-xl`/`2xl`/`3xl`). Cards lean `rounded-2xl`/`rounded-3xl`.
- Z-index scale: header `z-50`, dropdowns/sheets `z-50`, overlays per shadcn defaults. Don't exceed without reason.

### 2.6 Motion
- Micro-interactions **150–300ms**; section reveals **400–600ms** ease curves.
- Animate `transform`/`opacity` only (never width/height/top/left).
- **Always** honor `prefers-reduced-motion` (the CSS block already disables marquee + smooth scroll; gate `motion` animations too).
- Hover = color/opacity/shadow transitions. **No scale transforms that shift layout.**

### 2.7 Accessibility & interaction (non-negotiable, every page)
- Contrast ≥ 4.5:1 (both modes). Don't use `muted-foreground` for primary body copy on busy backgrounds.
- Visible focus rings on every interactive element (`focus-visible:ring-2 ring-primary/40`).
- Touch targets ≥ 44×44px.
- `cursor-pointer` on every clickable element.
- Icon-only buttons get `aria-label`. Images get meaningful `alt`. Inputs get `<Label htmlFor>`.
- Disable submit buttons during async; show spinner; keep error messages adjacent to the field.
- Reserve space for async content (skeletons) to avoid layout shift.

---

## 3. Hard Rules (apply to BOTH agents)

1. **Read Next.js 16 docs first.** Before editing any `page.tsx`/`layout.tsx`/metadata/data-fetching, consult `node_modules/next/dist/docs/`. Do not assume App Router behavior from memory.
2. **Stay in your lane.** Edit only files in your ownership list (§5). Never edit a file the other agent owns. If you think you need to, stop and follow the §5 escalation rule.
3. **Reuse, don't reinvent.** Use existing `components/ui/*` primitives and existing feature components. Refactor their styling; don't fork them.
4. **Preserve behavior & data contracts.** This is a **visual/UX redesign**, not a logic rewrite. Keep props, API hooks (`lib/api/*`), route params, server/client boundaries, and Persian copy intact unless the task says otherwise. Don't break SSR, `force-dynamic`, `noindex`, or auth guards.
5. **RTL always.** Logical properties only. Test that arrows/chevrons point the correct way in RTL.
6. **Both themes.** Verify light AND dark for every screen.
7. **No new heavyweight deps.** Everything needed is already installed.
8. **Keep it typed & linted.** `npm run lint` clean; no new TS errors. Match surrounding code style and comment density.
9. **No scope creep into `/admin/*`.** Don't restyle admin. NOTE: `components/dashboard/dashboard-shell.tsx` is shared by both `account` and `admin` variants — **only Agent A** touches it, and only the `variant="account"` path, never breaking `variant="admin"`.

---

## 4. Workflow & Coordination

### 4.1 Branching
- Both agents branch from `dev`. Suggested: `redesign/agent-a-shell-storefront` and `redesign/agent-b-funnel-content-account`.
- Because file sets are disjoint, branches merge cleanly. `globals.css` is owned **solely by Agent A** to prevent the one realistic conflict.
- Commit per page/task with conventional messages (e.g. `feat(ui): redesign product detail page`).

### 4.2 Sync points
- **Sync 0 (blocking):** Agent A completes **Task A0 (design-system foundation in `globals.css`)** and pushes it first. Agent B pulls A0 before starting any page that relies on new utilities. (Most utilities already exist, so B can begin immediately on layout/structure and only rebase for net-new tokens.)
- **Sync 1 (mid):** After A finishes the shared shell (header/footer) and B finishes auth, both quickly review each other's diffs for visual consistency.
- **Sync 2 (final):** Joint pass — full click-through of all pages in both themes at 375/768/1024/1440px before merging to `dev`.

### 4.3 Definition of Done (per page — check ALL)
- [ ] Matches §2 design language; consistent with sibling pages.
- [ ] Light + dark both correct; contrast ≥ 4.5:1.
- [ ] Responsive at 375 / 768 / 1024 / 1440 px; no horizontal scroll on mobile.
- [ ] RTL correct (logical props, arrow directions).
- [ ] Loading (skeleton) + empty + error states designed.
- [ ] Keyboard navigable; focus visible; `aria`/`alt`/labels present.
- [ ] `prefers-reduced-motion` respected.
- [ ] No emoji icons; lucide only; `cursor-pointer` on clickables.
- [ ] Data/props/auth/SSR behavior unchanged; `npm run lint` clean.

---

## 5. File Ownership Map (disjoint — prevents collisions)

### Agent A owns
```
app/globals.css                                  ← SOLE OWNER (Task A0)
app/(storefront)/page.tsx                         ← Home
app/(storefront)/products/page.tsx                ← Products listing
app/(storefront)/products/[slug]/page.tsx         ← Product detail (PDP)
app/(storefront)/categories/[category]/page.tsx   ← Category
app/(storefront)/search/page.tsx                  ← Search
app/(account)/account/layout.tsx                  ← Account shell wiring
app/(account)/account/page.tsx                    ← Account overview
components/site-header.tsx
components/site-footer.tsx
components/age-gate.tsx
components/mode-toggle.tsx
components/home/*                                  (hero-carousel, for-you-rail)
components/catalog/*                               (product-card, purchase-panel, add-to-cart, alert-button)
components/product-card.tsx  components/add-to-cart-button.tsx
components/smart-image.tsx  components/brand-marquee.tsx  components/bottle.tsx
components/dashboard/dashboard-shell.tsx (account variant only) + dashboard-nav.tsx
components/dashboard/page-header.tsx  components/dashboard/stat-card.tsx  components/dashboard/placeholder.tsx
components/account/account-overview.tsx  components/account/account-section.tsx
```

### Agent B owns
```
app/(storefront)/cart/page.tsx
app/(storefront)/checkout/page.tsx  app/(storefront)/checkout/layout.tsx
app/(storefront)/checkout/confirmation/[id]/page.tsx
app/(storefront)/recipes/page.tsx  app/(storefront)/recipes/[slug]/page.tsx
app/(storefront)/journal/page.tsx  app/(storefront)/journal/[slug]/page.tsx
app/(storefront)/about/page.tsx  app/(storefront)/faq/page.tsx
app/(auth)/layout.tsx  app/(auth)/login/page.tsx  app/(auth)/register/page.tsx
app/(auth)/forgot-password/page.tsx  app/(auth)/reset-password/page.tsx
app/forbidden/page.tsx
app/(account)/account/addresses/page.tsx  app/(account)/account/orders/page.tsx
app/(account)/account/orders/[id]/page.tsx  app/(account)/account/reviews/page.tsx
app/(account)/account/rewards/page.tsx  app/(account)/account/settings/page.tsx
app/(account)/account/subscriptions/page.tsx  app/(account)/account/taste/page.tsx
app/(account)/account/wallet/page.tsx  app/(account)/account/wishlist/page.tsx
components/cart/*  components/checkout/*
components/recipes/*  components/journal/*
components/auth/*
components/account/addresses-view.tsx  components/account/address-form.tsx
components/account/orders-list.tsx  components/account/order-card.tsx
components/account/order-detail.tsx  components/account/order-status-stepper.tsx
components/account/reviews-view.tsx  components/account/settings-view.tsx
components/account/wallet-view.tsx  components/account/wishlist-view.tsx
components/account/empty-state.tsx
components/loyalty/*  components/subscriptions/*  components/taste/*
components/wallet/*  components/referral/referral-card.tsx
```

### Shared / read-only for both (DO NOT restyle as a task; only consume)
`components/ui/*` (shadcn primitives — if a primitive needs a *global* visual change, that's an Agent A task via escalation), `components/motion/reveal.tsx`, `components/json-ld.tsx`, `components/structured-data.tsx`, `lib/**`, `hooks/**`.

### Escalation rule (the only cross-lane procedure)
If Agent B needs a **new** token/utility in `globals.css`, or a **shared `ui/*` primitive** changed: post the exact request (token name, value, why) at Sync point; **Agent A** implements it in `globals.css`/the primitive and pushes; B rebases. Never edit the other's files directly.

---

## 6. AGENT A — Task List ("Foundation, Shell & Storefront Discovery")

> Theme: the brand's first impression + the highest-traffic conversion surfaces + the shared shell that every page inherits. Heaviest visual lift in the app.

### Task A0 — Design-system foundation `globals.css` ⏱ M · BLOCKING (do first, push first)
- **Files:** `app/globals.css`
- **Do:** Audit existing tokens/utilities against §2. Confirm gold/wine/parchment/cellar tokens are complete for both modes. Add any missing **shared** utilities the plan relies on (e.g. a `.card-elevated` shadow recipe, `.prose-rumera` typography defaults for journal/recipe/about long-form, a consistent `.section` rhythm helper if useful). Document each new utility with a comment. Keep additions minimal and generic.
- **Deliverable:** A short note in the PR/commit listing any net-new utilities so Agent B can use them.
- **DoD:** Tokens resolve in light+dark; no regressions to existing pages; lint clean.

### Task A1 — Site Header `components/site-header.tsx` ⏱ M
- Refine the existing sticky glass header + promo strip + products mega-menu + mobile sheet. Tighten spacing, polish the mega-menu (category monogram chips, promo panel), ensure search field, cart, account, theme toggle are balanced. Verify RTL arrow directions, focus rings, 44px targets, mobile drawer. Keep all existing routes/behavior.
- **DoD:** §4.3 + mega-menu opens on hover & keyboard; mobile sheet polished.

### Task A2 — Site Footer `components/site-footer.tsx` ⏱ S
- Elevate to an editorial footer: brand block + wordmark (`.text-foil`), link columns (shop / content / company / legal), newsletter capture (use existing input + button), payment/trust row, age/authenticity note, social icons (lucide). RTL columns. Both themes.

### Task A3 — Home page `app/(storefront)/page.tsx` + `components/home/*` ⏱ L
- The flagship. Sections in order: **Hero** (`hero-carousel`, `.cellar-glow`, serif display headline, dual CTA) → **trust/brand marquee** (`brand-marquee`) → **featured categories** grid → **curated products rail** (`for-you-rail`) → **editorial/story band** → **recipes teaser** → **journal teaser** → **newsletter/CTA**. Use `reveal` for scroll-in. Strong visual hierarchy, generous whitespace.
- **DoD:** §4.3 + hero LCP-friendly (optimized images, no layout shift); carousel keyboard-accessible & reduced-motion safe.

### Task A4 — Products listing `app/(storefront)/products/page.tsx` ⏱ L
- Catalog grid using `catalog/product-card`. Design: filter sidebar/sheet (price, category, brand, sort), result count + sort control, responsive grid (1→2→3→4 cols), pagination or load-more, **skeleton grid** loading state, **empty state**. Mobile filters in a `Sheet`/`Drawer`. Preserve existing query/data wiring (`nuqs`/query params).
- **DoD:** §4.3 + filters work on mobile; skeletons match card layout.

### Task A5 — Product card `components/catalog/product-card.tsx` (+ `product-card.tsx`, `add-to-cart`, `alert-button`, `product-purchase-panel`) ⏱ M
- The reused unit across home/listing/category/search — get it perfect. Image (`smart-image`, aspect-ratio reserved), brand/name (serif), price + sale (`wine` badge), rating, quick add-to-cart, wishlist/alert affordance, hover elevation (no layout shift). Out-of-stock state. Consistent everywhere it renders.

### Task A6 — Product detail (PDP) `app/(storefront)/products/[slug]/page.tsx` ⏱ L
- The money page. Two-column on desktop (gallery / info), stacked on mobile. Gallery with thumbnails. Info column: brand eyebrow, serif title, rating, price block, `product-purchase-panel` (qty, add-to-cart, alert), trust badges (authenticity, free shipping over threshold), tasting notes / details accordion, specs table. Below: reviews section, "you may also like" rail. Breadcrumbs (`ui/breadcrumb`). JSON-LD already via `json-ld`/`structured-data` — keep SEO intact.
- **DoD:** §4.3 + sticky purchase panel on desktop; gallery keyboard-accessible; metadata/JSON-LD preserved.

### Task A7 — Category page `app/(storefront)/categories/[category]/page.tsx` ⏱ M
- Category hero/banner (name, `.cellar-glow`, short intro, breadcrumb) + product grid reusing A4/A5 patterns. Empty + loading states. Keep it visually consistent with Products listing.

### Task A8 — Search page `app/(storefront)/search/page.tsx` ⏱ M
- Prominent search field (matches header search), result count for query, filter/sort reusing A4, results grid (A5 cards), **no-results empty state** with suggestions, recent/popular searches if data exists. Loading skeletons.

### Task A9 — Account shell + overview `app/(account)/account/layout.tsx`, `app/(account)/account/page.tsx`, `dashboard-shell.tsx` (account variant), `dashboard-nav.tsx`, `account-overview.tsx`, `account-section.tsx`, `page-header.tsx`, `stat-card.tsx` ⏱ L
- Redesign the customer account shell (sidebar/nav, page header, responsive collapse to drawer on mobile) and the **overview** page (greeting, key stat cards — orders/wallet/rewards/points, recent orders preview, quick links to addresses/wishlist/settings). **`variant="account"` only — must not alter `variant="admin"` appearance/behavior.** This establishes the layout shell that all Agent-B account sub-pages render inside, so finish early and notify B.
- **DoD:** §4.3 + admin variant visually unchanged; mobile nav drawer works; `force-dynamic`/`requireUser` guard preserved.

**Agent A effort:** 3×L-flagship (Home, PDP) + 2×L (Products, Account shell) + foundation + shell + cards. Front-loaded, high-impact.

---

## 7. AGENT B — Task List ("Funnel, Content, Auth & Account detail")

> Theme: the purchase funnel tail, all editorial/content pages, the auth flows, and the long tail of account sub-pages. More routes, each lighter and more templated; high reuse of A's shell + cards.

### Task B1 — Cart `app/(storefront)/cart/page.tsx` + `components/cart/*` ⏱ M
- Line items (`cart-lines`): thumbnail, name, price, qty stepper, remove, with empty-cart state (illustration + CTA to `/products`). Order summary card (subtotal, shipping note, discount/gift-card field, total, prominent checkout CTA). Recommended add-ons rail optional. Mobile: summary sticky/bottom. Keep cart store (`zustand`) wiring intact.
- **DoD:** §4.3 + empty state designed; qty changes give feedback.

### Task B2 — Checkout `app/(storefront)/checkout/page.tsx` + `checkout/layout.tsx` + `components/checkout/*` ⏱ L
- The conversion-critical multi-step flow (`checkout-flow`, `add-address-form`). Clean focused layout (minimal chrome — note `checkout/layout.tsx`), stepper (address → shipping → payment → review), order summary rail (sticky desktop), trust signals, clear validation/errors, disabled+spinner on submit. RTL forms. Keep all logic/validation.
- **DoD:** §4.3 + each step keyboard-navigable; errors adjacent to fields.

### Task B3 — Order confirmation `app/(storefront)/checkout/confirmation/[id]/page.tsx` ⏱ S
- Celebratory but elegant success state: order number, summary, delivery estimate, next-steps CTAs (track order → account, continue shopping). `.cellar-glow` accent.

### Task B4 — Recipes index `app/(storefront)/recipes/page.tsx` + `components/recipes/*` ⏱ M
- Editorial recipe collection: hero/eyebrow, `recipe-filters`, responsive `recipe-card` grid (image, title serif, time/difficulty meta, pairing tag), `add-all-button` affordance, loading + empty states.

### Task B5 — Recipe detail `app/(storefront)/recipes/[slug]/page.tsx` ⏱ M
- Article layout (`max-w-3xl`/4xl, `.prose-rumera` if A0 adds it): hero image, title, meta row (time/serves/difficulty), ingredients list with "add all to cart" (`add-all-button`), numbered steps, paired-products rail, share. Keep JSON-LD/metadata.

### Task B6 — Journal index `app/(storefront)/journal/page.tsx` + `components/journal/*` ⏱ M
- Magazine-style blog index: featured post hero (`blog-card` large variant), `journal-explorer` filters/categories, post grid, pagination, loading/empty.

### Task B7 — Journal post `app/(storefront)/journal/[slug]/page.tsx` ⏱ M
- Long-form article: cover, title (serif display), author/date meta, readable prose column, pull-quotes, inline images, related posts, share. Render markdown via existing `react-markdown` setup. Metadata/JSON-LD intact.

### Task B8 — About `app/(storefront)/about/page.tsx` ⏱ M
- Brand story page: hero with `.cellar-glow`, mission/values, story timeline, team or craftsmanship section, stats band (`.text-foil` numbers), CTA. Editorial luxury, generous whitespace.

### Task B9 — FAQ `app/(storefront)/faq/page.tsx` ⏱ S
- Searchable/grouped accordion (`ui/accordion`) by category (orders, shipping, returns, authenticity, account), intro header, contact-support CTA. Smooth expand; keyboard accessible.

### Task B10 — Auth shell + 4 flows `app/(auth)/layout.tsx`, `login`, `register`, `forgot-password`, `reset-password` + `components/auth/*` ⏱ L
- Polish the calm centered `.cellar-glow` auth card. **Login** (`login-tabs`: password + phone/OTP via `phone-login-form`, `input-otp`), **Register**, **Forgot**, **Reset**. Consistent headings, helper text, field validation, error/success states, social/alt options if present, links between flows. Keep `noindex` + all auth logic intact.
- **DoD:** §4.3 + OTP inputs accessible; tab switch keyboard-navigable; errors clear.

### Task B11 — Account: Orders + Order detail `account/orders/page.tsx`, `account/orders/[id]/page.tsx` + `orders-list.tsx`, `order-card.tsx`, `order-detail.tsx`, `order-status-stepper.tsx` ⏱ M
- Renders inside Agent A's account shell. Orders list (status badges, date, total, thumbnails, filter by status, empty state). Detail: `order-status-stepper`, line items, addresses, payment summary, actions (reorder, invoice, track).

### Task B12 — Account: Addresses + Wishlist + Reviews `account/addresses`, `account/wishlist`, `account/reviews` + `addresses-view`, `address-form`, `wishlist-view`, `reviews-view`, `empty-state` ⏱ M
- Addresses: card grid + add/edit dialog (`address-form`), default badge. Wishlist: product-card grid (reuse A's card visually) + move-to-cart + empty state. Reviews: written + pending-review tabs, rating stars, edit. All with empty states.

### Task B13 — Account: Wallet + Rewards + Subscriptions + Settings + Taste `account/wallet`, `account/rewards`, `account/subscriptions`, `account/settings`, `account/taste` + `wallet-view`, `loyalty/rewards-view`, `subscriptions/subscriptions-view`, `settings-view`, `taste/taste-quiz`, `wallet/gift-card-redeem`, `referral/referral-card` ⏱ L
- **Wallet:** balance card (`.text-foil` amount), transactions, gift-card redeem. **Rewards/loyalty:** points balance, tier progress, redeemable perks, referral card. **Subscriptions:** active subs cards, manage/pause/cancel. **Settings:** profile form, password, notifications, prefs (RHF+zod). **Taste:** the `taste-quiz` flow styled as a guided, delightful multi-step. All consistent inside the account shell.

### Task B14 — Forbidden `app/forbidden/page.tsx` ⏱ S
- Branded 403 state: serif headline, explanation, CTA back to storefront / login. `.cellar-glow`. Consistent with auth aesthetic.

**Agent B effort:** 3×L (Checkout, Auth, Account-wallet-cluster) + many M/S templated pages with heavy reuse of A's shell & cards. Balances A's fewer-but-flagship pages.

---

## 8. Effort Balance Summary

| | Agent A | Agent B |
|---|---|---|
| Routes | 6 storefront + account shell/overview | 6 storefront + 4 auth + 10 account + forbidden |
| L tasks | A3 Home, A4 Products, A6 PDP, A9 Account shell | B2 Checkout, B10 Auth, B13 Account cluster |
| Nature | Fewer pages, highest visual/conversion weight, owns the shared shell+tokens+cards everyone depends on | More pages but lighter & templated, heavy reuse of A's shell/cards |
| Critical path | A0 → A1/A2 → A9 unblock B | Can start B4–B9 (content) immediately against the frozen contract |

**Recommended kickoff order:** A starts A0 (push) → A1/A2/A9 early so B's account pages have their shell. B starts immediately on content pages (B4–B9) and auth (B10) which don't depend on A's shell, then does account pages (B11–B13) after A9 lands.

---

## 9. Final Verification (joint, before merging to `dev`)
1. `npm run lint` clean on both branches.
2. `npm run build` succeeds.
3. Click through **every** page in **light + dark** at **375 / 768 / 1024 / 1440 px**.
4. RTL check: arrows, alignment, drawers open from correct side.
5. Keyboard-only pass on header, forms, mega-menu, checkout, account nav.
6. Confirm `/admin/*` is visually unchanged (no accidental shell regressions).
7. Run the §4.3 DoD checklist for each page.
8. Merge A first (shell/tokens), then B, then resolve the (expected-zero) conflicts; final visual review on `dev`.

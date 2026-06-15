# Rumera — Dashboard Build Plan (Two-Agent Parallel)

> **Read this whole file before writing any code.** It is the single source of truth for
> building out the **Admin panel** (`/admin`) and the **customer Account dashboard**
> (`/account`). Two agents work in parallel. The plan is deliberately split so the two
> agents **never edit the same file** — respect the ownership matrix in §4.

---

## 0. TL;DR — Who does what

| Agent | Scope | Owns (writes here) |
|-------|-------|--------------------|
| **Agent A — ADMIN** | Staff back-office at `/admin/**` | `app/admin/**`, `components/admin/**`, `lib/api/admin-hooks.ts` |
| **Agent B — ACCOUNT** | Customer self-service at `/account/**` | `app/(account)/**`, `components/account/**`, `lib/api/account-hooks.ts` |

Everything in §2 (Hard Rules), §3 (Stack), §4 (Ownership) and §5 (Design System) applies
to **both** agents. Then Agent A reads §6, Agent B reads §7.

---

## 1. Project context

- **Product:** رومرا (Rumera) — a luxury Persian wine / fine-spirits e-commerce storefront.
- **Language & direction:** **Persian (Farsi), fully RTL.** All copy is Persian. All numbers
  rendered with `faNum()`, all prices with `formatPrice()` (both from `@/lib/products`).
- **Aesthetic:** quiet luxury — serif display headings, "foil"/gold accents, hairline borders,
  generous whitespace, dark-mode first-class. **Not** a generic SaaS admin look.
- **Current state:** Both dashboards are **scaffolded but mostly placeholder**. The shared
  chrome (sidebar, nav, header, stat cards) is **already built and must be reused, not rebuilt.**
  Most pages currently render `<Placeholder>` or read from local mock data (`lib/products.ts`).
  Your job is to turn these into real, complete, polished feature pages.

---

## 2. HARD RULES (non-negotiable — both agents)

1. **Next.js 16.2.6 is NOT the Next.js you know.** Per `apps/frontend/AGENTS.md`: APIs,
   conventions, and file structure may differ from your training data. **Before writing any
   route, layout, `params`/`searchParams` handling, metadata, or server-action code, read the
   relevant guide in `node_modules/next/dist/docs/`.** Heed deprecation notices. Do not assume
   App-Router behavior from memory.
2. **Reuse the existing chrome.** Never re-implement the sidebar/shell. Pages render **only their
   content** — the layout already wraps them. Use:
   - `components/dashboard/dashboard-shell.tsx` (the chrome — already wired in both layouts)
   - `components/dashboard/page-header.tsx` → `<PageHeader title description actions />`
   - `components/dashboard/stat-card.tsx` → `<StatCard label value hint icon trend />`
   - `components/dashboard/placeholder.tsx` → `<Placeholder>` for any not-yet-wired section
3. **Use the existing shadcn/ui kit in `components/ui/`** (50+ primitives already present —
   `table`, `chart`, `dialog`, `drawer`, `sheet`, `tabs`, `badge`, `select`, `combobox`,
   `pagination`, `skeleton`, `sonner`, `command`, `calendar`, `popover`, etc.). **Do not add new
   shadcn primitives unless genuinely missing** — check `components/ui/` first.
4. **RTL correctness.** Use logical properties (`ps-/pe-/ms-/me-/text-start/text-end`,
   `border-s/border-e`), never hard `left/right`. Icons that imply direction (arrows) point the
   RTL-correct way (the codebase uses `ArrowLeft` for "view all →" intentionally — match local
   convention).
5. **No fake data dressed as real.** If a backend endpoint isn't available yet, render a real,
   styled UI bound to a clearly-marked mock module OR show `<Placeholder>`. Never hardcode fake
   numbers inline in a way that pretends to be live. Mark every mock with a `// TODO(api): wire to <endpoint>` comment.
6. **Access control is already handled in the server layouts** via `requirePermission()` /
   `getSession()`. Admin pages must still call `requirePermission(PERMISSIONS.X)` at the top of
   each server page (see existing `app/admin/products/page.tsx` for the exact pattern) and gate
   write actions with `can(session, PERMISSIONS.X_WRITE)`.
7. **Accessibility & polish checklist** (verify before declaring a page done):
   - SVG icons only (lucide-react) — **no emoji as icons**.
   - `cursor-pointer` on every clickable element; visible focus rings.
   - Hover transitions 150–300ms; respect `prefers-reduced-motion`.
   - Text contrast ≥ 4.5:1 in **both** light and dark mode.
   - Loading = `Skeleton`; empty = `Placeholder`/`Empty`; error = inline message + retry.
   - Responsive at 375 / 768 / 1024 / 1440; no horizontal scroll on mobile.
   - Every icon-only button has `aria-label`; every form input has a `<Label>`.
8. **Commit hygiene:** small, scoped commits. Agent A prefixes `feat(admin): …`, Agent B
   prefixes `feat(account): …`. Never touch the other agent's files.

---

## 3. Tech stack reference (already installed — use these, add nothing new)

| Concern | Use |
|---|---|
| Framework | Next.js **16.2.6**, React **19.2** |
| Styling | Tailwind **v4** + custom tokens (§5), `cn()` from `@/lib/utils`, `class-variance-authority` |
| Components | shadcn/ui (`components/ui/*`), `radix-ui`, `@base-ui/react`, `vaul` (drawer) |
| Data fetching | `@tanstack/react-query` v5 (provider in `app/providers.tsx`); keys via `lib/api/query-keys.ts` |
| HTTP | `lib/api/client.ts` (server) + `lib/api/store-client.ts`; endpoints in `lib/api/endpoints.ts` |
| Forms | `react-hook-form` + `zod` v4 + `@hookform/resolvers` |
| Tables | `components/ui/table.tsx` + `@tanstack/react-virtual` for long lists |
| Charts | `recharts` v3 via `components/ui/chart.tsx` (shadcn ChartContainer wrapper) |
| URL state | `nuqs` (filters/pagination/tabs that should be shareable & back-button-safe) |
| Toasts | `sonner` (`import { toast } from "sonner"`) |
| Rich text | `@tiptap/react` (recipe/journal editors) + `react-markdown` for render |
| Dates | `date-fns` + `react-day-picker` / `components/ui/calendar.tsx` |
| Uploads | `uploadthing` (product/recipe images) |
| Icons | `lucide-react` only |
| Auth | `next-auth` v5 (`lib/auth/*`); RBAC in `lib/rbac/*` |

---

## 4. File ownership matrix (prevents merge conflicts)

### Frozen / read-only for BOTH agents (do not edit)
- `components/dashboard/**` — shared shell, nav, header, stat-card, placeholder. **Read & reuse only.**
  If you think you need to change one, you almost certainly don't — compose around it.
- `lib/rbac/**` — permissions, nav config, `can()`. The nav is already complete for every page
  below. **Do not edit `nav.ts`** unless adding a brand-new route not listed here (you aren't).
- `lib/auth/**`, `app/providers.tsx`, `app/globals.css`, `lib/utils.ts`.
- `lib/api/client.ts`, `lib/api/store-client.ts`, `lib/api/endpoints.ts`, `lib/api/query-keys.ts`
  are **append-mostly & shared** → **do not edit them directly.** Instead each agent creates its
  OWN hooks file (below) and re-exports any new query keys / endpoint paths it needs locally.

### Agent A — ADMIN owns
```
app/admin/**                  ← all admin pages
components/admin/**           ← admin-only components (data-table, filters, charts, editors…)
lib/api/admin-hooks.ts        ← NEW FILE: all admin react-query hooks + admin query keys
```

### Agent B — ACCOUNT owns
```
app/(account)/**              ← all account pages
components/account/**         ← account-only components (order card, address form, wallet…)
lib/api/account-hooks.ts      ← NEW FILE: all account react-query hooks + account query keys
```

> **Conflict rule:** if both agents need the same brand-new generic helper, **each builds its
> own copy in its own namespace.** Do not share new files across the boundary during this build.
> A `DataTable` belongs to Agent A (`components/admin/data-table.tsx`); Account uses simpler
> card/list layouts and does not need it.

---

## 5. Design system (apply to every page)

### Custom tokens already defined in `app/globals.css` (use as Tailwind classes)
- `font-serif` — display headings (the serif). Body text uses the default sans.
- `text-foil` — the metallic brand accent used for "رومرا" and hero accents.
- `bg-gold` / `text-gold-foreground` — premium badges/highlights.
- `bg-wine` / `text-wine-foreground` — wine accent.
- `border-hairline` — the signature 1px luxury border. **Use on every card/table container.**
- Standard shadcn tokens: `bg-card`, `bg-background`, `text-muted-foreground`, `ring-foreground/5`,
  `border-border/60`, `bg-primary/10`, `text-primary`, etc.

### Canonical container recipe (match existing pages exactly)
```tsx
<div className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/5">…</div>
```
KPI grid: `grid gap-4 sm:grid-cols-2 lg:grid-cols-4`. Headings inside pages: `font-serif text-2xl`.

### Color guidance for data/charts (admin)
- Primary data series: `#1E40AF` / `#3B82F6` (blue family) — but prefer pulling from CSS vars so
  dark mode works. Positive/up = `text-emerald-500`; negative/down/destructive = `text-destructive`.
- Status colors: pending=amber, paid/active=emerald, shipped=blue, cancelled/refunded=destructive,
  draft=muted. Define ONE `statusBadge` map per agent and reuse it.

### Effects
- Row hover highlight on tables, tooltips on chart points, smooth filter transitions, skeleton
  loaders. Micro-interactions 150–300ms. Nothing ornate or bouncy — restrained luxury.

### Definition of Done (per page)
A page is "done" when: real layout (no lorem), bound to a hook or clearly-marked mock, has
loading + empty + error states, is responsive + RTL-correct, passes the §2.7 a11y checklist, and
write-actions are permission-gated (admin).

---

## 6. AGENT A — ADMIN DASHBOARD (`/admin/**`)

**Read §2–§5 first.** Audience: staff (RBAC roles). Style target: **data-dense but elegant** —
KPI cards, charts, sortable/filterable tables, side-drawer detail/edit. Every page top calls
`requirePermission(PERMISSIONS.…)`; every mutating control gated by `can(session, …)`.

### First task — build the admin shared kit (in `components/admin/`)
Before the pages, build these reusable pieces so every page is consistent:
1. **`data-table.tsx`** — generic table wrapper over `components/ui/table.tsx`: column defs,
   sticky header, row hover, empty/loading slots, optional `@tanstack/react-virtual` for >50 rows.
2. **`table-toolbar.tsx`** — search input + filter `Select`s + result count; state via `nuqs` so
   filters live in the URL.
3. **`status-badge.tsx`** — one `Badge` map for order/product/stock statuses (§5 colors).
4. **`stat-trend-card.tsx`** *(optional)* — only if `StatCard` needs an extension; otherwise reuse it.
5. **`admin-hooks.ts`** in `lib/api/` — react-query hooks for the endpoints in the table below.

### Admin endpoints available (`lib/api/endpoints.ts`)
`admin.users`, `admin.user(id)`, `admin.products`, `admin.orders`, `orders.list/detail`,
`products.list/detail`, `inventory`, `analytics`, `reviews`, `recipes.*`, `categories`, `brands`.
Where an admin-specific endpoint is missing (roles, settings), build the UI against a marked mock.

### Pages & features

#### 6.1 Dashboard home — `app/admin/page.tsx`  *(perm: signed-in staff)*
- **KPI row** (`StatCard` × 4): revenue today/30d, orders count, new customers, avg order value —
  each with a `trend` (% vs previous period).
- **Revenue chart**: area/line over time (recharts via `ui/chart.tsx`), range toggle 7d/30d/90d
  (`nuqs`).
- **Orders by status**: small donut or stacked bar.
- **Top products** mini-table (5 rows) + **Recent orders** mini-table (5 rows) with "view all →".
- **Low-stock alert** strip linking to inventory.

#### 6.2 Products — `app/admin/products/page.tsx` + `[id]` + `new`  *(products:read / write / delete)*
- List: `DataTable` with image (`Bottle`), name+maker, category, price, rating, status badge,
  stock; search + category/status filters; sort by price/rating/created; pagination.
- Bulk-select → bulk publish/unpublish/delete (gated by `products:write`/`delete`).
- Row actions: edit (→ `[id]`), duplicate, delete (confirm via `alert-dialog`).
- `new` + `[id]`: full **product form** (extend existing `components/admin/product-form.tsx`):
  name, slug, maker, category, price, compare-at price, description (tiptap), tasting notes,
  ABV/volume/vintage attributes, images (uploadthing, multi + reorder), stock, status, badges,
  SEO fields. zod validation; optimistic save; toast on success.

#### 6.3 Inventory — `app/admin/inventory/page.tsx`  *(inventory:read / write)*
- Table: product, SKU, on-hand, reserved, available, reorder threshold, status badge
  (in-stock / low / out). Inline stock-adjust (popover stepper → mutation, gated by `inventory:write`).
- Filters: low-stock-only toggle, category. Sort by available asc. CSV export button (stub ok).
- KPI strip: total SKUs, out-of-stock count, low-stock count, inventory value.

#### 6.4 Orders — `app/admin/orders/page.tsx` + `[id]`  *(orders:read / write / refund)*
- List: order #, customer, date, item count, total, payment status, fulfilment status; filters by
  status + date range (`calendar`/day-picker) + search; pagination; sort by date/total.
- `[id]` detail: customer block, shipping address, line items table, totals breakdown, payment +
  fulfilment timeline, **status transition** controls (gated by `orders:write`), **refund** action
  (gated by `orders:refund`, confirm dialog), internal notes, print/invoice button (stub ok).

#### 6.5 Customers — `app/admin/customers/page.tsx` + `[id]`  *(customers:read / write / ban)*
- List: name, email, phone, orders count, lifetime value, joined date, status; search + sort;
  pagination.
- `[id]`: profile summary + KPI cards (LTV, orders, avg order, last seen), order history table,
  addresses, wallet balance, loyalty tier, reviews authored. Actions: edit (`customers:write`),
  **ban/unban** (`customers:ban`, confirm).

#### 6.6 Reviews — `app/admin/reviews/page.tsx`  *(reviews:read / moderate)*
- Moderation queue: product, reviewer, rating stars, excerpt, date, status (pending/approved/
  rejected). Tabs by status (`nuqs`). Row → expand full text. Approve / reject / delete actions
  gated by `reviews:moderate`; bulk approve. Filter by rating + product.

#### 6.7 Recipes — `app/admin/recipes/page.tsx`  *(recipes:read / write)*
- Editorial list: title, cover thumb, status (draft/published), author, updated date; search.
- Create/edit recipe: title, slug, cover image (uploadthing), intro, ingredients (repeatable
  rows), steps (tiptap or repeatable), paired products (combobox multi-select), tags, SEO,
  publish toggle. Gated by `recipes:write`.

#### 6.8 Analytics — `app/admin/analytics/page.tsx`  *(analytics:read)*
- Full charts page (recharts): revenue trend, orders trend, AOV trend, conversion funnel,
  top categories (bar), top products (bar), new-vs-returning customers (donut), sales by region.
- Global date-range picker (`nuqs`) driving all charts. KPI summary row at top. Each chart in a
  `border-hairline` card with title + tooltip. Provide an accessible data-table fallback toggle.

#### 6.9 Roles & permissions — `app/admin/roles/page.tsx`  *(roles:manage)*
- List roles with member counts. Create/edit role: name + **permission matrix** (checkbox grid of
  all `PERMISSION_LABELS` grouped by resource — read these from `lib/rbac/permissions.ts`).
  Assign/unassign users to roles. (Build against a marked mock if no roles endpoint yet.)

#### 6.10 Settings — `app/admin/settings/page.tsx`  *(settings:manage)*
- Tabbed (`ui/tabs`): Store profile (name, contact, currency, address), Shipping (zones/rates),
  Payments (gateways toggle), Notifications, Legal/policy text (tiptap). Forms with zod + save
  toast. Mock-backed where no endpoint exists.

---

## 7. AGENT B — ACCOUNT DASHBOARD (`/account/**`)

**Read §2–§5 first.** Audience: logged-in customers (no permission gates — every authed customer
sees the full menu, per `ACCOUNT_NAV`). Style target: **warm, premium, reassuring** — fewer
tables, more cards/timelines; the customer should feel taken care of. Use `getSession()` at page
top (already gated by the account layout).

### First task — build the account shared kit (in `components/account/`)
1. **`account-section.tsx`** — a titled `border-hairline` card wrapper used across pages for
   consistency (header row + content + optional action).
2. **`order-card.tsx`** & **`order-status-stepper.tsx`** — reused on overview, orders list, order
   detail. Status stepper: ثبت‌شده → پرداخت → آماده‌سازی → ارسال → تحویل.
3. **`empty-state.tsx`** — thin wrapper over `Placeholder` with account-flavored copy + a CTA.
4. **`account-hooks.ts`** in `lib/api/` — react-query hooks for the endpoints below.
   (`components/account/orders-list.tsx` and `order-detail.tsx` already exist — extend them.)

### Account endpoints available (`lib/api/endpoints.ts`)
`auth.me`, `orders.list/detail`, `addresses`, `wishlist`, `wallet`, `reviews`,
`recommendations`, plus loyalty/subscriptions/taste (use marked mocks if endpoints are missing).

### Pages & features

#### 7.1 Overview — `app/(account)/account/page.tsx`
- Personalized greeting (already stubbed). Replace mock stat values with real hooks:
  `StatCard` × 4 → active orders, wallet balance, wishlist count, addresses.
- **Recent orders** (2–3 `order-card`s) with status stepper + "view all →".
- **Recommendations** strip (from `recommendations` endpoint) — "بر اساس سلیقهٔ شما".
- **Loyalty snapshot**: tier + points progress bar (`ui/progress`) → links to rewards.
- **Profile completeness** nudge if address/taste missing.

#### 7.2 Orders — `app/(account)/account/orders/page.tsx` + `[id]`
- List of `order-card`s: order #, date, thumbnail row, total, status stepper; filter tabs
  (همه / در حال پردازش / ارسال‌شده / تحویل‌شده / لغو) via `nuqs`; pagination/infinite scroll.
- `[id]` detail (extend `components/account/order-detail.tsx`): line items with images, totals
  breakdown, shipping address, full status timeline, tracking info, actions: reorder (→ adds to
  cart), download invoice (stub), cancel-if-eligible, "write a review" per delivered item.

#### 7.3 Addresses — `app/(account)/account/addresses/page.tsx`
- Card grid of saved addresses; default badge. Add/edit in a `dialog`/`drawer` with zod form
  (title, recipient, phone, province/city `select`, postal code, line). Set-default, delete
  (confirm). Empty state CTA.

#### 7.4 Wishlist — `app/(account)/account/wishlist/page.tsx`
- Product card grid (reuse storefront `components/catalog` card if present, else build a compact
  one). Each: image, name, price, in-stock badge, remove (heart-fill toggle), add-to-cart,
  move-to-cart-all. Empty state → "کشف محصولات".

#### 7.5 Taste profile — `app/(account)/account/taste/page.tsx`
- Display the customer's taste quiz results (flavor preferences, categories, price band) as
  chips/cards; CTA to retake the quiz (`components/taste` likely exists — reuse). Show how it
  powers recommendations. Mock-backed if no endpoint.

#### 7.6 Rewards / loyalty club — `app/(account)/account/rewards/page.tsx`
- Tier card (current tier, perks), points balance + progress to next tier (`ui/progress`),
  points-history table (earned/redeemed), available rewards to redeem (cards with "redeem"
  action), referral CTA (`components/referral` / `components/loyalty` exist — reuse).

#### 7.7 Subscriptions — `app/(account)/account/subscriptions/page.tsx`
- Active subscription cards: product, cadence (e.g. هر ماه), next delivery date, price, status.
  Actions: pause/resume, skip next, change cadence, change address, cancel (confirm). Empty state
  → explain the subscription program. (`components/subscriptions` exists — reuse.)

#### 7.8 Wallet — `app/(account)/account/wallet/page.tsx`
- Balance hero card (large, `font-serif`, gold accent). Top-up CTA (dialog). Transactions table:
  date, type (charge/spend/refund/gift), amount (+/- colored), description, running balance.
  Filter by type; pagination. (`components/wallet` exists — reuse/extend.) Gift-card redeem field.

#### 7.9 My reviews — `app/(account)/account/reviews/page.tsx`
- Two tabs (`nuqs`): «نوشته‌شده» (my reviews — product thumb, my rating, text, status, edit/delete)
  and «در انتظار نظر» (delivered products awaiting a review → CTA to write one).

#### 7.10 Account settings — `app/(account)/account/settings/page.tsx`
- Tabbed: Profile (name, email, phone, avatar), Security (change password, OTP/2FA toggle —
  `input-otp` available), Notifications (email/SMS toggles via `ui/switch`), Privacy/data
  (export, delete account → confirm). zod forms + save toasts. Bind to `auth.me`; mock the rest.

---

## 8. Suggested execution order (each agent, top-down)

**Agent A:** shared kit (§6 first task) → 6.1 home → 6.2 products → 6.4 orders → 6.5 customers →
6.3 inventory → 6.6 reviews → 6.8 analytics → 6.7 recipes → 6.9 roles → 6.10 settings.

**Agent B:** shared kit (§7 first task) → 7.1 overview → 7.2 orders → 7.3 addresses → 7.4 wishlist
→ 7.8 wallet → 7.6 rewards → 7.7 subscriptions → 7.5 taste → 7.9 reviews → 7.10 settings.

Build the highest-traffic pages first so the dashboard is demoable early. Commit per page.

## 9. Final gate (before "done")
- `npm run lint` clean for your files.
- Spot-check every page at 375px and 1440px, light + dark, RTL.
- No `console.log`, no orphaned mock without a `TODO(api)` comment.
- Did not edit any file outside your ownership lane (§4).

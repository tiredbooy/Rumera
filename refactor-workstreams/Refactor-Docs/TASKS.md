# Rumera Frontend Domain Refactor Tasks

**Workstream ID:** `gpt56-domain-refactor-20260713`
**Owner:** `gpt-5.6-sol`
**Created:** 2026-07-13
**Audit:** `AUDIT.md`

Tasks are claimed and completed strictly from top to bottom. Move exactly one
task into `IN_PROGRESS.md`, re-read all scoped files, implement it, verify it,
then append the result to `FINISHED.md`. Never claim a later task while an
earlier unblocked task remains.

## Coordination Protocol

- This unique workstream directory prevents tracker conflicts with other work.
- Application files remain shared. Run `git status --short` and re-read scoped
  files immediately before every edit.
- Do not edit files claimed by another active workstream.
- Do not guess ambiguous contracts. Record the blocker and stop that task.
- Do not add compatibility re-export shims unless the task explicitly documents
  a concrete temporary need and removal task.
- Lettered IDs such as `Task 064a` are complete, independently claimable tasks.
  A task-group heading is organizational only and is never claimed as a whole.
- A dependency on a task group means every lettered task in that group must be
  complete unless the dependent task names a narrower dependency.

## Backlog status (2026-08-05)

- Tasks **000–063** (Phases A–F and closing audit) are **complete**.
- Full completion records live in `FINISHED.md` only (append-only history).
- This file is the **open backlog** starting at **Task Group 064**.
- Do not re-list completed `[x]` items here.

## Remaining Cross-Task Gates

- Start Task Group 064 storefront work before assuming card/rail changes are
  stable for later discovery tasks.
- Complete **064a** before treating homepage/catalog card height as final
  (064b reuses the same `ProductCard`).
- Complete **065a** before large admin form IA changes that depend on nav
  placement copy.
- Complete shared selection work (**066e**) before or with product/journal/
  recipe form polish when those forms share tag/category pickers.
- Start **067a** / **067b** after content-form resilience patterns exist so
  dashboards can reuse the same error/empty/recovery language where useful.

## Contract And Naming Policy

- Go response/request structs, JSON tags, handlers, mappers, and response
  envelopes together define the frontend wire contract.
- Database-only Go models are not copied into TypeScript.
- API-boundary properties preserve exact JSON keys and optionality.
- Business names are used: `Order`, `ProductDetail`, `Address`, `Review`.
- `Response`/`DTO` suffixes are avoided unless two genuine wire projections need
  distinction that a business name such as `ProductListItem` cannot express.
- `time.Time` is represented as an ISO `string`; `decimal.Decimal` is a `string`;
  IDs preserve the backend's actual number/UUID representation.
- `omitempty` response pointers become optional properties. Non-omitempty
  pointers become required nullable properties.
- CamelCase view models are allowed only through explicit named mappers. A type
  must never claim camelCase while receiving snake_case data directly.

## Verification Gates

- [ ] `npm exec tsc -- --noEmit` passes in `apps/frontend`.
- [ ] `npm run lint` introduces no new errors in scoped files (record pre-existing).
- [ ] `npm run build` passes (or failures are scoped and fixed when caused by the task).
- [ ] Relevant unit/integration/e2e tests pass, or missing coverage is recorded.
- [ ] Touched UI is checked at 320/375, 768, 1024, and 1440px.
- [ ] Touched interactions are keyboard-operable with visible focus.
- [ ] RTL layout, focus order, and reduced-motion remain correct for motion/carousels.
- [ ] No invented backend fields; empty/error/partial states are truthful.

---

## Phase G - Storefront polish, discovery, and operator UX (post-063)

Evidence for this phase includes the storefront product-card screenshot review
(2026-08-05): card overall quality is strong; media height is too tall and can
break visual rhythm; the homepage catalogue strip must be a horizontal rail
(not a tall vertical scroll of oversized cards); discovery paths to full
catalogue and brands must be obvious; admin/account operators need clearer nav
grouping, easier forms (product / journal / recipes / hero), easier
tag/category selection, and stronger fault-tolerance against human error.

### Task Group 064 - Product card media and homepage catalogue rail

- [x] **Task 064a - Constrain product-card image height without breaking card style**
  - Keep the overall luxury `ProductCard` design (hierarchy, availability chip,
    tags, price, CTAs) that already works well.
  - Replace the overly tall media crop (currently a tall portrait ratio such as
    `aspect-[4/5]`) with a **shorter, fixed-height (or fixed aspect) media
    region** so cards stay consistent in grids and rails.
  - Ensure images use `object-cover` (or the canonical storefront media policy)
    inside a stable frame: no layout shift, no stretched logos, no card height
    blow-ups when intrinsic image ratios differ.
  - Align `StorefrontMedia` / `product-card` slot policy heights with the new
    frame; update focused card tests and visual checks at 320–1440px.
  - Scope: `product-card.tsx`, storefront media policy/slot for product cards,
    any consumers that hard-code the old crop assumptions.
  - Depends: none (first claimable task of Phase G).

- [x] **Task 064b - Homepage catalogue: horizontal Swiper rail (fix vertical scroll bug)**
  - In the homepage section that shows product cards (“منتخب فروشگاه” /
    `CatalogSection` and any sibling rails with the same bug), stop presenting
    products as a tall multi-row grid that forces long vertical scrolling of
    oversized cards.
  - Implement a **horizontal** product rail using **Swiper** (add the dependency
    if needed; prefer accessible defaults: keyboard, RTL, touch, reduced motion).
  - Reuse the shared `ProductCard` (after 064a height fix). Cards must not
    collapse or stretch unevenly in the track; fixed card/media height is part
    of the contract.
  - Provide clear prev/next controls (or equivalent), peek of adjacent slides on
    large screens, and graceful empty state when there are no products.
  - Cover with component tests and a responsive smoke check; do not invent
    product fields.
  - Depends: Task 064a.

- [x] **Task 064c - Make “all products” and brand selection easy to reach**
  - Improve storefront discovery so users can flow quickly to **full product
    catalogue** (`/products` or equivalent) and **brand browsing/selection**
    without hunting in the header.
  - Add or strengthen primary CTAs on the homepage catalogue section, navigation
    (desktop + mobile drawer), and any brand entry points that already exist in
    the domain; deep-link brand chips/filters only when backed by real routes or
    catalogue query contracts.
  - Keep RTL, keyboard, and permission-free public access; do not invent brands
    client-side.
  - Verify 320–1440px and that empty brand/product states stay truthful.
  - Depends: Task 064b preferred (shared homepage section), but may land after
    064a if scoped only to nav/links.

### Task Group 065 - Admin sidebar information architecture

- [x] **Task 065a - Organize admin sidebar into clearer groups**
  - Audit `lib/rbac/nav.ts` (`ADMIN_NAV`) and the dashboard shell presentation.
  - Regroup items so operators scan by job (e.g. catalogue, commerce ops,
    content, customers, insights, system) rather than a flat or mixed list.
  - Keep permission filtering (`filterNav` / capabilities) correct; empty groups
    must still drop when the user lacks all items.
  - Preserve Persian labels, active-route highlighting, mobile drawer behavior,
    and keyboard order; update `nav` tests.
  - Depends: none (can run in parallel with storefront 064* only if no file
    conflict; if parallel agents, claim after 064c to reduce churn).

### Task Group 066 - Admin content forms: ease of use and fault tolerance

Goal: product, journal (blog), recipes, and hero editors must be easy, resilient
to human mistakes, and recover gracefully from partial/network failures without
lying about backend support.

- [x] **Task 066a - Product admin form: usability, validation, and fault tolerance**
  - Walk the create/edit product flow (variants, media, tags, categories,
    aggregate save) and remove friction: clear sections, required-field cues,
    sticky/save feedback, dirty-state leave guards, and recoverable errors.
  - Handle human errors: invalid prices, empty variants, conflicting options,
    failed media attach after product create, offline/timeout with retry without
    duplicate creates when the API contract allows.
  - Prefer progressive disclosure over one endless form; keep domain APIs and
    wire contracts authoritative.
  - Extend focused form/integration tests for failure and recovery paths.
  - Depends: Task 065a recommended for nav IA consistency.

- [x] **Task 066b - Journal (blog) admin form: usability and fault tolerance**
  - Same resilience goals as 066a for journal article + category admin: draft
    safety, cover media staging, validation focus, partial-failure recovery, and
    clear success/error toasts.
  - Do not invent CMS fields; match backend journal contracts.
  - Depends: Task 066a for shared patterns where practical (or document reuse).

- [x] **Task 066c - Recipe admin form: usability and fault tolerance**
  - Improve recipe create/edit (cover, ingredients, shoppable links, status) so
    operators cannot easily publish broken or half-saved recipes.
  - Guard human errors on ingredient/product links, quantities, and media; recover
    from owner-create-then-cover-attach failures already known in the domain.
  - Depends: Task 066a patterns; may share media uploader behavior with 066b.

- [x] **Task 066d - Hero-slide admin form: usability and fault tolerance**
  - Make hero slide editing (media, copy, CTA, publication windows/status) hard
    to misuse: preview fidelity, validation, and failed-publish recovery.
  - Prevent silent invalid states (e.g. published with missing media/CTA when
    required by product rules).
  - Depends: Task 066a patterns.

- [x] **Task 066e - Easier tag and category selection (shared admin UX)**
  - Improve multi-select / search / create-or-pick flows for **tags** and
    **categories** used on product (and other content forms that attach them).
  - Support large lists without endless scrolling only: search, keyboard, clear
    selection chips, empty and error states, and no false “saved” when the
    mutation fails.
  - Extract a reusable pattern only if two or more forms need it; otherwise
    improve the primary product selectors first and reuse deliberately.
  - Depends: useful before or alongside 066a–066c; claim with the first form
    that needs it if blocked, otherwise after 066a.

### Task Group 067 - Account and admin dashboards: fault tolerance and human errors

- [x] **Task 067a - Admin dashboard shell and modules: fault tolerance**
  - Across admin overview and module boards (lists, detail panes, mutations):
    standardize loading, empty, error, retry, and permission-denied states.
  - Prevent destructive actions without confirm; block double-submit; show field-
    level and form-level errors that match backend validation.
  - Prefer shared dashboard primitives already in the design system; do not paper
    over 403/404 with fake success.
  - Add or extend tests for error and retry paths on at least one list + one
    mutation surface per high-traffic module if missing.
  - Depends: Task Group 066 recommended so form patterns align.

- [x] **Task 067b - Account dashboard: fault tolerance and human errors**
  - Apply the same resilience bar to the customer account shell and pages
    (orders, addresses, wishlist, wallet, settings, etc.): network failure,
    empty data, validation mistakes, and session/auth edge cases.
  - Keep copy Persian-first and actions reversible where the API supports it.
  - Depends: Task 067a preferred for shared language/components.

---

## Phase H - Operations trust, discovery, and recommendation fidelity

Ordered from foundational data → operator tools → storefront discovery →
observability. Claim top to bottom unless a task lists a narrower dependency.

### Task Group 068 - Shipping accuracy foundations

- [x] **Task 068a - Make product weight trustworthy for shipping quotes**
  - Surface product `weight` (kg) clearly in admin product specifications with
    unit labels, validation hints, and empty-state guidance when weight is
    missing (quotes fall back to zero weight).
  - On inventory or product list admin surfaces, flag active shippable products
    that lack weight so operators can fix them before checkout under-quotes.
  - Do not invent weights; only report missing/zero and link to edit.
  - Cover validation and any new empty/warning UI with focused tests.
  - Depends: none.

- [x] **Task 068b - Admin shipping quote simulator (real API)**
  - On zone detail and/or method editor, add a simulator: region code, package
    weight (kg), order subtotal → call existing public/admin-available
    `GET /shipping/available` (or equivalent BFF) and show ranked methods with
    estimated cost from the **authoritative** backend policy.
  - Truthful empty/error/retry states when the API is offline or region has no
    methods; never invent rates client-side as the only source of truth (client
    preview may remain as a secondary hint).
  - Persian labels, keyboard-friendly form, tests for parse/submit and error path.
  - Depends: Task 068a recommended (weight context), not hard-blocked.

### Task Group 069 - Content form selection UX

- [x] **Task 069a - Journal, recipe, and hero forms: easier selection and resilience**
  - Port searchable id select / chip-search patterns (from product form) to
    journal, recipe, and hero admin editors wherever tags, categories, or large
    option lists appear.
  - Ensure loading/error/retry for remote option lists; dirty/submit locking
    already present must not regress.
  - Focused tests per form surface touched.
  - Depends: Task Group 066 patterns (complete).

### Task Group 070 - Dashboard error coverage and recommendation signals

- [x] **Task 070a - Roll out shared dashboard error/empty/loading states**
  - Apply `DashboardErrorState` / loading / empty primitives across remaining
    high-traffic admin boards (products, inventory, payments, analytics,
    customers, shipping list) and any account pages still using ad-hoc error UI.
  - Consistent retry affordances; no fake success on 403/404.
  - Update board tests that assert retry button labels.
  - Depends: Task 067a complete.

- [x] **Task 070b - Record add_to_cart and purchase interactions for recommendations**
  - Ensure cart add (single + bulk where applicable) and successful order
    completion emit recommendation interactions (`add_to_cart`, `purchase`) with
    correct product ids when the user is authenticated, matching backend
    `InteractionType` weights.
  - Fire-and-forget; never block commerce on interaction failure; no guest spam.
  - Tests or integration coverage that the client calls are wired (mock store
    request).
  - Depends: none (backend already accepts weighted types).

### Task Group 071 - Storefront brand index

- [x] **Task 071a - Brand storefront index and deep links**
  - Add a public brands listing route (e.g. `/brands`) backed by `listBrands`,
    linking each brand to `/products?brand_id=…`.
  - Wire nav (desktop + mobile) and homepage “all brands” CTA to this index.
  - Empty/error states truthful; SEO metadata; focused tests.
  - Depends: Task 064c brand_id routing (complete).

### Task Group 072 - Recommendation observability

- [x] **Task 072a - Admin recommendation observability surface**
  - Expose an admin-only page (or dashboard module) summarizing recommendation
    health using **existing** backend capabilities where available: document
    cron refresh job, link to monitoring if metrics exist, and/or read-only
    endpoints for profile/interaction stats if already exposed.
  - If no stats API exists, implement the minimal admin-safe read that does not
    invent personalization scores: e.g. last job notes from docs + config, or a
    thin backend summary only when justified by evidence.
  - Permission-gated; empty/error states; tests for gate + render.
  - Depends: Task 070b preferred so cart/purchase signals exist before ops UI.

### Task Group 073 - Shipping zone region ergonomics

- [x] **Task 073a - Shipping zone map / postcode guidance**
  - Extend region coverage UX beyond presets: clearer postcode/province help,
    optional free-text “bulk paste” panel, and operator guidance for IR vs
    international codes without requiring a true geographic map if no map
    provider is configured.
  - If a map is out of scope without API keys, ship an excellent code-first
    editor (already chip-based) plus documentation in the form description.
  - Tests for bulk paste / parse helpers.
  - Depends: shipping form chip editor (landed in prior work).

---

## Claim order (recommended)

### Phase G (complete)
1. **064a** → **064b** → **064c** → **065a** → **066\*** → **067\***

### Phase H (complete)
1. **068a** → **068b**
2. **069a**
3. **070a** → **070b**
4. **071a**
5. **072a**
6. **073a**

---

## Phase I - Recommendation signal fidelity and ops metrics

- [x] **Task 074a - Wire productId into every commerce cart path**
  - Pass `productId` into all `AddToCartButton` call sites (product card, PDP,
    recipe shoppable, journal article cards).
  - Record `add_to_cart` from wishlist single and bulk add paths.
  - Keep fire-and-forget; never block commerce.

- [x] **Task 074b - Metrics-backed admin recommendation stats**
  - Backend `GET /admin/recommendations/stats` with interaction totals, unique
    users, profile count, and breakdown by interaction type for a day window.
  - Admin page renders live stats + trending sample (truthful empty/error).

### Phase I claim order
1. **074a** → **074b**

---

## Phase J - More recommendation signals, metrics, shipping weight filter

- [x] **Task 075a - Record search_click from storefront search results**
  - When a signed-in shopper opens a product from search hit results, record
    `search_click` with product_id (fire-and-forget). Do not fire for idle
    suggestions/category chips alone unless the product came from the query hits.
  - Depends: interaction API accepts search_click (already).

- [x] **Task 075b - Record recipe_view on recipe detail for signed-in users**
  - On recipe detail mount, for each linked shoppable product_id, record
    `recipe_view` once per mount (authenticated only, fire-and-forget).
  - Depends: none.

- [x] **Task 075c - Prometheus counters for recommendation interactions**
  - Increment a Prometheus counter labeled by interaction_type on successful
    RecordInteraction; expose via existing `/metrics`.
  - Document series name on admin recommendations page.
  - Depends: none.

- [x] **Task 075d - Admin products filter: missing shipping weight only**
  - Add a ProductsTable facet filter for active products missing/zero weight so
    operators can isolate work without scanning the whole catalogue.
  - Depends: list weight field (068a).

### Phase J claim order
1. **075a** → **075b** → **075c** → **075d**

When a task completes: append a full record to `FINISHED.md`, mark the checkbox
`[x]` here, and clear `IN_PROGRESS.md`.

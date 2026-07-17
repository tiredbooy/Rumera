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

- This unique workstream directory prevents tracker conflicts between agents.
- Application files remain shared. Run `git status --short` and re-read scoped
  files immediately before every edit.
- Do not edit files claimed by another active workstream.
- Do not guess ambiguous contracts. Record the blocker and stop that task.
- Do not add compatibility re-export shims unless the task explicitly documents
  a concrete temporary need and removal task.
- Lettered IDs such as `Task 022a` are complete, independently claimable tasks.
  A task-group heading is organizational only and is never claimed as a whole.
- A dependency on a task group means every lettered task in that group must be
  complete unless the dependent task names a narrower dependency.

## Parallel Agent Assignment

The remaining backlog is split between Agent A and Agent B in
`AGENT_ASSIGNMENTS.md`. During parallel work, agents use their own
`IN_PROGRESS_A.md` / `IN_PROGRESS_B.md` and `FINISHED_A.md` / `FINISHED_B.md`
files. Agent A is the tracker coordinator and is the only agent that edits this
file or `AGENT_ASSIGNMENTS.md`.

- **Agent A:** 049, 052, 053, 056a-c, 056f-i, 059a-c, 060c-e, 060g-i, 061c,
  061e, 061g, 062, 063.
- **Agent B:** 050, 051, 054, 055, 056d-e, 057a-d, 058a-e, 060a-b, 060f,
  061a-b, 061d, 061f.
- **Initial parallel wave:** Agent A owns Task 049; Agent B owns Task 050. No
  later task may start until Agent A records the next disjoint wave.

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

### During Baseline Stabilization

The frontend already fails typecheck because the previous refactor deleted
`lib/catalog/*`, left `admin-client` as `.txt`, and retained stale imports.
Until Task 027 establishes a green baseline, every task must satisfy:

- [ ] Scoped ESLint passes.
- [ ] Relevant import/reference searches show no stale path in task scope.
- [ ] `npm exec tsc -- --noEmit --pretty false` introduces no new errors.
- [ ] Full-build failure is recorded as pre-existing, not hidden.
- [ ] No unrelated behavior or visual output changes.

### After Baseline Stabilization

- [ ] `npm exec tsc -- --noEmit` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] Relevant tests pass, or missing coverage is recorded.
- [ ] Touched UI is checked at 320/375, 768, 1024, and 1440px.
- [ ] Touched interactions are keyboard-operable with visible focus.

## Phase A - Restore A Trustworthy Baseline

## Phase B - Canonical Backend-Derived Domain Types

### Task Group 020 - User And Identity Contracts

### Task Group 021 - Wallet And Payment Contracts

### Task Group 022 - Small Account-Domain Types

### Task Group 025 - Hero And Settings Contracts

### Task Group 026 - Inventory And Analytics Contracts

## Phase C - Replace Deleted Central Modules With Domain APIs

### Task Group 027 - Remove Missing `lib/catalog/*` Dependencies

Each task migrates direct consumers to its canonical domain without recreating
the deleted catch-all or adding re-export shims.

### Task Group 032 - Checkout-Related Domain APIs

### Task Group 033 - Social-Commerce Domain APIs

### Task Group 035 - Wallet And Small Account-Domain APIs

### Task Group 036 - Content And Settings APIs

### Task Group 037 - Inventory And Analytics APIs

## Phase D - Domain Ownership And Thin Routes

### Task Group 042 - Category And Storefront Navigation Components

### Task Group 043 - Remaining Top-Level Business Components

### Task Group 044 - Domain Validation Extraction

### Task Group 045 - Thin Storefront Routes

### Task Group 046 - Thin Admin Routes

### Task Group 047 - Split Oversized Components

## Phase E - Explicit Logic, UI, UX, And Accessibility Improvements

These tasks intentionally change behavior and begin only after the structural
refactor is green. Each requires focused interaction tests.

- [x] **Task 049 - Remove misleading sample-data fallbacks**
  - Start with admin orders, analytics, inventory, reviews, and customer detail.
  - Render explicit unavailable/error states with retry where safe.

- [x] **Task 050 - Fix cart and checkout state logic**
  - Move render-time address state mutation out of render; expose persistent
    errors; prevent empty-cart flash while session/query state is unresolved.

- [ ] **Task 051 - Make forms programmatically accessible**
  - Centralize stable description/error IDs; connect controls with
    `aria-describedby`; move focus to the first invalid field.

- [x] **Task 052 - Add landmarks, skip navigation, and semantic interactions**
  - Add a consistent `main-content` target; convert clickable rows/choices to
    links, buttons, or radio groups; add text alternatives to permission icons.

- [ ] **Task 053 - Enforce keyboard and touch interaction quality**
  - Add keyboard image reordering, inactive-carousel focus management, visible
    focus, and 44x44px effective touch targets.

- [ ] **Task 054 - Correct responsive failures**
  - Fix narrow OTP layout, product variant rows, settings tabs, mobile drawer,
    cart safe-area padding, and any verified horizontal overflow.

- [ ] **Task 055 - Make async and bulk actions truthful**
  - Await wishlist bulk operations, report partial failures, disable pending
    controls, and provide row-level status where applicable.

### Task Group 056 - Storefront Surface Improvements

Each task starts only after its corresponding Task Group 045 route is thin and
green. Preserve the established Rumera visual language while improving logic,
accessibility, responsive behavior, loading/error/empty states, and product feel.

- [ ] **Task 056a - Improve the product-detail storefront**
  - Scope: product detail route and product-domain detail components.
  - Verify gallery keyboard behavior, variant selection, unavailable/empty data,
    price presentation, review/recommendation states, mobile layout, metadata,
    and structured data against actual backend fields.
  - Depends: Tasks 045d, 050, and 053-054.

- [ ] **Task 056b - Improve the category-index storefront**
  - Scope: category index route and category-domain presentation components.
  - Verify hierarchy comprehension, counts, empty trees, image fallbacks,
    responsive cards, keyboard navigation, metadata, and structured data.
  - Depends: Tasks 045e and 052-054.

- [ ] **Task 056c - Improve the category-detail storefront**
  - Scope: category detail route, product results, filtering, sorting, and
    pagination presentation.
  - Preserve URL state, distinguish empty/error states, and verify mobile filters,
    focus behavior, metadata, and structured data.
  - Depends: Tasks 045f and 048, 052-054.

- [ ] **Task 056d - Define the tag storefront URL and data contract**
  - The current repository has no tag storefront route, backend tags have no
    `slug`, and product-by-tag support must be verified before implementation.
  - Decide an ID/title URL strategy and required backend query/endpoint from
    evidence; record an explicit blocker if backend support is absent.
  - Depends: Tasks 012 and 030b.

- [ ] **Task 056e - Implement the tag storefront**
  - Add the agreed tag index/detail route and tag-domain composition only after
    Task 056d establishes a supported URL and product-query contract.
  - Include loading/error/empty states, pagination, metadata, responsive layout,
    keyboard flow, and tests without fabricating a slug.
  - Depends: Tasks 039, 048, 052-054, and 056d.

- [ ] **Task 056f - Improve the journal-list storefront**
  - Verify featured-story logic, pagination, empty/error states, card semantics,
    image fallbacks, responsive rhythm, and metadata.
  - Depends: Tasks 045i and 048, 052-054.

- [ ] **Task 056g - Improve the journal-detail storefront**
  - Verify article semantics, heading hierarchy, readable line length, embedded
    product states, related stories, responsive media, metadata, and JSON-LD.
  - Depends: Tasks 045j and 048, 052-054.

- [ ] **Task 056h - Improve the recipe-list storefront**
  - Verify search/filter/pagination URL state, difficulty labels, empty/error
    states, responsive cards, keyboard flow, metadata, and structured data.
  - Depends: Tasks 045g and 048, 052-054.

- [ ] **Task 056i - Improve the recipe-detail storefront**
  - Verify ingredient and instruction semantics, quantity formatting, shoppable
    product availability, responsive content, keyboard flow, metadata, and
    recipe structured data against actual backend fields.
  - Depends: Tasks 045h and 048, 052-054.

## Phase F - Backend Surface Completion And Production Readiness

The tasks below are new product behavior, not structural moves. Implement each
capability end-to-end and expose only backend-supported behavior. Every admin page
must use domain-owned contracts/APIs, real permission checks, loading/error/empty
states, responsive layouts, and truthful mutation feedback.

### Task Group 057 - Owner-Aware Local Media Pipeline

Local filesystem storage is the required deployment for now. Do not introduce a
CDN, S3, or other object-store dependency. Keep the storage abstraction so a
future adapter remains possible without changing feature code.

- [ ] **Task 057a - Organize local media by domain and stable owner**
  - Store files under safe readable namespaces such as
    `products/<stable-product-id>-<sanitized-slug>/...`,
    `hero-slides/<slide-id>/...`, `recipes/<recipe-id>/...`, and
    `journal/<article-id>/...`; never rely on mutable titles alone for identity.
  - Persist storage keys and canonical public `/media/...` paths, protect against
    traversal/collisions, preserve atomic writes, and define migration behavior
    for already persisted flat UUID keys.
- [ ] **Task 057b - Generalize the working image uploader**
  - Reuse one uploader contract across products, hero slides, recipes, and journal
    content with URL-or-local-file input, previews, progress, alt text, ordering,
    primary/responsive roles, validation, and explicit ownership attachment.
- [ ] **Task 057c - Make media lifecycle and cache behavior durable**
  - Delete replaced/removed blobs and rendered derivatives, clean product-cascade
    files, release cancelled standalone uploads, and provide a safe orphan
    reconciliation job with an auditable dry run.
  - Invalidate affected product/category/home/hero caches after writes and ensure
    local development, Docker persistence, backup/restore, and multi-process
    serving behavior are documented and verified.
- [ ] **Task 057d - Harden and test local image processing**
  - Correct multipart size overhead, enforce decoded pixel/dimension limits,
    validate real file signatures, keep transform limits/cache keys deterministic,
    and add upload/serve/replace/delete/rollback/path-safety integration tests.

### Task Group 058 - Production Product And Variant Authoring

Variant dimensions such as size, color, material, or pack are product option
types/values. Inventory remains responsible for stock against the resulting SKU;
it must not become the owner of merchandising attributes.

- [ ] **Task 058a - Repair product admin read/update correctness**
  - Add an admin-safe detail read for inactive products, exclude the current row
    from slug/code uniqueness checks, persist submitted tags, and add focused
    backend tests for create/edit/draft behavior.
- [ ] **Task 058b - Correct and expose the product-option data model**
  - Replace the independently unique variant-option columns with the correct
    composite/invariant constraints, add option-type/value CRUD and replacement
    APIs, and define deletion rules for options already used by variants.
- [ ] **Task 058c - Hydrate and edit variant attributes**
  - Return variant option values and variant-specific images in admin/product
    detail projections, then add reusable size/color/material/custom option
    selectors to each variant row with duplicate-combination and SKU validation.
  - Keep stock quantities and movement history in inventory while linking each
    generated option combination to its concrete variant ID/SKU.
- [ ] **Task 058d - Make aggregate product persistence atomic and recoverable**
  - Save product fields, tags, variant creates/updates/deletes, option assignments,
    and image ownership through one transactional or explicitly resumable backend
    workflow. Support intentional clearing of nullable fields and report precise
    partial/validation failures rather than leaving half-created products.
- [ ] **Task 058e - Polish and verify the complete product form**
  - Improve progressive disclosure, variant tables, bulk option generation,
    responsive editing, validation/focus behavior, unsaved-change protection, and
    create/edit tests while retaining the established admin visual language.

### Task Group 059 - Modular Hero Builder And Storefront Rendering

- [ ] **Task 059a - Build the modular hero-slide editor**
  - Use the section composition from Task 047e and shared uploader from Task 057b
    for desktop/mobile media or external URLs, content, CTA pairs, theme,
    scheduling, publication, order, and an accurate responsive preview.
  - Keep the model extension-ready but do not invent an unbounded page-builder
    schema that the backend and storefront cannot render.
- [ ] **Task 059b - Complete hero persistence and publication semantics**
  - Support intentional field clearing, validate CTA label/href pairs and safe URL
    protocols, validate schedule ranges, add atomic reorder, and invalidate public
    hero caches after every successful mutation.
- [ ] **Task 059c - Render every supported hero field truthfully**
  - Use mobile imagery at the appropriate breakpoint, apply light/dark theme to
    text/overlays/controls, honor schedule/publication windows, keep one semantic
    page heading, and verify focus, autoplay, reduced motion, and touch behavior.

### Task Group 060 - Surface Existing Backend Capabilities In Admin

- [ ] **Task 060a - Align admin authorization, users, roles, and permissions**
  - Resolve the backend `admin`-only middleware versus frontend
    `admin`/`manager`/`support` mismatch before exposing controls.
  - Replace the static role matrix and fabricated member counts with a supported
    backend contract, then make user creation, role/permission assignment, status
    changes, and deletion real and auditable. Do not advertise roles the backend
    cannot authorize.
- [ ] **Task 060b - Add complete tag administration**
  - Fix the required database slug versus omitted Go model/write contract first,
    then add list/create/edit/delete UI and product-form integration.
- [ ] **Task 060c - Add coupon administration**
  - Wire the existing backend CRUD into searchable, paginated create/edit/archive
    experiences with discount/value/date/applicability validation.
- [ ] **Task 060d - Add shipping zone and method administration**
  - Manage zones, methods, rates, weight/region rules, ordering, and activation
    through the existing shipping backend without duplicating checkout contracts.
- [ ] **Task 060e - Add payment operations and gift-card issuance**
  - Add payment list/detail/transaction lookup and staff gift-card batch issuance
    using the existing read/issue APIs. Do not invent unsupported payment mutations.
- [ ] **Task 060f - Add journal and journal-category administration**
  - Add article/category list, create, edit, publish, and delete flows using the
    backend blog surface and the shared local media workflow from Task 057b.
- [ ] **Task 060g - Complete inventory operations**
  - Add per-variant movement history and reorder-threshold management alongside
    the existing real stock adjustment flow.
- [ ] **Task 060h - Finish truthful admin actions and analytics coverage**
  - Wire or remove sample product duplicate/delete controls, expose supported user
    and recipe deletion, and surface search/event/product analytics only after the
    catalog numeric-ID versus analytics UUID mismatch is resolved.
- [ ] **Task 060i - Integrate new modules into admin navigation and overview**
  - Add permission-aware navigation, summary cards, actionable counts, and direct
    routes for the completed modules without turning the dashboard into a second
    owner of their domain logic.

### Task Group 061 - Storefront Media, Catalogue, And Cache Consistency

- [ ] **Task 061a - Standardize storefront media rendering**
  - Define one responsive image policy for product cards, product detail,
    categories, hero, recipes, journal, wishlist, and recommendations using stored
    media metadata and deliberate per-domain fallbacks.
- [ ] **Task 061b - Coordinate domain cache invalidation**
  - Revalidate/tag the exact product detail, catalogue, category, home,
    recommendation, and hero surfaces affected by admin product/media/content
    writes so successful changes do not remain stale for arbitrary TTLs.
- [ ] **Task 061c - Make catalogue links, sorting, price, and availability truthful**
  - Remove unsupported `price`/`discount` sort controls or implement matching
    backend queries, prevent missing-slug links, and distinguish no active variant
    from a real zero price before enabling quick commerce actions.

### User-Requested Production Follow-Ups

- [ ] **Task 061d - Fix local media URL resolution across frontend and backend origins**
  - Keep persisted upload paths canonical and environment-independent, but resolve
    backend-relative values such as `/media/recipes/<file>.webp` against the
    configured media/API origin when local frontend and backend servers use
    different origins.
  - Use one resolver for upload previews and persisted product, category, hero,
    recipe, and journal media; preserve already absolute URLs and prevent duplicate
    origin or `/media` prefixes.
  - Verify local development, same-origin production, and Docker rendering with
    focused resolver and upload-to-render regression tests.

- [ ] **Task 061e - Repair and polish the canonical product card**
  - Give catalogue cards more usable width, reduce the image area slightly, and
    keep the layout mobile-first without introducing horizontal overflow.
  - Show backend-supported product tags when they can be added to the list
    projection without per-card requests; do not fabricate tags or add an N+1
    fetch path.
  - Keep the complete formatted price and `تومان` unit visible at narrow widths,
    with no `تو...` truncation or collision with actions, and verify the canonical
    card wherever it is reused at 320/375, 768, 1024, and 1440px.

- [ ] **Task 061f - Split the oversized Go seed command**
  - Refactor the actual 1,044-line `apps/backend/cmd/seed/main.go` file (the
    reported `cmd/see/main.go` path does not exist) into small responsibility-based
    files or packages for orchestration, fixtures, domain seeders, and shared
    helpers.
  - Preserve seed order, idempotency, generated relationships, error propagation,
    and command behavior; add focused tests around extracted deterministic logic
    and run the complete Go verification gates.

- [ ] **Task 061g - Strengthen the recipe-to-commerce journey**
  - Connect each teachable ingredient to its supported product/variant, required
    recipe quantity, availability, and useful alternative so readers can move from
    learning the recipe to buying the correct ingredients without ambiguity.
  - Improve the responsive shoppable section, individual and supported bulk-cart
    actions, unavailable/substitution states, and truthful success/partial-failure
    feedback while preserving the recipe as useful editorial content.
  - Reuse the canonical product, cart, inventory, and media contracts; extend the
    backend only where evidence shows the current recipe projection cannot support
    the required connection, and cover the complete recipe-to-cart path.

- [ ] **Task 062 - Add automated accessibility, interaction, and lifecycle regression tests**
  - Add axe checks and Playwright coverage for keyboard navigation, responsive
    overflow, checkout choices, validation errors, route error recovery, and the
    product/category/tag/journal/recipe storefront tasks in Group 056 plus the
    user-requested media, product-card, and recipe-commerce follow-ups.
  - Add focused API/component/integration coverage for the new admin modules,
    variant option combinations, transactional product writes, media ownership and
    cleanup, card quick actions, mega-menu focus behavior, and hero publication.

- [ ] **Task 063 - Final architecture, production-readiness, and UX acceptance audit**
  - Confirm top-level component purity, domain self-containment, dashboard
    presentation-only boundaries, thin routes, backend type parity, green build,
    responsive behavior, keyboard flow, local-media durability, cache freshness,
    real admin capability coverage, maintainable seed-command composition, the
    corrected product-card and recipe-commerce experience, and no unresolved
    blockers.

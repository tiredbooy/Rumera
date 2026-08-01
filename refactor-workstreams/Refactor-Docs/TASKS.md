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
- Lettered IDs such as `Task 022a` are complete, independently claimable tasks.
  A task-group heading is organizational only and is never claimed as a whole.
- A dependency on a task group means every lettered task in that group must be
  complete unless the dependent task names a narrower dependency.

## Remaining Cross-Task Gates

- Complete Task Groups 057 and 058 plus Tasks 061a and 061d before dependent
  product, hero, journal, recipe, card, or media-surface work.
- Complete Task 060f before the final journal storefront pass if it changes shared
  journal types or APIs.
- Complete Tasks 060j and 060k before Task 063.
- Start Task 062 only after every earlier implementation task is complete.
- Start Task 063 only after Task 062 and all prior completion records are verified
  in `FINISHED.md`.

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

## Phase F - Backend Surface Completion And Production Readiness

The tasks below are new product behavior, not structural moves. Implement each
capability end-to-end and expose only backend-supported behavior. Every admin page
must use domain-owned contracts/APIs, real permission checks, loading/error/empty
states, responsive layouts, and truthful mutation feedback.

### Task Group 060 - Surface Existing Backend Capabilities In Admin

- [ ] **Task 060h - Finish truthful admin actions and analytics coverage**
  - Wire or remove sample product duplicate/delete controls, expose supported user
    and recipe deletion, and surface search/event/product analytics only after the
    catalog numeric-ID versus analytics UUID mismatch is resolved.
- [ ] **Task 060j - Harden coupon redemption and operational contracts**
  - Enforce product/category applicability during authoritative order creation,
    reload and validate the coupon definition after taking its redemption lock,
    and normalize submitted codes consistently with preview validation.
  - Preserve order and redemption history by replacing destructive admin deletion
    with deactivation, return truthful usage/exhaustion data in admin lists, verify
    referenced applicability IDs, and restore field-level PATCH validation errors.
- [ ] **Task 060k - Make shipping selection and pricing authoritative end to end**
  - Resolve the delivery region from the selected address and the package weight
    from authoritative cart/product data instead of checkout constants.
  - Reject inactive, out-of-region, and overweight methods during order creation,
    and calculate flat, per-kilogram, percentage, threshold-free, and free rates
    through one shared shipping policy so the preview and persisted order agree.
  - Pass the required quote inputs through the existing shipping hook without
    duplicating checkout-owned state, make the guaranteed method-zone ownership
    field required after migrating checkout fixtures, and cover quote/order drift
    and tampering.
  - Depends: Tasks 050 and 060d.

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
  - Permit explicit `http://` origins for local development, require `https://`
    for configured public/external media origins, and prevent mixed-content or
    accidental protocol-downgrade behavior in production.
  - Verify local development, same-origin production, and Docker rendering with
    focused resolver and upload-to-render regression tests.

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

- [ ] **Task 061h - Apply the canonical Rumera logo across product surfaces**
  - Audit the assets under `apps/frontend/public/logo`, select source files by
    actual dimensions and transparency, and use them consistently for the site
    header, footer, metadata, social/share images, authentication/admin brand
    moments, favicon family, and install surfaces where each asset is appropriate.
  - Keep one reusable brand-mark component and metadata source, provide useful alt
    text where the logo conveys identity, mark decorative repeats appropriately,
    avoid layout shift, and do not stretch or redraw the supplied artwork.

- [ ] **Task 061i - Add a production-ready installable PWA**
  - Add a standards-compliant web app manifest, generated icon set based on the
    canonical Rumera logo, theme/background colors, standalone display behavior,
    install metadata, and a deliberately scoped service worker/update strategy.
  - Prioritize iPhone and iPad installation with Apple touch icons, safe-area-aware
    standalone layouts, status-bar metadata, and clear manual Add to Home Screen
    guidance where the platform does not expose an install prompt.
  - Define truthful offline and failure behavior instead of caching authenticated,
    checkout, or mutation responses indiscriminately; verify installability,
    upgrades, cache invalidation, and responsive launch behavior on iOS, Android,
    and desktop.
  - Depends: Task 061h.

- [ ] **Task 061j - Add a Kafka-backed notification worker and architecture guide**
  - Inventory the existing notification producers, persistence, delivery channels,
    retries, and worker runtime before selecting topic boundaries and message
    schemas; do not add a second source of truth or publish inside a database
    transaction without an outbox or another documented atomicity strategy.
  - Implement versioned events, idempotent consumers, retry/backoff and dead-letter
    handling, graceful shutdown, health/readiness, correlation IDs, metrics, and
    local Docker development while keeping delivery providers behind interfaces.
  - Document the end-to-end architecture and flow, producer/consumer ownership,
    topic and partition-key decisions, ordering and delivery guarantees, failure
    recovery, replay procedure, observability, security, deployment, and the
    evidence-based reasons Kafka is used instead of the previous mechanism.
  - Add integration tests covering publish, consume, duplicate delivery, retry,
    dead-letter, restart/replay, and broker-unavailable behavior.

- [ ] **Task 062 - Add automated accessibility, interaction, and lifecycle regression tests**
  - Add axe checks and Playwright coverage for keyboard navigation, responsive
    overflow, checkout choices, validation errors, route error recovery, and the
    product/category/tag/journal/recipe storefront tasks in Group 056 plus the
    user-requested media, product-card, and recipe-commerce follow-ups.
  - Add focused API/component/integration coverage for the new admin modules,
    variant option combinations, transactional product writes, media ownership and
    cleanup, authoritative shipping quotes, card quick actions, mega-menu focus
    behavior, and hero publication.

- [ ] **Task 063 - Final architecture, production-readiness, and UX acceptance audit**
  - Confirm top-level component purity, domain self-containment, dashboard
    presentation-only boundaries, thin routes, backend type parity, green build,
    responsive behavior, keyboard flow, local-media durability, cache freshness,
    real admin capability coverage, maintainable seed-command composition, the
    corrected product-card and recipe-commerce experience, and no unresolved
    blockers.

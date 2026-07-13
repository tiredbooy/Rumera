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

- [ ] **Task 042a - Move category tree hook and domain files**
  - Depends: Tasks 029 and 039.
- [ ] **Task 042b - Move product mega menu**
  - Depends: Task 042a.
- [ ] **Task 042c - Move mobile category drawer**
  - Depends: Task 042b.
- [ ] **Task 042d - Move header search**
  - Depends: Task 042c.
- [ ] **Task 042e - Move header actions and site-header composition**
  - Depends: Task 042d.

### Task Group 043 - Remaining Top-Level Business Components

- [ ] **Task 043a - Move add-to-cart button**
- [ ] **Task 043b - Consolidate and move legacy product card**
- [ ] **Task 043c - Move age gate to compliance domain**
- [ ] **Task 043d - Move brand marquee to home/brand owner**
- [ ] **Task 043e - Split multi-domain admin status badges**
- [ ] **Task 043f - Move variant picker to product domain**
- [ ] **Task 043g - Move category image input**
  - Every subtask depends on Tasks 028-039 and its canonical domain. Keep
    `/components/ui` and proven generic primitives only.

### Task Group 044 - Domain Validation Extraction

- [ ] **Task 044a - Extract settings validation**
- [ ] **Task 044b - Extract brand validation**
- [ ] **Task 044c - Extract customer validation**
- [ ] **Task 044d - Extract recipe validation**
- [ ] **Task 044e - Extract hero-slide validation**
- [ ] **Task 044f - Extract category validation**
- [ ] **Task 044g - Extract address validation**
- [ ] **Task 044h - Extract profile validation**
  - Each subtask depends on that domain's canonical type/API work and must preserve
    current validation behavior exactly.

### Task Group 045 - Thin Storefront Routes

- [ ] **Task 045a - Thin home route**
- [ ] **Task 045b - Thin search route**
- [ ] **Task 045c - Thin product-list route**
- [ ] **Task 045d - Thin product-detail route**
- [ ] **Task 045e - Thin category-index route**
- [ ] **Task 045f - Thin category-detail route**
- [ ] **Task 045g - Thin recipe-list route**
- [ ] **Task 045h - Thin recipe-detail route**
- [ ] **Task 045i - Thin journal-list route**
- [ ] **Task 045j - Thin journal-detail route**
- [ ] **Task 045k - Thin checkout-confirmation route**
- [ ] **Task 045l - Thin FAQ route**
- [ ] **Task 045m - Thin About route**
  - Each subtask depends on its canonical domain API plus Task 039 and preserves
    metadata, rendered output, and behavior.

### Task Group 046 - Thin Admin Routes

- [ ] **Task 046a - Thin product-create route**
- [ ] **Task 046b - Thin product-edit route**
- [ ] **Task 046c - Thin category-create route**
- [ ] **Task 046d - Thin category-edit route**
- [ ] **Task 046e - Thin brand-edit route**
- [ ] **Task 046f - Thin recipe-create route**
- [ ] **Task 046g - Thin recipe-edit route**
- [ ] **Task 046h - Thin settings route**
- [ ] **Task 046i - Thin customer-list route**
- [ ] **Task 046j - Thin customer-detail route**
- [ ] **Task 046k - Thin customer-edit route**
- [ ] **Task 046l - Thin order-detail route**
- [ ] **Task 046m - Thin roles route**
  - Each subtask depends on its canonical domain API plus Tasks 038-039.

### Task Group 047 - Split Oversized Components

- [ ] **Task 047a - Split `RecipeForm` responsibilities**
- [ ] **Task 047b - Split `CheckoutFlow` responsibilities**
- [ ] **Task 047c - Split `WalletView` responsibilities**
- [ ] **Task 047d - Split `SettingsForm` responsibilities**
- [ ] **Task 047e - Split hero-form responsibilities**
- [ ] **Task 047f - Split customer-form responsibilities**
- [ ] **Task 047g - Split subscriptions-view responsibilities**
- [ ] **Task 047h - Split reviews-section responsibilities**
  - Each subtask is limited to data orchestration plus presentation, or moving
    existing helpers/schema. No behavior redesign.

## Phase E - Explicit Logic, UI, UX, And Accessibility Improvements

These tasks intentionally change behavior and begin only after the structural
refactor is green. Each requires focused interaction tests.

- [ ] **Task 048 - Add route-level loading, error, not-found, and retry states**
  - Cover root, storefront, account, checkout, and admin groups.
  - Distinguish zero data, unresolved loading, and failed requests.

- [ ] **Task 049 - Remove misleading sample-data fallbacks**
  - Start with admin orders, analytics, inventory, reviews, and customer detail.
  - Render explicit unavailable/error states with retry where safe.

- [ ] **Task 050 - Fix cart and checkout state logic**
  - Move render-time address state mutation out of render; expose persistent
    errors; prevent empty-cart flash while session/query state is unresolved.

- [ ] **Task 051 - Make forms programmatically accessible**
  - Centralize stable description/error IDs; connect controls with
    `aria-describedby`; move focus to the first invalid field.

- [ ] **Task 052 - Add landmarks, skip navigation, and semantic interactions**
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

- [ ] **Task 057 - Add automated accessibility and interaction regression tests**
  - Add axe checks and Playwright coverage for keyboard navigation, responsive
    overflow, checkout choices, validation errors, route error recovery, and the
    product/category/tag/journal/recipe storefront tasks in Group 056.

- [ ] **Task 058 - Final architecture and UX acceptance audit**
  - Confirm top-level component purity, domain self-containment, dashboard
    presentation-only boundaries, thin routes, backend type parity, green build,
    responsive behavior, keyboard flow, and no unresolved blockers.

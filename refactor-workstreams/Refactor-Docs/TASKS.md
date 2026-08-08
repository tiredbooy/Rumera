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
- Lettered IDs such as `Task 076a` are complete, independently claimable tasks.
  A task-group heading is organizational only and is never claimed as a whole.
- A dependency on a task group means every lettered task in that group must be
  complete unless the dependent task names a narrower dependency.

## Backlog Status (2026-08-08 Acceptance Reconciliation)

- Tasks **000-075**, **076a-077a**, and **081a** are complete and live in
  `FINISHED.md` only.
- This file contains only open work: **078a-080c** and **082a-086a**.
- Phase K-M completion claims were re-audited against their exact acceptance
  criteria and current implementation. Tasks 076a-077a have now passed their
  material implementation and applicable contract, responsive, RTL, keyboard,
  reduced-motion, and focused test gates.
- Earlier Phase K-M entries in append-only `FINISHED.md` are preserved as
  implementation snapshots; the reconciliation record there identifies the
  claims that were reopened.

## Remaining Cross-Task Gates

- Fix **078a** before relying on recipe/PDP buy flows (**079a**, **080b**) as
  fully verifiable.
- Complete **080a**/**080b** before treating storefront product purchase UX as
  final.
- Complete **082a** before closing **083a** so user and wallet mutations use
  server-enforced capabilities.

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

## Phase K - Storefront Polish, Commerce Correctness, And Discovery UX

### Task Group 078 - Cart reliability and shop settings correctness

- [ ] **Task 078a - Fix Add to Cart: actually adds without client/API errors**
  - Reproduce and fix the current failure from storefront CTA through cart
    client, BFF, and backend contract.
  - Verify single-add, variant-required products, truthful errors, and
    non-blocking recommendation tracking.
  - Re-audit gap: normalization/error helpers are tested, but the original
    failure was not reproduced and no regression test proves a real successful
    add through the button/API path.

- [ ] **Task 078b - Shop settings: phone, address, and related fields persist correctly**
  - Values must save, rehydrate, and reflect without silent failure.
  - Match backend contracts; provide field validation and retry on network error.
  - Cover mutation plus reload and one failure path.
  - Re-audit gap: payload/rehydration helpers exist, but retry and the required
    mutation-to-reload/failure tests are missing.

### Task Group 079 - Recipe detail shopping experience

- [ ] **Task 079a - Recipe detail: clear, smooth UX to buy what the recipe needs**
  - Keep ingredients, linked products, quantities, unavailable/unlinked states,
    and API-backed single/bulk add paths clear and mobile-first.
  - Respect the 076c stock policy and do not invent recipe/product fields.
  - Re-audit gap: summary counts mix product and ingredient units, an empty bulk
    response can report false success, and summary/mobile/cart behavior lacks
    focused coverage.

### Task Group 080 - Product detail page redesign

- [ ] **Task 080a - PDP media gallery redesign (desktop + mobile)**
  - Use a clean stable gallery with thumbnails, appropriate zoom/lightbox,
    app-like mobile swipe, truthful missing media, keyboard operation, and
    reduced-motion safety.
  - Re-audit gap: missing media is presented as a product illustration without
    placeholder disclosure; reduced-motion and RTL centering have gaps; touch,
    empty, and responsive states are not covered.

- [ ] **Task 080b - PDP variant selector and price block redesign**
  - Support real single-axis and multi-axis option combinations with correct
    selected price/availability and honest unavailable states.
  - Keep CTA/cart and the 076c stock rule aligned with backend data.
  - Re-audit gap: sparse matrices can make valid variants unreachable,
    heterogeneous option sets can invent combinations, control semantics fail
    scoped lint, and no integration test proves selection-to-price/cart changes.

- [ ] **Task 080c - Product feedback: non-buyer policy and comment UX**
  - Keep Option A: authenticated non-buyers may comment; delivered-order buyers
    receive a verified-purchase badge and other authors receive a visitor badge.
  - Re-audit gap: backend API docs still state purchase is required, frontend
    policy/badge states lack tests, and full backend verification is blocked by
    the active 082a compile failure.

---

## Phase L - Admin Operator Power: RBAC, Users, Discounts, Inventory

Task 081a is complete and archived in `FINISHED.md`.

### Task Group 082 - Dynamic roles and RBAC

- [ ] **Task 082a - Dynamic admin roles and capability assignment**
  - Define roles, assign capabilities, and support lower-privilege staff versus
    full admins using real server data.
  - Capabilities must drive nav filtering, server route guards, BFF checks, and
    backend authorization.
  - Provide role/capability administration and denied-route tests.
  - Re-audit gap: the shipped matrix is browser-only `localStorage` over fixed
    roles. Active backend hardening is not wired, dynamic role CRUD is absent,
    and `capability_svc.go` currently does not compile.

### Task Group 083 - User management and wallet operations

- [ ] **Task 083a - Users management: inspect, edit, and wallet top-up**
  - Keep truthful profile/status/role editing and wallet credit through real APIs.
  - Require confirmation, operation-specific permission gates, audit-friendly
    results, duplicate protection, and focused tests.
  - Re-audit gap: wallet credit has no confirmation, capability gate,
    idempotency/audit actor, or focused tests; role editing remains hard-coded and
    depends on 082a.

### Task Group 084 - Discount form connected to catalogue

- [ ] **Task 084a - Discount create/edit: product/category selects + Jalali dates**
  - Use searchable real catalogue selectors, Jalali date input, truthful
    loading/empty/error/retry states, validation, and focused tests.
  - Re-audit gap: product lookup is limited to the first 100 items, loader errors
    are swallowed, and Jalali input rejects its Persian-digit example and can
    retain a stale valid value after invalid edits; focused coverage is missing.

### Task Group 085 - Inventory management upgrade

- [ ] **Task 085a - Inventory management: clearer ops and safer stock edits**
  - Keep search/filters, storefront-aligned critical stock visibility, safe
    API-backed edits, and truthful empty/error/retry states.
  - Surface missing shipping-weight remediation in the inventory workflow.
  - Re-audit gap: inventory contracts/UI do not expose the missing-weight signal,
    and the new below-3 filter path has no focused test.

---

## Phase M - Load And Performance Testing Harness

### Task Group 086 - Generic K6 load scripts

- [ ] **Task 086a - Create a generic K6 script suite for Rumera**
  - Provide env-driven smoke, mixed browse/cart, optional authenticated paths,
    thresholds, safe fixtures, and local/staging documentation.
  - Cover home, catalogue, product detail, and at least one safe write path.
  - Re-audit gap: product detail is absent, thresholds are hard-coded, documented
    bearer auth does not work through the default Next BFF, write checks accept
    unauthorized responses, fixtures are not isolated, and K6 was not executed.

---

## Claim Order

### Phase K
1. **078a** -> **078b**
2. **079a** after **078a**
3. **080a** -> **080b** -> **080c**

### Phase L
1. **082a** -> **083a**
2. **084a**
3. **085a**

### Phase M
1. **086a** after the authenticated cart path and fixture policy are stable.

When a task completes: append a full verified record to `FINISHED.md`, remove
its block from this open backlog, and clear `IN_PROGRESS.md`.

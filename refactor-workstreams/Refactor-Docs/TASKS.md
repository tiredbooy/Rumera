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

## Backlog Status (2026-08-10 Verification Pass)

### Closed (verified or accepted; live in `FINISHED.md`)

- Tasks **000-075**, **076a-077a**, **078a-081a**, **082a**, **083a**, **084a**, **086a**
- Phase K storefront work (cart, settings, recipe shop UX, PDP gallery/variants,
  review non-buyer policy) re-checked against code + focused tests on 2026-08-10.
- K6 suite now includes smoke/mixed/capacity/frontend-capacity/cart-write and
  product-detail journeys.

### Still open (material gaps remain)

- **085a** (narrow residual) — Inventory **missing shipping-weight remediation**
  signal in the ops workflow. Critical low-stock filter already shipped.

### Closed this loop

- **082a** — Dynamic admin roles + capability assignment (server matrix,
  `RequirePermission`, staff panel entry, FE API-backed matrix).
- **083a** — Wallet top-up confirmation, capability gate, idempotency/actor,
  focused tests.

### Related workstream

Backend package reorganisation is **not** tracked here. See:

`refactor-workstreams/backend-feature-architecture/TASKS.md`

## Remaining Cross-Task Gates

- Optional polish: **085a** weight remediation when product/inventory contracts
  expose the signal.

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

## Phase L - Admin Operator Power: RBAC, Users, Inventory residual

### Task Group 085 - Inventory residual

- [x] **Task 085a - Inventory missing-weight remediation signal** · **DONE 2026-08-12**  
  - Closed via production-hardening **PH-020a** (API `weight` + `missing_weight`)  
    + **PH-020b** (admin badge, filter, KPI, detail callout).  
  - See `refactor-workstreams/production-hardening-and-product/FINISHED.md` (PH-020a/b)  
    and cross-link note below in this workstream `FINISHED.md`.

---

## Claim Order

### Phase L
1. ~~085a~~ done (absorbed by PH-020a/b)

When a task completes: append a full verified record to `FINISHED.md`, remove
its block from this open backlog, and clear `IN_PROGRESS.md`.

# Parallel Agent Assignments

**Workstream ID:** `gpt56-domain-refactor-20260713`
**Coordinator:** Agent A
**Effective:** 2026-07-15, after Task 048

## Non-Conflict Rules

1. Each agent may have at most one implementation task active.
2. Agent A edits `TASKS.md`, `AGENT_ASSIGNMENTS.md`, and `IN_PROGRESS_A.md` /
   `FINISHED_A.md`. Agent B edits only `IN_PROGRESS_B.md` / `FINISHED_B.md`.
3. `IN_PROGRESS.md` and `FINISHED.md` are the closed single-agent archive and
   remain untouched during parallel execution.
4. Only the current wave grants application-file ownership. Reserved later tasks
   are not permission to edit their files early.
5. Re-read `git status --short` and every scoped file immediately before edits.
   If an unlisted shared file is required, stop and record a handoff request.
6. No broad formatting, generated-file cleanup, compatibility shims, or edits to
   the other agent's files.
7. Agent A opens the next wave only after both current tasks are verified and
   their application-file diffs no longer overlap.

## Permanent Task Ownership

### Agent A - Frontend Experience And Independent Admin Modules

049, 052, 053, 056a, 056b, 056c, 056f, 056g, 056h, 056i, 059a, 059b, 059c,
060c, 060d, 060e, 060g, 060h, 060i, 061c, 061e, 061g, 062, 063.

### Agent B - State, Forms, Platform, Media, Product Core, And Contract Work

050, 051, 054, 055, 056d, 056e, 057a, 057b, 057c, 057d, 058a, 058b, 058c,
058d, 058e, 060a, 060b, 060f, 061a, 061b, 061d, 061f.

## Completed Wave 1

### Agent A - Task 049

**State:** Completed and verified (Agent A, 2026-07-15)

Exclusive write scope:

- `apps/frontend/app/admin/{orders,analytics,inventory,reviews}/**`
- `apps/frontend/app/admin/customers/[id]/**`
- Admin order, analytics, inventory, review, and customer-detail feature files
- Focused tests colocated with those features

Agent A must not edit cart, checkout, address, or customer checkout-state files in
this wave.

### Agent B - Task 050

**State:** Completed and verified (Agent B, 2026-07-15)

Exclusive write scope:

- `apps/frontend/app/(storefront)/{cart,checkout}/**`
- `apps/frontend/features/{cart,checkout,addresses}/**`
- Checkout-owned order-placement state and focused tests

Agent B must not edit admin order, analytics, inventory, review, or customer-detail
files in this wave. Shared UI/API helpers require a recorded handoff instead of a
direct edit.

## Current Wave 2

### Agent A - Task 052

**State:** Completed and scoped-verified (Agent A, 2026-07-15)

Exclusive write scope:

- `apps/frontend/app/layout.tsx`
- `apps/frontend/app/(storefront)/layout.tsx`
- `apps/frontend/app/(auth)/layout.tsx`
- `apps/frontend/app/forbidden/page.tsx`
- `apps/frontend/app/global-error.tsx`
- `apps/frontend/components/route-state.tsx`
- `apps/frontend/features/dashboard/components/dashboard-shell.tsx`
- `apps/frontend/features/account/account/components/account-shell.tsx`
- `apps/frontend/features/admin/analytics/components/DataTable.tsx`
- `apps/frontend/features/admin/products/components/ProductsTable.tsx`
- `apps/frontend/features/admin/roles/components/roles-view.tsx`
- `apps/frontend/features/checkout/components/checkout-step-presentation.tsx`
- `apps/frontend/features/checkout/components/checkout-address-step.tsx`
- `apps/frontend/features/checkout/components/checkout-shipping-step.tsx`
- `apps/frontend/features/checkout/components/checkout-state.test.tsx`
- Focused tests colocated with these surfaces

Agent A must not edit form validation/error wiring or
`checkout-payment-step.tsx` in this wave.

### Agent B - Task 051

**State:** In progress (Agent B)

Exclusive write scope:

- `apps/frontend/components/ui/field.tsx`
- Form-only files under `features/auth`, `features/account/addresses`, and
  `features/admin/{brands,categories,customers,hero-slides,products,recipes,settings,uploads}`
- `apps/frontend/features/checkout/components/add-address-form.tsx`
- `apps/frontend/features/checkout/components/checkout-payment-step.tsx`
- Focused form-accessibility tests colocated with those features

Agent B owns `checkout-payment-step.tsx` completely and must include the Task 052
handoff: expose its mutually exclusive payment choices as a named radio group
while wiring coupon descriptions/errors for Task 051. Agent B must not edit Agent
A's landmark, table-row, permission, or other checkout-choice files in this wave.
The shared choice contract is `CheckoutChoiceGroup label` around
`CheckoutSelectRow name/value/selected/onClick`; use `checkout-payment` as the
payment radio name.

## Dependency And Handoff Gates

- Tasks 051-055 complete before either agent starts Group 056 surface work.
- Agent B completes media/product foundations 057, 058, 061a, and 061d before
  Agent A changes dependent product, hero, journal, recipe, card, or media surfaces.
- Agent B completes 056d and any required 060b tag contract work before 056e.
- Agent B completes 060f journal administration contracts before Agent A's final
  journal storefront pass if those contracts change shared journal types or APIs.
- Agent A completes 049 before Agent B starts 060a and before Agent A starts
  060g-060i.
- Agent A completes 053 and Agent B completes 051/054 before either agent edits
  the aggregate product form in 058e or downstream storefront interactions.
- Task 062 starts only after both agents finish all implementation assignments.
- Task 063 is the final task and starts only after Task 062 and both completion
  logs are green.

# Rumera Frontend Refactor — Agent Instructions

You are refactoring an existing Next.js + TypeScript + Go-backend e-commerce codebase to strictly follow the feature/domain-driven architecture described below. Read this entire document before touching any code.

---

## 0. Non-negotiable rules

1. **One task at a time.** Never batch multiple tasks from the plan into one pass. Finish, verify, log, then move to the next.
2. **Never guess at business logic.** If a file's purpose is ambiguous, leave it in place and add a note in the task log instead of deleting or moving it.
3. **Do not break the build.** After every task, the app must still compile and run. If a task can't be completed without breaking something else, stop and record why in the log instead of forcing it.
4. **No behavior changes.** This is a structural refactor, not a rewrite. Same props, same API responses, same UI output. Renaming/moving/splitting files is in scope; changing what they do is not, unless the task explicitly says so.
5. **Preserve existing conventions** already established in this codebase (do not "fix" these — they are intentional):
   - Feature-based organization under `features/<domain>/`
   - Server Components by default; Server Actions for mutations
   - A server-only `apiFetch` utility for all backend calls — never call the Go API directly from a component
   - `revalidatePath` for cache invalidation after mutations
   - Hybrid pattern for file uploads: XHR through a Route Handler proxy when upload progress is needed, Server Actions for everything else
   - Pages under `app/` contain routing only — no business logic, just composition of feature components

---

## 1. Architecture rules (source of truth)

### Business domains own their logic

Every business entity (`orders`, `products`, `categories`, `brands`, `tags`, `attributes`, `cart`, `checkout`, `inventory`, `shipping`, `payments`, `customers`, `addresses`, `coupons`, `reviews`, `wishlist`, `wallet`, `auth`, etc.) lives under `features/<domain>/` and owns:

```
features/<domain>/
├── api/
├── components/
├── hooks/
├── types.ts
├── validations.ts
├── constants.ts
└── utils.ts
```

### Dashboards are presentation layers only

`features/admin/` and `features/account/` never define their own business types or API calls. They import from the shared domain and only add dashboard-specific composition, e.g.:

```ts
// features/admin/orders/components/OrdersTable.tsx
import { Order } from "@/features/orders/types";
```

If admin genuinely needs extra fields the API doesn't return elsewhere:

```ts
interface AdminOrder extends Order {
  customer: CustomerSummary;
  payment: PaymentSummary;
}
```

Never create parallel types like `AdminOrder`/`CustomerOrder` unless the API responses are genuinely different shapes.

### Dependency direction (never invert this)

```
App Router → Dashboard/UI Feature → Business Domain → Shared API Client → Go Backend
```

Business domains never import from `features/admin/`, `features/account/`, or `app/`.

### API layer speaks business language, not HTTP

Good: `createOrder()`, `fetchMyOrders()`, `updateOrderStatus()`
Bad: `postOrder()`, `patchOrder()`

Split large domains' APIs by caller:

```
orders/api/
├── account.ts   # createOrder, fetchMyOrders, fetchMyOrder, cancelOrder
├── admin.ts     # fetchOrders, fetchOrder, updateOrderStatus
└── index.ts     # re-exports both
```

### Types model the business, not the transport

Good: `Order`, `Product`, `Category`
Bad: `OrderResponse`, `ProductResponse`

Dates stay as ISO strings (`createdAt: string`) unless explicitly converted.

---

## 2. The `/components` folder rule (strict)

`/components` (top-level, outside `features/`) is **only** for components that are:

- Generic and domain-agnostic (a `Button`, `Modal`, `DataTable`, `Skeleton`, `EmptyState`)
- Reusable across at least two unrelated domains
- Free of any business-specific naming, types, or API calls

If a component references a domain type (`Order`, `Product`, `Coupon`, etc.) or calls a domain API function, it does **not** belong in `/components` — it belongs in that domain's `features/<domain>/components/`.

When you find a component in `/components` that violates this: move it into the correct domain, and update every import site. Do not leave a re-export shim behind — fix the imports directly.

When you find domain-specific components scattered outside their domain folder (e.g. in `app/`, or duplicated between `features/admin/orders` and `features/account/orders` when they're actually identical): consolidate into the owning domain and have dashboards import from there.

---

## 3. Workflow you must follow for every session

1. Open `REFACTOR_PLAN.md`. Find the **first unchecked task**, top to bottom. Do not skip ahead.
2. Read the task's scope carefully. If it touches files you can't find, search the codebase before assuming they don't exist.
3. Do the work for that task only.
4. Verify: build passes, no unused imports left behind, no dangling references to moved files.
5. Move the task's checklist entry out of `REFACTOR_PLAN.md` and into a new log file (see naming convention below), marked complete with a short summary.
6. Update `REFACTOR_PLAN.md` by removing that entry (it now lives only in the log).
7. Commit-worthy state after every single task — never leave the tree half-migrated when you stop.

### Log file naming convention

When you complete a task, create:

```
refactor-logs/<NNN>-<short-task-slug>.md
```

Example: `refactor-logs/003-consolidate-order-status-badge.md`

Log file contents:

```markdown
# Task 003: Consolidate OrderStatusBadge

**Status:** Complete
**Date:** <date>

## What changed

- Moved `components/OrderStatusBadge.tsx` → `features/orders/components/OrderStatusBadge.tsx`
- Updated 6 import sites across `features/admin/orders` and `features/account/orders`
- Removed duplicate `AdminOrderStatusBadge` (was identical, just styled differently via prop)

## Files touched

- (list every file)

## Notes / follow-ups

- (anything the next task should know, or anything you deliberately left alone and why)
```

If you have to stop a task partway through (blocked, ambiguous, or risky), do **not** move it to the log. Leave it checked as `[in-progress]` in `REFACTOR_PLAN.md` with a one-line note on what's blocking it, so the next run picks it up correctly instead of restarting blind.

---

## 4. Clean code principles to apply while moving code (not while inventing new code)

- One component, one responsibility. If a file is doing data-fetching, business logic, and rendering all at once, and the task calls for splitting it, separate into a Server Component (data) + presentational component, not more than that.
- No default exports for utilities/hooks/types — named exports only. Components may keep default export only if that's already the codebase convention for components.
- No barrel-file re-export chains more than one level deep.
- Delete dead code and unused exports you encounter directly in scope, but don't go hunting outside the current task's files for unrelated dead code — log it as a follow-up task suggestion instead.
- Keep diffs minimal and mechanical. This pass is about location and boundaries, not style rewrites.

---

## 5. What "done" looks like for the whole project

- `/components` contains only truly generic, reusable primitives.
- Every domain folder under `features/` is self-contained: its own `api/`, `types.ts`, `components/`, `hooks/`.
- `features/admin/*` and `features/account/*` contain zero duplicated business types or API calls — only composition and dashboard-specific UI.
- `app/**/page.tsx` files are thin: they import and render, nothing else.
- `REFACTOR_PLAN.md` is empty (all tasks migrated to `refactor-logs/`).
- `refactor-logs/` contains a full, readable history of every change made, task by task.

---

## 6. `REFACTOR_PLAN.md` starter template

Copy this into `REFACTOR_PLAN.md` before the first run, then fill in real tasks after auditing the current codebase against the rules above. Keep each task scoped to something completable in one focused pass (a single component, a single domain's API split, etc.) — not "refactor all of catalog."

```markdown
# Refactor Plan

Tasks are done top-to-bottom. Do not skip. When complete, move the entry to
refactor-logs/<NNN>-<slug>.md and delete it from this list.

## Audit tasks (do these first)

- [ ] Audit `/components` and list every component that references a domain type or API call
- [ ] Audit `features/admin/**` and `features/account/**` for duplicated types/interfaces that already exist in a shared domain
- [ ] Audit `app/**` pages for embedded business logic that should live in a feature

## Migration tasks (populate after audit)

- [ ] <domain>: move <ComponentName> from /components into features/<domain>/components
- [ ] <domain>: consolidate duplicate <TypeName> between admin and account into shared features/<domain>/types.ts
- [ ] <domain>: split features/<domain>/api.ts into api/account.ts + api/admin.ts + api/index.ts
- [ ] app/<route>/page.tsx: extract inline logic into features/<domain>
```

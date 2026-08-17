---
tags: [playbook]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 12 Playbooks]]


# Playbook: Add admin module

1. Backend endpoints + permissions first
2. `features/admin/<name>` board + domain API
3. Thin `app/admin/<name>/page.tsx`
4. Nav entry in `lib/rbac/nav.ts` with permission
5. Page guard is `requirePermission(PERMISSIONS.…)` (or a thin named wrapper like `requireTagAdmin`). Do **not** check `session.role === "admin"` — that locks seeded staff out of modules they already have ([[RBAC]] · [[Admin Console]]).
6. Revalidation if public impact
7. List fetch failure is `AdminDataErrorState` (retry), not an empty table — same split as [[Admin Console]] `/admin/products` vs [[Catalogue]] empty.
8. Optional editor catalogs (product option types) must isolate like the product form: do not swallow to `[]` without saying why, and do not 500 brand/category/tag lookups. Empty catalog ≠ load failure — show a distinct error + retry ([[Journey Admin publish product]]).
9. Vault: [[Admin Console]] · [[Surface Admin]] · [[RBAC]]

Related: [[Playbook Add frontend domain]] · [[Customers Admin]]

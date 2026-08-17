# Panel RBAC (capabilities)

**Status:** as-built PH-021a + PR-040c + PR-040e  
**Code:** `internal/features/rbac`, `mw.RequirePermission`, composer `internal/routes/routes.go`, `users/admin_guards.go` (`liveAdminActor`)  
**FE catalogue:** `apps/frontend/lib/rbac/permissions.ts` (must stay in sync)

## Trust tier

| Layer | Rule |
|-------|------|
| Panel entry | JWT + live user active/not banned + role `admin` **or** `staff` |
| Capability | `RequirePermission` — **OR** of listed grants; **admin superuser always allowed** |
| UI | FE `can()` / nav filter — **not** a security boundary |

## Policy (PH-021a)

1. Every admin route is behind Auth + panel role.
2. Business surfaces use `with(perms...)` so staff without a grant get **403**.
3. **Read** routes accept `*:read` **or** `*:write` (writers can still list).
4. **Write** routes require the **write/moderate/delete** capability only — staff with only `*:read` cannot mutate.
5. RBAC matrix mutations require `roles:manage` (handler check).
6. **PR-040c model B:** `customers:write` is a non-money customer-edit grant. Role / status writes require live `role=admin`. Ledger minting is `wallet:credit` (not in the default staff seed).

### Actor rule (`liveAdminActor`)

Persistence no longer requires `role=admin` for every user mutation (that was the split brain: HTTP `customers:write` allowed, repo 403).

| Actor | Profile create (customer) / profile PATCH | Role / `is_active` / DELETE | Ban / unban | `POST …/wallet/credit` |
|-------|-------------------------------------------|-----------------------------|-------------|------------------------|
| Live `admin` | yes | yes (last-admin + no self-lockout) | yes (superuser) | yes (superuser) |
| Live `staff` + `customers:write` | yes | **403** | **403** unless also granted `customers:ban` | **403** unless also granted `wallet:credit` |
| Live `staff` + `customers:ban` only | no (needs `customers:write`) | **403** | yes (not self; last-admin 409) | **403** |
| Live `staff` + `wallet:credit` only | no (needs `customers:write`) | **403** | **403** | yes |
| Customer / banned / inactive | **403** | **403** | **403** | **403** |

`roles:manage` edits `role_capabilities`. Assigning `users.role` stays an admin-superuser write.

## Surface → capability matrix

| Surface | Read (list/detail) | Write / mutate |
|---------|--------------------|----------------|
| Products | `products:read` ∨ write | `products:write`; permanent delete also `products:delete` ∨ write |
| Categories / brands / options / variants | — (write-only admin HTTP) | `products:write` |
| Tags | `tags:manage` | `tags:manage` |
| Inventory | `inventory:read` ∨ write | `inventory:write` |
| Orders | `orders:read` ∨ write ∨ refund | `orders:write` ∨ `orders:refund` |
| Payments (admin reads) | `payments:read` | — |
| Coupons | `coupons:manage` | `coupons:manage` |
| Shipping admin | `shipping:manage` | `shipping:manage` |
| Gift cards issue | `gift-cards:issue` | `gift-cards:issue` |
| Customers / users | `customers:read` ∨ write ∨ `roles:manage` | Profile create/update/deactivate: `customers:write`. Role / `is_active` / DELETE: live `role=admin` (PR-040c). Ban/unban: `customers:ban` only (PR-040e; not OR'd onto write) |
| Wallet admin credit | `wallet:credit` | `wallet:credit` (not `customers:write`; not in default staff seed) |
| Reviews | `reviews:read` ∨ moderate | `reviews:moderate` |
| Recipes | `recipes:read` ∨ write | `recipes:write` |
| Journal (blog) | `journal:read` ∨ write | `journal:write` |
| Hero | `hero:manage` | `hero:manage` |
| Analytics / recommendations admin | `analytics:read` | `analytics:read` |
| Site settings | `settings:manage` | `settings:manage` |
| Roles matrix | panel user (GET grants); PUT needs `roles:manage` | `roles:manage` |
| Media admin upload | `products:write` ∨ `journal:write` ∨ `recipes:write` ∨ `hero:manage` | same |

## Operator playbook (add staff)

1. Admin with `roles:manage` opens **Roles / capabilities** matrix.
2. Grant staff the **minimum** set (e.g. `inventory:read` only for stock watchers — they cannot adjust stock).
3. Create or promote user with `role=staff` (`customers:write` for profile edits — not wallet credit).
4. Staff signs in — nav shows only surfaces `can()` allows; API enforces same IDs.
5. Demote/revoke: clear staff grants and/or set role to customer; next request rehydrates live role/status from DB (no stale JWT privilege).
6. To let a named operator mint wallet money, grant **`wallet:credit`** explicitly. Do not reuse `customers:write`.

## Edge cases (PH-021b)

| Case | Behaviour |
|------|-----------|
| Self-demotion / self-deactivate | **403 ACCESS_DENIED** — cannot strip own panel access |
| Last active `admin` demoted, deactivated, or banned | **409 CONFLICT** — create another admin first |
| Empty admin capability matrix save | Server stores **full catalogue** (admin remains superuser in enforcement) |
| Mid-session staff grant revoke | Next API call `HasPermission` fails → **403**; FE nav updates after matrix reload / session refresh |
| Staff with only `*:read` | Can list; **cannot** mutate (PH-021a write groups) |
| Staff with seed `customers:write` | Can create customers + patch profile fields; **403** on role / `is_active` / deactivate (`liveAdminActor` + service). **Cannot** ban/unban (needs `customers:ban`) or `POST /admin/users/:id/wallet/credit` (needs `wallet:credit`) |
| Staff with `customers:ban` | Can `POST /admin/users/:id/ban` and `/unban`. Self-ban denied; last active admin ban is **409**. Ban is not on PATCH. |
| `roles:manage` | Edits the capability matrix (`PUT /admin/capabilities/:role`). Does **not** assign `users.role` — that stays live admin |

## Related

- [authentication.md](../authentication.md)  
- FE `docs/platform/rbac.md`  
- Obsidian RBAC  

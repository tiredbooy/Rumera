# Panel RBAC (capabilities)

**Status:** as-built PH-021a  
**Code:** `internal/features/rbac`, `mw.RequirePermission`, composer `internal/routes/routes.go`  
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
| Customers / users | `customers:read` ∨ write ∨ `roles:manage` | `customers:write` ∨ `customers:ban` |
| Wallet admin credit | `customers:write` | `customers:write` |
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
3. Create or promote user with `role=staff` (`customers:write`).
4. Staff signs in — nav shows only surfaces `can()` allows; API enforces same IDs.
5. Demote/revoke: clear staff grants and/or set role to customer; next request rehydrates live role/status from DB (no stale JWT privilege).

## Edge cases (PH-021b)

| Case | Behaviour |
|------|-----------|
| Self-demotion / self-deactivate | **403 ACCESS_DENIED** — cannot strip own panel access |
| Last active `admin` demoted or deactivated | **409 CONFLICT** — create another admin first |
| Empty admin capability matrix save | Server stores **full catalogue** (admin remains superuser in enforcement) |
| Mid-session staff grant revoke | Next API call `HasPermission` fails → **403**; FE nav updates after matrix reload / session refresh |
| Staff with only `*:read` | Can list; **cannot** mutate (PH-021a write groups) |

## Related

- [authentication.md](../authentication.md)  
- FE `docs/platform/rbac.md`  
- Obsidian RBAC  

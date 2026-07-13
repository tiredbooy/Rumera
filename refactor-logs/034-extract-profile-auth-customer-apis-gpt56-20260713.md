# Task 034: Extract Profile, Auth, And Customer APIs

**Status:** Complete
**Date:** 2026-07-13

## What changed

- Extracted profile requests and React Query hooks into `features/profile`.
- Added separate auth browser/server transports under `features/auth/api`.
- Kept NextAuth login, OTP verification, token rotation, JWT/session projection,
  and refresh-failure behavior intact while removing inline backend fetches.
- Moved customer contracts and transports to top-level `features/customers` while
  retaining admin UI components under `features/admin/customers`.
- Removed central duplicate/dead profile and customer ownership.

## Files touched

- `apps/frontend/features/profile/api.ts`
- `apps/frontend/features/profile/hooks.ts`
- `apps/frontend/features/account/settings/components/settings-view.tsx`
- `apps/frontend/features/auth/types.ts`
- `apps/frontend/features/auth/api.ts` (removed)
- `apps/frontend/features/auth/hooks.ts` (removed)
- `apps/frontend/features/auth/api/client.ts`
- `apps/frontend/features/auth/api/server.ts`
- `apps/frontend/components/auth/register-form.tsx`
- `apps/frontend/components/auth/phone-login-form.tsx`
- `apps/frontend/components/auth/forgot-password-form.tsx`
- `apps/frontend/components/auth/reset-password-form.tsx`
- `apps/frontend/lib/auth/auth.ts`
- `apps/frontend/features/customers/types.ts`
- `apps/frontend/features/customers/api.ts`
- `apps/frontend/features/customers/client.ts`
- `apps/frontend/features/admin/customers/api.ts` (removed)
- `apps/frontend/features/admin/customers/client.ts` (removed)
- `apps/frontend/features/admin/customers/types.ts` (removed)
- `apps/frontend/features/admin/customers/components/UserEditForm.tsx`
- `apps/frontend/app/admin/customers/page.tsx`
- `apps/frontend/app/admin/customers/[id]/page.tsx`
- `apps/frontend/app/admin/customers/[id]/edit/page.tsx`
- `apps/frontend/lib/api/account-hooks.ts`
- `apps/frontend/lib/api/admin-hooks.ts`
- `apps/frontend/lib/api/query-keys.ts`
- `apps/frontend/lib/api/endpoints.ts`
- `refactor-workstreams/gpt56-domain-refactor-20260713/TASKS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/IN_PROGRESS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/IN_PROGRESS_TASK_034_GPT56.md` (removed)
- `refactor-workstreams/gpt56-domain-refactor-20260713/FINISHED.md`
- `refactor-logs/034-extract-profile-auth-customer-apis-gpt56-20260713.md`

## Verification

- Scoped ESLint: zero warnings or errors.
- No old admin-customer API/type imports remain.
- No central profile/customer hooks or keys remain.
- Auth forms contain no direct public-auth fetches.
- Auth server transport imports neither `apiFetch` nor `auth.ts`.
- `lib/auth/auth.ts` contains no direct fetches or API-client dependency.
- Full TypeScript has no Task 034 errors.
- `git diff --check` passed.

## Residual baseline

- Customer detail/sample sections and `status-badge` still reference the deleted
  `lib/admin/data` catch-all. Task 034 intentionally does not recreate it; later
  sample-data and admin cleanup tasks own those failures.

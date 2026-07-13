# Task Group 036: Content And Settings APIs

**Status:** Complete
**Date:** 2026-07-13

## Domains

- Recipes: cached public/server reads, admin browser writes, utilities/contracts.
- Journal: cached public reads and journal-owned utilities/contracts.
- Hero slides: cached public fallback reads and typed admin browser writes.
- Site settings: anonymous public read, authenticated admin read/update.

## Files touched

- `apps/frontend/features/recipes/**`
- `apps/frontend/features/admin/recipes/**`
- `apps/frontend/features/journal/**`
- `apps/frontend/features/hero-slides/**`
- `apps/frontend/features/admin/hero-slides/**`
- `apps/frontend/features/settings/**`
- `apps/frontend/features/admin/settings/**`
- `apps/frontend/features/home/components/hero-carousel.tsx`
- `apps/frontend/app/(storefront)/page.tsx`
- `apps/frontend/app/(storefront)/recipes/**`
- `apps/frontend/app/(storefront)/journal/**`
- `apps/frontend/app/admin/recipes/**`
- `apps/frontend/app/admin/settings/page.tsx`
- `apps/frontend/app/sitemap.ts`
- `apps/frontend/app/llms.txt/route.ts`
- `apps/frontend/lib/recipes.ts` (removed)
- `apps/frontend/lib/journal.ts` (removed)
- `apps/frontend/lib/home/hero.ts` (removed)
- `apps/frontend/lib/api/admin-hooks.ts` (removed)
- `apps/frontend/lib/api/endpoints.ts`
- `refactor-workstreams/gpt56-domain-refactor-20260713/TASKS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/IN_PROGRESS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/FINISHED.md`
- `refactor-logs/036-content-settings-apis-gpt56-20260713.md`

## Verification

- Frontend lint: zero errors, 14 existing warnings.
- TypeScript: passed.
- Backend tests: passed.
- No raw domain fetches or stale legacy imports.
- Public settings transport is anonymous.
- `git diff --check`: passed.

## Retained behavior

- Recipe/hero nullable fields still cannot be cleared because their existing Go
  update repositories treat JSON null like omission.
- Journal sitemap discovery remains capped at 100 posts because no dedicated
  backend journal sitemap endpoint exists.
- Public settings are extracted but not wired into shared storefront composition;
  that requires a separate caching/rendering decision.

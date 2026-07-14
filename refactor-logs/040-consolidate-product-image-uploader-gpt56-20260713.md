# Task 040: Consolidate The Product Image Uploader

**Status:** Complete
**Date:** 2026-07-13

## What changed

- Consolidated three implementations around the modular uploader.
- Preserved canonical `ProductImage` and the correct XHR upload signature/path.
- Made flush and edit mutations durable and failure-aware.
- Restored semantic form composition and improved preview/accessibility behavior.
- Deleted both dead monoliths and unused image-list wrappers.

## Files touched

- `apps/frontend/features/image-uploader/types.ts`
- `apps/frontend/features/image-uploader/use-image-uploader.ts`
- `apps/frontend/features/image-uploader/ImageUploader.tsx`
- `apps/frontend/features/image-uploader/ImageDropzone.tsx`
- `apps/frontend/features/image-uploader/ImageSlotItem.tsx`
- `apps/frontend/features/image-uploader/UploadProgressBar.tsx`
- `apps/frontend/features/admin/products/components/ProductForm.tsx`
- `apps/frontend/features/admin/products/components/product-form/ImagesSection.tsx`
- `apps/frontend/features/admin/products/components/product-form/sidebar/FormHeaderBar.tsx`
- `apps/frontend/features/admin/products/actions/images.ts`
- `apps/frontend/features/admin/products/api/server.ts`
- `apps/frontend/components/admin/image-uploader.tsx` (removed)
- `apps/frontend/features/admin/products/components/ImageUploader.tsx` (removed)
- `refactor-workstreams/gpt56-domain-refactor-20260713/TASKS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/IN_PROGRESS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/FINISHED.md`
- `refactor-logs/040-consolidate-product-image-uploader-gpt56-20260713.md`

## Verification

- Typecheck: passed.
- Lint: zero errors, 14 existing warnings.
- Tests: passed with no test files.
- Production build: passed.
- Duplicate/stale import searches: passed.
- `git diff --check`: passed.

## Residual risks

- The project has no uploader interaction tests, so concurrency and rollback paths
  are currently covered by static review and full build gates rather than automated
  browser/component tests.
- Backend product update, cache invalidation, and multi-phase persistence concerns
  remain separate from uploader consolidation.

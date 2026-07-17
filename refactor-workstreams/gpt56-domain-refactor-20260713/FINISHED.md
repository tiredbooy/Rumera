# Finished Refactor Tasks

**Workstream ID:** `gpt56-domain-refactor-20260713`
**Owner:** `gpt-5.6-sol`

Completed tasks are appended here only after verification. This history is
append-only.

## Task 000 - Initialize Collision-Safe Workstream

**Status:** Complete
**Date:** 2026-07-13

### What Changed

- Created a unique workstream namespace for concurrent-agent safety.
- Created separate ordered backlog, single-active-task, and completed-history
  files.
- Defined planning principles and per-task verification gates from
  `REFACTOR_AGENT_INSTRUCTIONS.md` plus the requested backend-to-frontend type
  parity and UI/UX quality requirements.
- Activated Task 001 as the only in-progress task.

### Files Touched

- `refactor-workstreams/gpt56-domain-refactor-20260713/TASKS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/IN_PROGRESS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/FINISHED.md`

### Notes / Follow-Ups

- The backlog intentionally contains only the audit task until repository facts
  can be collected; speculative migration tasks would violate the no-guessing
  rule.

## Task 001 - Audit Architecture, Domain Ownership, UI/UX, And Type Parity

**Status:** Complete
**Date:** 2026-07-13

### What Changed

- Audited the frontend routes, feature domains, top-level components, API clients,
  hooks, validations, and TypeScript declarations.
- Audited Go routes, HTTP DTOs, persistent models, mappers, handlers, response
  envelopes, enums, nullability, pagination, and serialization behavior.
- Compared frontend declarations with actual backend wire contracts and recorded
  confirmed mismatches and backend blockers.
- Audited accessibility, responsive behavior, async state feedback, error/empty
  handling, interaction semantics, and UI ownership risks.
- Added `AUDIT.md` and replaced the placeholder backlog with dependency-ordered
  structural, contract, logic, UI, UX, and verification tasks.
- Established a baseline stabilization gate because the repository already fails
  TypeScript compilation before application edits begin.

### Files Touched

- `refactor-workstreams/gpt56-domain-refactor-20260713/AUDIT.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/TASKS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/IN_PROGRESS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/FINISHED.md`

### Verification

- Ran `npm exec tsc -- --noEmit` in `apps/frontend` and captured the existing
  unresolved-module/type-error baseline.
- Cross-checked frontend contracts against Go JSON tags, handlers, mappers, and
  response helpers rather than copying database structs.
- Confirmed through Git history that commit `9139498` deleted the still-imported
  `lib/catalog/*` modules.

### Notes / Follow-Ups

- Full build verification is blocked by pre-existing compile failures. Tasks
  002-039 progressively remove those failures without recreating a central
  catch-all module.
- Backend defects are documented separately from frontend type parity so the
  frontend does not legitimize broken or impossible contracts.

## Task 002 - Repair The Checkout Route Import

**Status:** Complete
**Date:** 2026-07-13

### What Changed

- Updated the checkout route to import `CheckoutFlow` from its existing checkout
  feature owner instead of the deleted top-level component path.
- Preserved all route markup, props, styles, and behavior.

### Files Touched

- `apps/frontend/app/(storefront)/checkout/page.tsx`
- `refactor-workstreams/gpt56-domain-refactor-20260713/TASKS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/IN_PROGRESS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/FINISHED.md`
- `refactor-logs/002-repair-checkout-route-import-gpt56-20260713.md`

### Verification

- Scoped ESLint passed for the checkout page and checkout flow.
- Search confirmed zero references to
  `@/components/checkout/checkout-flow`.
- Full TypeScript validation was rerun. The checkout route's unresolved import
  error is gone; the remaining failures are the pre-existing baseline recorded
  in `AUDIT.md`.

### Notes / Follow-Ups

- Task 003 is the next unblocked task.

## Task 003 - Repair Account Order-Detail Imports

**Status:** Complete
**Date:** 2026-07-13

### What Changed

- Updated the account order-detail route to import `OrderDetail` from its existing
  account orders feature.
- Updated `OrderDetail` to import the shared `AccountSection` component from the
  account presentation feature.
- Preserved all props, rendering, styles, API calls, state, and behavior.

### Files Touched

- `apps/frontend/app/(account)/account/orders/[id]/page.tsx`
- `apps/frontend/features/account/orders/components/OrderDetail.tsx`
- `refactor-workstreams/gpt56-domain-refactor-20260713/TASKS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/IN_PROGRESS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/FINISHED.md`
- `refactor-logs/003-repair-account-order-detail-imports-gpt56-20260713.md`

### Verification

- Scoped ESLint passed for the route, `OrderDetail`, and `AccountSection`.
- Search confirmed zero references to the stale route and relative component
  imports.
- Full TypeScript validation was rerun. Both Task 003 unresolved-module errors
  are gone; remaining failures are pre-existing and documented in `AUDIT.md`.

### Notes / Follow-Ups

- Task 004 is the next unblocked task.

## Task 004 - Repair The Admin Category-Table Import

**Status:** Complete
**Date:** 2026-07-13

### What Changed

- Updated the admin categories route to import `CategoriesTable` from the actual
  `CategoryTable.tsx` module with filesystem-correct casing.
- Preserved the export, props, permission checks, rendering, styles, state, and
  behavior.

### Files Touched

- `apps/frontend/app/admin/categories/page.tsx`
- `refactor-workstreams/gpt56-domain-refactor-20260713/TASKS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/IN_PROGRESS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/FINISHED.md`
- `refactor-logs/004-repair-admin-category-table-import-gpt56-20260713.md`

### Verification

- Scoped ESLint passed for the route and category table component.
- Search confirmed zero references to the stale lowercase/hyphenated path.
- Full TypeScript validation was rerun. The Task 004 module error is gone;
  remaining failures are pre-existing and documented in `AUDIT.md`.

### Notes / Follow-Ups

- Task 005 is the next unblocked task.

## Task 005 - Correct Rewards Domain Ownership

**Status:** Complete
**Date:** 2026-07-13

### What Changed

- Confirmed `RewardsView` is a loyalty-domain component from its hooks, API
  routes, backend service, and absence of journal behavior.
- Moved the component from `features/journal/components` to
  `features/loyalty/components`.
- Updated the account rewards route to import from the verified owner.
- Added no compatibility shim and preserved rendering, hooks, state, styles, and
  behavior.

### Files Touched

- `apps/frontend/app/(account)/account/rewards/page.tsx`
- `apps/frontend/features/loyalty/components/rewards-view.tsx`
- `apps/frontend/features/journal/components/rewards-view.tsx` (moved)
- `refactor-workstreams/gpt56-domain-refactor-20260713/TASKS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/IN_PROGRESS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/FINISHED.md`
- `refactor-logs/005-correct-rewards-domain-ownership-gpt56-20260713.md`

### Verification

- Scoped ESLint passed for the rewards route and moved component.
- Search confirmed zero references to the old journal path and stale top-level
  loyalty path.
- Full TypeScript validation was rerun. The rewards route module error is gone;
  remaining failures are pre-existing and documented in `AUDIT.md`.

### Notes / Follow-Ups

- Task 006 is the next unblocked task.
- Loyalty hooks/types remain in the central API module until Tasks 022a and 035c;
  this task corrected only component ownership.

## Task 006 - Replace Missing `serverApi` With Canonical `apiFetch`

**Status:** Complete
**Date:** 2026-07-13

### What Changed

- Verified through Git history that `serverApi(path)` delegated to `apiFetch`
  after obtaining the session access token.
- Replaced all 29 imports/calls across 13 route files with canonical `apiFetch`.
- Preserved generic types, endpoint paths, `ApiError` handling, permissions,
  response unwrapping, cache behavior, rendering, and route behavior.
- Added no compatibility alias.

### Files Touched

- `apps/frontend/app/admin/categories/new/page.tsx`
- `apps/frontend/app/admin/categories/[id]/page.tsx`
- `apps/frontend/app/admin/brands/[id]/page.tsx`
- `apps/frontend/app/admin/settings/page.tsx`
- `apps/frontend/app/admin/recipes/new/page.tsx`
- `apps/frontend/app/admin/recipes/[id]/page.tsx`
- `apps/frontend/app/admin/products/new/page.tsx`
- `apps/frontend/app/admin/products/[id]/page.tsx`
- `apps/frontend/app/admin/orders/[id]/page.tsx`
- `apps/frontend/app/admin/customers/page.tsx`
- `apps/frontend/app/admin/customers/[id]/page.tsx`
- `apps/frontend/app/admin/customers/[id]/edit/page.tsx`
- `apps/frontend/app/(storefront)/checkout/confirmation/[id]/page.tsx`
- Workstream trackers and Task 006 log.

### Verification

- Scoped ESLint passed for all 13 routes and `lib/api/client.ts`.
- Search confirmed zero TypeScript references to `serverApi`.
- Full TypeScript validation was rerun. All `serverApi` missing-export errors are
  gone; remaining failures are pre-existing and documented in `AUDIT.md`.

### Notes / Follow-Ups

- Task 007 is the next unblocked task.

## Task 007 - Define Generic API Envelope And Pagination Types

**Status:** Complete
**Date:** 2026-07-13

### What Changed

- Added canonical `ApiSuccess<T>`, `ApiErrorEnvelope`, `ApiErrorBody`,
  `ApiFieldErrors`, `Pagination`, `Paginated<T>`, `PaginationQuery`, and API query
  value/params types derived from Go `pkg/response`.
- Updated server and browser transport clients to consume the canonical success
  and error envelope types without changing runtime behavior.
- Updated the shared query serializer to consume the canonical query-value type.
- Removed the incorrect admin order pagination declaration and the duplicate
  journal pagination declaration.
- Migrated active generic pagination consumers away from deleted
  `lib/catalog/types` while leaving business-domain types untouched.
- Did not edit the disabled `admin-client.txt` source.

### Files Touched

- `apps/frontend/lib/api/types.ts`
- `apps/frontend/lib/api/client.ts`
- `apps/frontend/lib/api/store-client.ts`
- `apps/frontend/lib/api/qs.ts`
- `apps/frontend/lib/journal.ts`
- `apps/frontend/lib/recipes.ts`
- `apps/frontend/lib/api/hooks.ts`
- `apps/frontend/lib/api/account-hooks.ts`
- `apps/frontend/components/admin/variant-picker.tsx`
- `apps/frontend/features/admin/orders/api.ts`
- Admin recipe create/edit, product create/edit, and customer-list routes.
- Workstream trackers and Task 007 log.

### Verification

- Scoped ESLint passed for all touched TypeScript files.
- Search confirmed `lib/api/types.ts` is the only active API pagination
  declaration.
- Search confirmed zero active `Paginated` imports from deleted catalog types.
- Full TypeScript validation was rerun. Pagination-related downstream errors were
  removed; remaining failures are pre-existing and documented in `AUDIT.md`.

### Notes / Follow-Ups

- Task 008 begins backend-derived product response parity.
- Domain-specific inline success envelopes can migrate to `ApiSuccess<T>` during
  their domain API extraction tasks; this task avoided broad domain churn.

## Task 008 - Products Contract Parity

**Status:** Complete
**Date:** 2026-07-13

### What Changed

- Derived frontend product response types from Go `product_response.go`, product
  mappers, repository projections, and handler response construction.
- Renamed nested transport-oriented types to `ProductImage`, `ProductVariant`,
  `ProductOptionValue`, and `ProductTag`.
- Corrected Go `omitempty` pointer fields to optional non-null TypeScript fields.
- Kept `ProductListItem.image_response` required and nullable because the backend
  always serializes the key and may have no image.
- Kept list `brand`/`category` as joined title strings rather than inventing
  summary objects.
- Kept `MeiliProduct` separate and modeled its non-omitempty nullable fields.
- Corrected public/admin product list APIs to `Paginated<ProductListItem>`.
- Removed admin re-exports of canonical response entities and moved direct
  consumers to the catalog product domain.
- Migrated product-only imports away from deleted catalog types and fixed the
  undefined uploader `ProductImage` reference without changing upload behavior.

### Files Touched

- Canonical catalog product types/API/components.
- Admin product types, API, actions, form, table, and image uploader.
- Shared image-uploader type/hook files and admin variant picker.
- Product JSON-LD and journal embedded-product typing.
- Admin product edit route.
- Workstream trackers and Task 008 log.

### Verification

- Scoped ESLint passed for all Task 008 files.
- Search confirmed only the canonical product types file declares product
  response entities.
- Old nested `*Response` names have zero active product references; remaining
  `ImageResponse` references belong to `next/og`.
- Product response fields were checked against Go JSON tags, `omitempty`, mapper
  output, and list repository nullability.
- Full TypeScript validation was rerun. The undefined `ProductImage` and stale
  product-type import errors in migrated consumers were removed; no new
  task-related failures appeared.

### Notes / Follow-Ups

- Product request/filter contracts intentionally remain for Task 009.
- Missing `lib/catalog/products` helper imports remain for Task 027a rather than
  adding a compatibility module.
- The uploader function signature mismatch remains isolated for Task 040.
- Optional product slugs are now accurately typed; storefront URL policy and
  invalid-slug handling belong to product API/storefront tasks.

## Task 009 - Product Request And Filter Parity

**Status:** Complete
**Date:** 2026-07-13

### What Changed

- Derived product, variant, tag-assignment, image, and list-query inputs from Go
  request models, handler-local request structs, routes, and multipart parsing.
- Replaced Go-specific `*Req` names with clear `CreateProductInput`,
  `UpdateProductInput`, `CreateProductVariantInput`, and
  `UpdateProductVariantInput` contracts.
- Added canonical product tag IDs, variant option IDs, image reorder, image alt,
  and product list query contracts.
- Moved shared public/admin product query types into the catalog product domain,
  removing the remaining catalog-to-admin type dependency.
- Corrected variant create payloads to `option_value_ids`, preserved hydrated IDs
  in form defaults, and used the backend's separate update-variant shape.
- Corrected attach-options and product-tag operations to `204` contracts and
  snake_case IDs.
- Corrected image upload field/path, reorder `{ ids }`, alt-only updates, and
  multipart content-type handling.
- Switched the mounted uploader to its browser/XHR client, restoring progress
  callback compatibility without changing its UI.
- Tightened variant price validation to match the backend's required nonzero
  price while preserving the existing message.

### Verification

- Scoped ESLint completed with zero errors. It reports one existing React
  Compiler warning because React Hook Form's `watch()` cannot be memoized.
- Search confirmed zero active `CreateProductReq`, `UpdateProductReq`,
  `CreateVariantReq`, or `ProductFilter` references.
- Search confirmed obsolete `image_ids`, `orders`, camelCase `tagIds`, upload
  `image` field, and short BFF upload path patterns are gone from product writes.
- Full TypeScript validation was rerun. Mounted uploader signature/type errors
  were removed; no new task-related failures appeared.

### Notes / Follow-Ups

- The product form carries existing option IDs but intentionally adds no option
  selector because option-type/value CRUD and lookup UX are not currently
  available.
- Product submission remains multi-step and non-transactional; changing that
  behavior requires a separate backend/product workflow decision.
- Duplicate uploader consolidation remains Task 040.

## Task 010 - Categories Contract Parity

**Status:** Complete
**Date:** 2026-07-13

### What Changed

- Derived category response, tree, product-summary, mutation-input, and list-query
  contracts from the Go models, handlers, tree builder, repository, and database
  constraints.
- Replaced transport-oriented `CategoryResponse` names with the canonical
  `Category`, `CategoryTree`, and `ProductCategory` business projections.
- Corrected `omitempty` response pointers to optional non-null properties and
  kept the non-omitempty product-category slug required and nullable.
- Removed invented admin timestamps and duplicate top-level/admin category type
  files.
- Migrated category consumers to the domain contract and replaced the nonexistent
  `name` field with the backend's `title` field in storefront and admin trees.
- Corrected category list pagination and raw success-envelope declarations while
  preserving the existing fetch behavior for the later API extraction task.

### Verification

- Scoped ESLint completed with zero errors. It reports three existing warnings:
  two in `CategoryForm` and one in `ProductForm` around React Hook Form `watch()`
  and the existing category slug-effect dependency.
- Search confirmed zero active `CategoryResponse`, `AdminCategoryResponse`,
  `ProductCategoryResponse`, `CreateCategoryReq`, `UpdateCategoryReq`,
  `CategoryFilter`, or `CategoryTreeNode` references outside the separate blog
  category domain.
- Search confirmed zero active category imports from deleted
  `lib/catalog/types` and zero references to the removed top-level category type.
- `git diff --check` passed.
- Full TypeScript validation was rerun. It still fails on the documented missing
  `lib/catalog/*` modules and disabled `admin-client`; no new category-contract
  failures appeared.

### Notes / Follow-Ups

- Category helper migration remains Task 027b, category API extraction remains
  Task 029, and the disabled admin client is retired only after Task 038.
- The existing `CategoryForm` slug-effect dependency warning was not changed
  because correcting its behavior is outside this contract-only task.
- The Go category models required no changes; they were the source of truth.

## Task 012 - Tags Contract Parity

**Status:** Complete
**Date:** 2026-07-13

### What Changed

- Derived the full tag, mutation input, list-query, and reduced product-tag
  projections from Go JSON tags, handlers, product mappers, repository behavior,
  routes, and response envelopes.
- Removed the nonexistent tag `slug`, preserved `created_at` and `updated_at`, and
  corrected optional `description` response semantics.
- Moved the reduced `{ id, title }` product projection into the tag domain and
  made product responses import it instead of declaring a parallel type.
- Replaced every local `AdminTag` declaration in product and recipe routes/forms
  with the canonical full `Tag`.
- Corrected public tag-list typing to `Paginated<Tag>` and updated its active
  consumer to read `results`.

### Verification

- Scoped ESLint completed with zero errors and two existing React Compiler
  warnings from React Hook Form `watch()` usage.
- Search confirmed zero active `AdminTag`, `TagListParams`, tag `slug`, camelCase
  tag timestamp, or duplicate product-tag declarations.
- `git diff --check` passed.
- Full TypeScript validation was rerun. It still fails on the documented missing
  `lib/catalog/*` modules and disabled `admin-client`; no new tag-contract
  failures appeared.

### Notes / Follow-Ups

- Task 030b still owns tag API extraction and final admin route verification.
- The database migration defines a required `tags.slug`, while the current Go
  tag model, requests, repository writes, and HTTP JSON contract omit it. This is
  a backend schema/model blocker and was not legitimized in frontend types.
- Task 011 remains assigned to another agent by the user.

## Task 013 - Orders Contract Parity

**Status:** Complete
**Date:** 2026-07-13

### What Changed

- Derived the canonical order status, payment method, item, detail, list,
  mutation-input, and list-query contracts from Go DTOs, handlers, mappers,
  repositories, routes, and response envelopes.
- Preserved all 13 backend order statuses and all five payment methods.
- Replaced camelCase transport claims with exact snake_case wire fields and
  corrected `omitempty` response properties to optional non-null values.
- Removed duplicate admin and legacy order type modules containing invented user,
  address, request-item, timestamp, and amount fields.
- Updated account/admin order APIs to use canonical types and nested
  `Paginated<OrderListItem>` responses.
- Removed the admin API's abbreviated inline order declarations and corrected the
  recent-orders query to the backend's `sortBy`/`orderBy` parameters.

### Verification

- Scoped ESLint passed with zero errors and zero warnings.
- Search confirmed `features/orders/types.ts` is the only active declaration
  owner for `Order`, `OrderItem`, `OrderListItem`, `OrderStatus`, and
  `PaymentMethod`.
- Search confirmed zero active stale `OrderResponse`, `OrderItemResponse`,
  `CreateOrderRequest`, `UpdateOrderStatusRequest`, `OrderFilter`,
  `ListOrdersParams`, camelCase wire fields, `sort_by`, or `order_by` declarations.
- `git diff --check` passed.
- Full TypeScript validation was rerun. It still fails on the documented deleted
  `lib/catalog/*` modules and disabled `admin-client`; no new order-contract
  failures appeared.

### Notes / Follow-Ups

- Task 027c owns migration of remaining consumers from deleted order catalog
  imports and order labels; Task 031 owns the account/admin API split.
- `item_count` remains required by the wire contract but is currently always
  mapped as zero by the backend list/status handlers.
- The Go order DTOs required no changes; they were the source of truth.
- Task 011 remains concurrently owned through its dedicated claim file.

## Task 011 - Brands Contract Parity

**Status:** Complete
**Date:** 2026-07-13

### What Changed

- Derived the canonical Brand entity, create/update inputs, and list query from
  Go JSON tags, handlers, repository filters, and response envelopes.
- Corrected response pointer fields with `omitempty` to optional non-null
  TypeScript fields while keeping nullable create/update wire inputs explicit.
- Added typed Brand sort fields/directions and corrected public list responses to
  `Paginated<Brand>`.
- Removed duplicate `BrandResponse`, admin `*Req`, and `BrandFilter` declarations;
  the catalog Brand domain is now the single type owner.
- Added a Brand-scoped browser BFF client for list/create/update/delete operations
  that preserves backend field validation errors.
- Migrated the Brand form, table, edit route, and product lookup consumers away
  from deleted `lib/catalog/types` and disabled `admin-client` imports.
- Corrected the combined product loader from `.items` to the actual `.results`
  pagination field without changing category or tag behavior.

### Verification

- Scoped ESLint completed with zero errors and one existing React Compiler
  warning for React Hook Form's `watch()` API in `BrandForm`.
- Search confirmed zero active `BrandResponse`, `CreateBrandReq`,
  `UpdateBrandReq`, or `BrandFilter` references.
- Search confirmed zero Brand imports from deleted catalog types and zero Brand
  component imports from the disabled global admin client.
- Full TypeScript validation was rerun. It still fails on documented unrelated
  deleted catalog/admin modules; no Brand-specific failures remain.
- `git diff --check` passed before archival.

### Notes / Follow-Ups

- The current Go `UpdateBrandReq` pointer model cannot distinguish an omitted
  field from JSON null, so existing optional values cannot be cleared. The
  frontend type documents this backend limitation rather than hiding it.
- Brand image validation intentionally remains absolute-URL-only because the Go
  validator requires `url`; relative media URL support needs a coordinated
  backend/form decision.
- Final public/admin Brand API organization remains Task 030a.

## Task 014 - Addresses Contract Parity

**Status:** Complete
**Date:** 2026-07-13

### What Changed

- Derived canonical `Address`, `CreateAddressInput`, and `UpdateAddressInput`
  contracts from Go request/response DTOs, handlers, repository update behavior,
  routes, and response envelopes.
- Created `features/addresses/types.ts` as the single live-address owner and
  removed the empty account-local type placeholder.
- Corrected `omitempty` response pointers to optional non-null properties while
  preserving nullable create/update wire inputs.
- Migrated central hooks, account management, checkout creation/selection, and
  subscriptions away from deleted catalog address types.
- Typed address success envelopes with `ApiSuccess<T>`.
- Corrected set-default to `Promise<void>` for its backend `204` response; delete
  already matched `204`.
- Removed the account order detail's unsupported `shipping_address` assertion and
  dead UI because the canonical backend Order response has no such field.
- Preserved address form layout, validation, submission timing, cache keys,
  invalidation, and user interactions.

### Verification

- Scoped ESLint completed with zero errors and one unrelated existing
  subscriptions `useMemo` dependency warning.
- Search confirmed zero active `AddressInput`, live Address imports from deleted
  catalog types, or unsupported `shipping_address` assertions.
- Create/update/default/delete payloads and statuses were checked against Go
  models, handlers, routes, and repository behavior.
- Full TypeScript validation was rerun. Address-related missing imports and
  contract errors were removed; no new Task 014 failures appeared.
- `git diff --check` passed.

### Notes / Follow-Ups

- Go pointer updates cannot distinguish JSON null from omission, so nullable
  address values cannot currently be cleared through PATCH.
- Account creation currently sends country `"ایران"`, while checkout sends
  `"IR"`; the backend accepts any required string. Standardizing this is an
  explicit later form/checkout UX decision, not a type-contract guess.
- Checkout still hardcodes newly created addresses as default. Task 050 owns that
  state/behavior correction.
- The backend does not expose an order address snapshot in `Order`; restoring
  historical delivery display requires a real backend response field first.

## Task 015 - Cart Contract Parity

**Status:** Complete
**Date:** 2026-07-13

### What Changed

- Derived canonical cart, item, summary, add/update input, bulk-add input, skipped
  item, and bulk-add result contracts from Go DTOs, handlers, services,
  repositories, routes, and response envelopes.
- Added the exact cart summary fields and typed bulk-add skip reasons as
  `invalid`, `not_found`, or `unavailable`.
- Reused the canonical product option projection for hydrated cart item options.
- Moved all cart declarations out of the central hook file into
  `features/cart/types.ts` and typed every cart mutation with its domain input.
- Kept `unit_price_snapshot` out of frontend contracts and mutation inputs;
  checkout derives the same snapshotted unit display from `line_total / quantity`.
- Preserved mutation behavior and cache updates, including the `204` clear-cart
  contract.

### Verification

- Scoped ESLint passed with zero errors and zero warnings.
- Search confirmed `features/cart/types.ts` is the only active owner of cart,
  summary, skipped-item, and bulk-result declarations.
- Search confirmed zero frontend `unit_price_snapshot`, stale `BulkAddResult`, or
  inline skipped-reason declarations.
- `git diff --check` passed.
- Full TypeScript validation was rerun. It still fails on the documented deleted
  catalog/admin modules; no new cart-contract failures appeared.

### Notes / Follow-Ups

- Task 027e owns remaining cart catalog import migration and Task 032b owns cart
  API/hook extraction.
- The backend still serializes and documents `unit_price_snapshot` even though it
  is server-managed. The frontend intentionally ignores that leaked field.
- `discount_total` is required in the response but the current cart service leaves
  it at zero.
- Task 014 remains active and independently owns address declarations and hooks.

## Task 017 - Coupon Contract Parity

**Status:** Complete
**Date:** 2026-07-13

### What Changed

- Derived canonical `Coupon`, applicability, create/update input, validation
  input, and list-query contracts from Go DTOs, handlers, mappers, repository
  filters, routes, and response envelopes.
- Corrected admin response `omitempty` pointer fields to optional non-null
  properties and preserved nullable write inputs.
- Added typed coupon sort fields and all three backend discount variants.
- Removed the duplicate orphan admin coupon type file.
- Modeled validation as a valid/invalid discriminated union with `coupon: null`
  for invalid results.
- Added the explicit `LegacyCouponValidationCoupon` PascalCase shape produced by
  embedding the untagged Go persistence model.
- Migrated the checkout hook to `ValidateCouponInput` and `ApiSuccess<T>` and
  updated checkout to consume the actual legacy `Code` property.
- Preserved checkout interaction and calculation behavior for its dedicated
  later logic task.

### Verification

- Scoped ESLint passed with zero errors and zero warnings.
- Search confirmed zero active `CouponResponse`, `CreateCouponReq`,
  `UpdateCouponReq`, `ValidateCouponReq`, `CouponValidationResult`, or
  `CouponFilter` declarations/references.
- Search confirmed checkout no longer imports coupon types from deleted catalog
  modules or assumes nested lowercase `coupon.code`.
- Validation nullability and casing were checked against Go's actual
  `encoding/json` behavior and invalid-result construction.
- Full TypeScript validation was rerun. No Coupon-specific failures remain.
- `git diff --check` passed.

### Notes / Follow-Ups

- The PascalCase embedded validation coupon is a backend serialization defect.
  Frontend types expose it explicitly instead of normalizing it into a false
  canonical contract.
- Go pointer PATCH fields cannot distinguish null from omission, so optional
  coupon values cannot currently be cleared through update.
- Checkout can retain stale validation after code/cart changes and does not gate
  free shipping with `is_valid`; Task 050 owns those behavior corrections.
- Admin coupon routes exist in Go, but frontend admin pages/components do not;
  API extraction and UI construction require separate scoped tasks.

## Task 016 - Shipping Contract Parity

**Status:** Complete
**Date:** 2026-07-13

### What Changed

- Derived canonical shipping rate, method, zone, create/update input, list-query,
  and checkout-query contracts from Go DTOs, handlers, services, repositories,
  routes, and response envelopes.
- Added `features/shipping/types.ts` as the single shipping type owner with exact
  snake_case wire keys and response optionality.
- Preserved nullable admin pointer inputs separately from optional non-null
  response fields and modeled create-method `base_rate` as optional because the
  Go request accepts its zero default.
- Removed the duplicate admin shipping response/request/filter type module.
- Migrated central shipping hooks and checkout away from deleted catalog shipping
  declarations without changing request or rendering behavior.
- Kept required `estimated_cost` on every shipping method response.

### Verification

- Scoped ESLint passed with zero errors and zero warnings.
- Search confirmed `features/shipping/types.ts` is the only active owner of
  shipping method, zone, and rate declarations.
- Search confirmed zero stale admin `*Response`, `*Req`, or `*Filter` shipping
  declarations and zero shipping imports from deleted catalog types.
- `git diff --check` passed.
- Full TypeScript validation was rerun. It still fails on the documented deleted
  catalog/admin modules; no new shipping-contract failures appeared.

### Notes / Follow-Ups

- `estimated_cost` is required by the response contract but the current mapper
  never assigns it, including for the available-checkout endpoint, so it is always
  zero despite the API documentation claiming calculation.
- Single-zone documentation claims nested methods are populated, but the current
  handler mapper does not attach them; the optional field remains truthful.
- Task 032c owns shipping API/hook extraction.
- Task 018 remains active and explicitly excludes shipping-owned files.

## Task 018 - Reviews Contract Parity

**Status:** Complete
**Date:** 2026-07-13

### What Changed

- Derived canonical review status/rating, review image, public/admin review,
  rating summary, create/update/moderation/reaction/image inputs, and list-query
  contracts from Go DTOs, handlers, mappers, repositories, routes, and envelopes.
- Added `features/reviews/types.ts` as the single valid review-contract owner and
  removed the duplicate admin review type file.
- Correctly modeled review images as required nullable on review responses because
  the non-omitempty Go slice can serialize as null.
- Modeled rating-distribution JSON keys as `"1"` through `"5"`.
- Added server review APIs for public list/summary/detail/images and admin
  list/moderation, preserving the former public fetchers' error-safe fallbacks.
- Migrated the product review Server Action, product review component, and product
  detail page away from deleted `lib/catalog/reviews`.
- Typed reaction and create payloads and the create success envelope.
- Corrected the write-review UI to require the title because the backend validates
  it as required.

### Verification

- Scoped ESLint passed with zero errors and zero warnings.
- Search confirmed zero active deleted review-module imports or stale
  `ReviewResponse`, `ReviewAdminResponse`, `CreateReviewReq`, `UpdateReviewReq`,
  `UpdateReviewStatusReq`, `ReviewImageReq`, or `ReviewFilter` declarations.
- Search confirmed canonical Review entities and rating summaries have one owner.
- Full TypeScript validation was rerun. Review-section/action/API failures were
  removed; remaining failures are unrelated unfinished domains.
- `git diff --check` passed.
- Task 016 completed before the shared product-page review import changed; no
  shipping code or shipping-owned file was modified by Task 018.

### Notes / Follow-Ups

- The frontend's `/reviews/mine` and `/reviews/pending` account hooks have no
  corresponding backend routes. They were not legitimized as canonical backend
  types; Task 033a must replace or remove that unsupported flow.
- The admin review queue still uses missing static mock data and toast-only
  moderation. Task 049/033a must connect it to the valid admin API and remove the
  nonexistent admin-delete action.
- Review responses currently receive an empty `user_full_name` because handlers
  discard the repository's joined name when mapping list rows.
- The backend's reaction endpoint increments counts without user identity or
  duplicate prevention and returns `204`; the existing optimistic UI remains only
  session-local protection.

## Task 019 - Wishlist And Recommendations Contract Parity

**Status:** Complete
**Date:** 2026-07-13

### What Changed

- Derived canonical wishlist, wishlist item, add-item input/result, membership,
  recommendation item/query, interaction, affinity, and profile contracts from Go
  DTOs, handlers, repositories, services, routes, and response envelopes.
- Added `features/wishlist/types.ts` and `features/recommendations/types.ts` as the
  single domain owners.
- Preserved the add-item `{ wishlist_id }` result and modeled wishlist options as
  optional because the current repository never hydrates the declared field.
- Migrated central and account hooks away from deleted/local wishlist and
  recommendation declarations while preserving request and optimistic-cache
  behavior.
- Migrated account wishlist, account recommendation cards, and product
  recommendation rails to canonical fields, including `product_id` and optional
  recommendation slugs.

### Verification

- Scoped ESLint passed with zero errors and zero warnings.
- Search confirmed one active owner for wishlist and recommendation entities and
  zero stale `RecommendedProduct` or deleted-module type imports.
- Search confirmed the wishlist add result retains `wishlist_id` and options stay
  optional.
- `git diff --check` passed.
- Full TypeScript validation was rerun. It still fails on documented deleted
  catalog/admin modules; no new wishlist/recommendation contract failures appeared.

### Notes / Follow-Ups

- The account hook still calls nonexistent `GET /recommendations`; valid backend
  reads are `/recommendations/for-you`, `/trending`, and product-specific routes.
  Task 033c must replace the unsupported path during API extraction.
- The backend declares wishlist options but does not select or populate them.
- An empty repository result can serialize wishlist `items` as null despite docs
  promising an array; the frontend currently relies on the documented contract.
- Tasks 027f, 033b, and 033c own remaining deleted function imports and wishlist/
  recommendation API extraction.

## Task 020a - Auth And Profile Contract Parity

**Status:** Complete
**Date:** 2026-07-13

- Added exact sign-in/up, refresh, OTP, token, claims, session, profile, and update
  contracts with strict role/gender unions and snake_case wire keys.
- Added public Go sign-up/profile inputs so clients cannot self-assign role,
  status, or password hashes through profile updates.
- Migrated direct auth/profile forms and parsing to canonical contracts.
- Scoped Go tests and ESLint passed; no auth/profile TypeScript errors remain.

## Task 020b - Admin Customer And User-List Contract Parity

**Status:** Complete
**Date:** 2026-07-13

- Added canonical `AdminUser`, `UserListItem`, update input, and list query.
- Removed nonexistent `email_verified`; fixed nil-name mapping, phone mapping,
  list scanning, and explicit inactive filtering.
- Added customer-scoped server/browser APIs and migrated customer pages/forms.
- Scoped tests/lint passed; `total_orders` remains an explicit backend zero-value
  limitation.

## Task 021a - Wallet Contract Parity

**Status:** Complete
**Date:** 2026-07-13

- Added canonical wallet/transaction contracts with decimal strings and
  exhaustive status/type unions.
- Added wallet-owned APIs for the three actual endpoints and migrated wallet UI.
- Removed the obsolete deposit request without inventing top-up/admin endpoints.
- Scoped tests/lint passed; central duplicate hooks remain for extraction.

## Task 021b - Payment Transaction Contract Parity

**Status:** Complete
**Date:** 2026-07-13

- Added canonical payment transactions with decimal-string amount, exhaustive
  status/method unions, and base64 `raw_response`.
- Separated payment transactions from revenue analytics declarations.
- Added mapper contract tests; scoped Go tests and ESLint passed.

## Task 023 - Recipes Contract Parity

**Status:** Complete
**Date:** 2026-07-13

- Added public/admin recipe list/detail/input/query contracts and a recipe-scoped
  admin client.
- Preserved decimal quantities as strings and corrected unwrapping, fallbacks,
  sort fields, and admin status projections.
- Added Go decimal response DTOs and mapper tests; scoped tests/lint passed.

## Task 024 - Journal/Blog Contract Parity

**Status:** Complete
**Date:** 2026-07-13

- Established canonical `Journal*` frontend contracts while retaining Go `Blog*`
  naming and genuine public/admin projections.
- Removed duplicate admin blog types, excluded server-owned `author_id`, and
  normalized empty relation IDs.
- Migrated journal loaders/cards; scoped tests/lint passed.

## Task 025a - Hero-Slide Contract Parity

**Status:** Complete
**Date:** 2026-07-13

- Split public-safe and full admin hero projections with exact nullable fields and
  create/PATCH inputs.
- Added a hero-scoped authenticated client and migrated direct consumers.
- Scoped Go tests and ESLint passed.

## Task 025b - Site-Settings Contract Parity

**Status:** Complete
**Date:** 2026-07-13

- Preserved intentional camelCase settings JSON and separated public/admin DTOs.
- Prevented `updatedAt` persistence, added public/admin APIs, and migrated the
  settings form/page from the missing global admin client.
- Aligned validation limits with Go; scoped tests/lint passed.

## Domain Wave 020-025 Integration

- Full frontend lint passed with zero errors and 16 existing warnings.
- Full TypeScript remains blocked by known deleted catalog/admin modules; none of
  the eight domain tasks adds a scoped TypeScript failure.
- Full `go test ./...` initially exposed stale category `Name` references in the
  Task 010 seeder. Updating them to `Title` restored the complete backend gate.
- `git diff --check` passed.

## Task 022a - Loyalty Contract Parity And Spelling

**Status:** Complete
**Date:** 2026-07-13

- Added strict tier/reason enums and exact account/transaction/redeem contracts.
- Added loyalty-owned hooks and migrated rewards UI.
- Removed `loyality` source imports and moved the misplaced journal explorer back
  to the journal domain.
- Scoped Go tests and ESLint passed; central duplicate hooks remain Task 035c.

## Task 022b - Gift-Card Contract Parity

**Status:** Complete
**Date:** 2026-07-13

- Added exact redemption/admin issuance contracts and decimal-string amounts.
- Migrated gift-card UI to a domain-owned hook and added serialization tests.
- Did not invent balance/history/list endpoints that do not exist.
- Scoped Go tests, vet, formatting, and ESLint passed.

## Task 022c - Subscription Contract Parity

**Status:** Complete
**Date:** 2026-07-13

- Added cadence/status/action/entity/create/update contracts and owned hooks for
  the three real endpoints.
- Corrected address ID response/input nullability and repository status updates.
- Migrated subscription UI and removed its deleted date-formatter dependency.
- Scoped Go tests and ESLint passed.

## Task 022d - Referral Contract Parity

**Status:** Complete
**Date:** 2026-07-13

- Added exact referral code/stats/claim contracts, status enums, explicit
  repository projections, and domain hooks.
- Added JSON contract tests and migrated referral components.
- Scoped Go tests and ESLint passed; no unsupported list operation was invented.

## Task 022e - Taste-Profile Contract Parity

**Status:** Complete
**Date:** 2026-07-13

- Split persistence/response DTOs from update input and added canonical frontend
  profile/options/API/hooks.
- Removed undefined category globals without editing the category owner.
- Added DTO contract tests; scoped Go tests and ESLint passed.

## Task 022f - Product-Alert Contract Parity

**Status:** Complete
**Date:** 2026-07-13

- Added exact restock/price-drop enums, alert DTOs, nullable target/notified fields,
  owned hooks, and only the supported list/create/delete endpoints.
- Migrated the product alert button without changing UI behavior.
- Scoped Go tests and ESLint passed; central duplicate hooks remain Task 035h.

## Task 026a - Inventory Contract Parity

**Status:** Complete
**Date:** 2026-07-13

- Added canonical item/movement/adjustment/threshold/query contracts and enriched
  inventory responses with product/SKU/category/decimal price fields.
- Fixed available-stock filtering, search/sort, restock timestamps, and not-found
  handling.
- Replaced inventory mocks with scoped APIs and connected real adjustments.
- Added mapper tests; scoped Go tests and ESLint passed.

## Task 026b - Analytics Contract Parity

**Status:** Complete
**Date:** 2026-07-13

- Added exact revenue/product/search/event contracts, decimal strings, RFC3339
  ranges, record breakdowns, empty-array behavior, and zero summaries.
- Added missing product/range APIs and corrected false revenue/order UI fields.
- Replaced the active mock analytics route with the new server DashboardBoard and
  deleted obsolete mock view/hooks.
- Documented the analytics UUID versus catalog BIGINT product-ID blocker.
- Scoped Go tests and ESLint passed with no analytics-specific TypeScript errors.

## Domain Wave 022/026 Integration

- Full backend `go test ./...` passed.
- Full frontend lint passed with zero errors and 14 existing warnings.
- Full TypeScript remains blocked by known central-module and later migration
  errors; none originate from these eight domains.
- `git diff --check` passed.

## Task 028 - Split Product APIs By Public/Admin Caller

**Status:** Complete
**Date:** 2026-07-13

### What Changed

- Replaced the ambiguous public product `api.ts` with explicit server-only
  `api/public.ts` and updated every direct storefront/sitemap consumer.
- Replaced admin `api/api.ts` with explicit server-only `api/server.ts`.
- Kept `api/client.ts` as the browser-only transport and added typed selectable
  product/variant reads plus strict upload envelope handling.
- Removed proven-unused throwing public duplicates, duplicate product-owned tag
  calls, unused option attachment, and unused server multipart upload.
- Made product/image Server Actions thin delegates to the admin server API while
  preserving revalidation.
- Migrated the variant picker, legacy product image uploader, and product portion
  of central admin hooks away from the disabled global admin client.
- Restored `/admin/products` as the real product list route with read/write
  permissions and retained the existing non-destructive mock delete behavior.
- Removed stale unsupported `submitLabel` props from product create/edit routes.
- Removed the dead dedicated upload route; the active XHR flow now exclusively
  uses the stronger generic authenticated admin BFF.
- Removed the empty catalog product validation file. Uploader component
  consolidation remains Task 040.

### Verification

- Scoped ESLint passed with zero errors and one existing React Hook Form compiler
  warning in `ProductForm`.
- Search confirmed zero stale ambiguous product API imports, old admin API paths,
  product-specific global admin-client imports, or product `submitLabel` props.
- Full TypeScript validation was rerun. No product-domain/API/uploader errors
  remain; failures are limited to other pending domains and shared mock modules.
- `git diff --check` passed.

### Notes / Follow-Ups

- Product delete/duplicate controls still display explicit sample behavior; a
  later truthful-async task must wire or remove them rather than silently making
  destructive calls.
- Three uploader UI implementations still exist; Task 040 owns selecting one and
  deleting proven dead implementations.
- `allProductSlugs` still reads only the first 100 products; storefront sitemap
  pagination belongs to its dedicated route/SEO task.

## Task 027a - Migrate Product Catalog Imports

**Status:** Complete
**Date:** 2026-07-13

### What Changed

- Inventoried all six direct consumers of deleted `lib/catalog/products` and
  migrated each to the owning product domain.
- Added error-safe, ISR-cached `listProducts`, `getProductById`,
  `getProductBySlug`, and `allProductSlugs` server reads to
  `features/catalog/products/api.ts` using the shared `apiFetch` transport.
- Preserved empty-page/null fallbacks, one-hour revalidation, exact-slug-first
  lookup with first-result fallback, and existing storefront rendering behavior.
- Filtered missing product slugs out of static params and used the known route slug
  for recently viewed state when the backend detail projection omits it.
- Typed storefront sort parameters with the canonical product sort field union.
- Added no deleted-module recreation or compatibility re-export.

### Verification

- Scoped ESLint passed with zero errors and zero warnings.
- Search confirmed zero imports or references to deleted `lib/catalog/products`.
- `git diff --check` passed.
- Full TypeScript validation was rerun. Missing product-catalog module errors and
  their product-detail inference failures are gone; remaining failures belong to
  later category/recommendation/order/admin migration tasks.

### Notes / Follow-Ups

- Task 027b now owns category/brand/tag catalog imports that still suppress type
  inference in several migrated product-list consumers.
- Task 027f owns the remaining deleted recommendation function imports on home and
  product detail pages.

## Task 027b - Migrate Category, Brand, And Tag Catalog Imports

**Status:** Complete
**Date:** 2026-07-13

### What Changed

- Inventoried six deleted category-helper imports and one stale category type
  import; no deleted brand or tag imports remained after their contract tasks.
- Added error-safe, one-hour ISR `listCategories`, `getCategoryBySlug`, and
  `getCategoryTree` reads to the category domain using `apiFetch`.
- Migrated sitemap, storefront layout/search/products/category routes, and the
  admin product edit route to category-owned APIs and contracts.
- Replaced the nonexistent category `name` field with backend `title` throughout
  migrated storefront consumers.
- Filtered categories without slugs from static params/sitemap routes and kept
  safe category-directory fallbacks for links.
- Removed dead layout list work and added no deleted-module recreation or
  compatibility re-export.

### Verification

- Scoped ESLint passed with zero errors and zero warnings.
- Search confirmed zero deleted category/brand/tag helper imports and zero
  `Category`, `Brand`, or `Tag` imports from deleted `lib/catalog/types`.
- `git diff --check` passed.
- Full TypeScript validation was rerun. Category catalog errors and their product
  list/search inference failures are gone; remaining failures belong to later
  order/recommendation/admin migration tasks.

### Notes / Follow-Ups

- Task 027c now owns order catalog imports and labels.
- Category mutation/API transport consolidation remains Task 029.

## Task 027c - Migrate Order Catalog Imports And Labels

**Status:** Complete
**Date:** 2026-07-13

### What Changed

- Added the complete 13-status Persian label map, five payment-method labels, and
  cancellation predicate to `features/orders/labels.ts`.
- Moved the generic Persian date formatter from the deleted order-label module to
  `lib/utils/date.ts` so customer/review/analytics consumers do not depend on the
  order domain.
- Migrated central hooks, checkout/confirmation, account order views, admin order
  views/actions, status badges, analytics, reviews, and customer pages away from
  deleted order type and label modules.
- Replaced `PlaceOrderInput` with canonical `CreateOrderInput` and typed account
  order filters with the full `OrderStatus` union.
- Reused the complete shared status labels in confirmation instead of its local
  seven-status subset.
- Added no compatibility shim or deleted-module recreation.

### Verification

- Scoped ESLint passed with zero errors and zero warnings.
- Search confirmed zero imports from deleted `lib/catalog/types` and
  `lib/catalog/labels` anywhere in the frontend.
- `git diff --check` passed.
- Full TypeScript validation was rerun. Order/catalog-label module errors and
  related order inference failures are gone; remaining failures belong to
  recommendation and admin-client/data migrations.

### Notes / Follow-Ups

- Task 027d is next; address/shipping/coupon contracts are already domain-owned,
  so it should inventory remaining checkout dependencies before editing.
- Admin order tables/actions still depend on missing global admin-client/data
  modules; those are outside deleted catalog migration scope.

## Task 027d - Migrate Address And Checkout Catalog Imports

**Status:** Complete
**Date:** 2026-07-13

### Outcome

- Completed as a verification-only migration: Tasks 014, 016-017, and 027c had
  already moved all address/checkout contracts to their owning domains.
- Confirmed checkout imports `Address`, `CouponValidation`, `PaymentMethod`, and
  `ShippingMethod` from addresses, coupons, orders, and shipping respectively.
- Confirmed central/account hooks import address, coupon, order, and shipping
  contracts from domains rather than deleted catalog modules.
- Confirmed no deleted address, shipping, coupon, checkout, or catch-all catalog
  imports remain.
- No application edit or compatibility shim was necessary.

### Verification

- Scoped checkout/hooks ESLint passed with zero errors and zero warnings.
- Deleted checkout/address catalog import search returned zero matches.
- `git diff --check` passed.
- Full TypeScript validation reports no address/checkout catalog errors; remaining
  failures belong to recommendation and admin-client/data migrations.

### Notes / Follow-Ups

- Task 027e should similarly inventory cart imports before changing files because
  Task 015 already migrated the central cart hook contracts.

## Task 027e - Migrate Cart Catalog Imports

**Status:** Complete
**Date:** 2026-07-13

- Verification-only: Task 015 and 027d had already migrated cart contracts and
  consumers to `features/cart/types.ts`.
- Confirmed one cart contract owner and zero deleted cart/catch-all imports.
- Scoped cart/checkout/hooks ESLint passed with zero errors and zero warnings.
- No application edit or compatibility shim was needed.

## Task 027f - Migrate Review, Wishlist, And Recommendation Catalog Imports

**Status:** Complete
**Date:** 2026-07-13

- Added error-safe, 30-minute ISR recommendation reads to
  `features/recommendations/api.ts` using `apiFetch`.
- Migrated home trending and product similar/frequently-bought consumers from the
  deleted recommendation module.
- Confirmed review and wishlist imports were already domain-owned.
- Scoped ESLint passed with zero errors/warnings; full TypeScript no longer reports
  deleted recommendation failures.
- Zero deleted review, wishlist, or recommendation imports remain.

## Task 027g - Migrate User And Account Catalog Imports

**Status:** Complete
**Date:** 2026-07-13

- Verification-only: Task 020 had already migrated auth, profile, admin customer,
  and account contracts to their owning domains.
- Zero deleted user/customer/profile/auth/account catalog imports remain.
- Scoped account/auth/profile ESLint passed with zero errors and zero warnings.
- No application edit or compatibility shim was needed.

## Task 027h - Migrate Wallet And Small Account-Domain Catalog Imports

**Status:** Complete
**Date:** 2026-07-13

- Verification-only: Tasks 021-022 already migrated wallet, payment, loyalty,
  referral, subscription, gift-card, taste, and alert contracts.
- Zero deleted small-account-domain catalog imports remain.
- Scoped ESLint passed with zero errors and zero warnings.
- No application edit or compatibility shim was needed.

## Task 027i - Migrate Recipe, Journal, Hero, And Settings Catalog Imports

**Status:** Complete
**Date:** 2026-07-13

- Verification-only: Tasks 023-025 already migrated recipe, journal, hero, and
  settings contracts/loaders to owning domains.
- Zero deleted catalog imports remain in those domains or across the frontend.
- Scoped ESLint passed with zero errors and zero warnings.
- No application edit or compatibility shim was needed.

## Task 027j - Migrate Inventory And Analytics Catalog Imports

**Status:** Complete
**Date:** 2026-07-13

- Verification-only: Task 026 already migrated inventory and analytics contracts
  and consumers to their owning domains.
- Confirmed zero inventory/analytics catalog imports and zero `@/lib/catalog`
  imports across the entire frontend.
- Scoped ESLint passed with zero errors and zero warnings.
- No application edit or compatibility shim was needed.

## Task Group 027 - Final Integration

- All subtasks 027a through 027j are complete.
- Added domain-owned, error-safe public APIs for products, categories, and
  recommendations where deleted helpers still had live consumers.
- Migrated order labels and generic Persian date formatting to correct owners.
- Final catalog-import search returned zero matches.
- Full frontend ESLint passed with zero errors and 14 existing warnings.
- Full TypeScript no longer reports deleted `lib/catalog/*` failures; remaining
  failures are missing global admin-client/admin-data dependencies and unrelated
  product/demo cleanup.
- `git diff --check` passed.

## Task 029 - Split Category APIs By Public/Admin Caller

**Status:** Complete
**Date:** 2026-07-13

### What Changed

- Replaced the mixed raw-fetch category module with a public server API using
  `apiFetch` for paginated lists, cached list/tree reads, slug resolution, and
  featured categories.
- Added an authenticated admin server API for category detail/tree reads.
- Added a category-specific browser client for tree queries and create/update/
  delete mutations through the authenticated `/api/admin` BFF proxy.
- Preserved public one-hour ISR caching, error-safe list/tree fallbacks, success
  envelope unwrapping, pagination, structured field errors, and `204` deletes.
- Migrated admin category forms/tables/pages from the missing global admin client
  and direct `apiFetch` calls.
- Removed obsolete raw `fetchCategories`, `fetchCategoryTree`,
  `fetchFeaturedCategories`, and mixed admin mutation exports.

### Verification

- Scoped ESLint passed with zero errors and two existing CategoryForm warnings.
- No old category transport names, raw public server `fetch`, or category global
  admin-client dependencies remain.
- Browser routes and BFF handling preserve public tree reads, admin mutations,
  success unwrapping, and `204` deletion.
- Full TypeScript reports no category API errors.
- `git diff --check` passed.

### Notes / Follow-Ups

- Task 030a is next.
- The existing CategoryForm slug-effect dependency warning remains outside this
  API-splitting task.

## Task 030a - Split Brand APIs By Public/Admin Caller

**Status:** Complete
**Date:** 2026-07-13

- Consolidated public list/detail/home-marquee reads in the brand catalog API with
  one-hour ISR and the existing curated fallback.
- Reduced the admin server API to its actual detail-page caller.
- Retained the browser client for paginated list and create/update/delete calls,
  structured errors, envelope unwrapping, and `204` deletion.
- Removed the duplicate raw `lib/home/brands.ts` fetcher and migrated callers.
- Scoped ESLint passed with zero errors and one existing BrandForm compiler
  warning; no stale brand API imports remain.

## Task 030b - Split Tag APIs By Public/Admin Caller

**Status:** Complete
**Date:** 2026-07-13

- Kept public list/detail/product-tag reads in the catalog tag API and replaced
  transport-oriented names with `listTags`, `getTag`, and `getProductTags`.
- Moved tag CRUD and product-tag assignment operations from the catalog domain to
  `features/admin/tags/api.ts`.
- Corrected CRUD paths from nonexistent `/tags` mutations to `/admin/tags`.
- Preserved `/admin/products/:id/tags` assignment paths and typed attach/sync/
  detach/delete as `Promise<void>` to match backend `204` responses.
- Corrected `GET /products/:id/tags` to `Tag[]`, matching the handler's full tag
  response rather than the embedded reduced product projection.

### Verification

- Combined brand/tag scoped ESLint passed with zero errors and one existing
  BrandForm warning.
- Search confirmed no stale brand/tag API names or catalog-owned admin tag API.
- Route inspection confirmed all admin prefixes and all five `204` expectations.
- Full TypeScript reports no brand/tag API errors.
- `git diff --check` passed.

## Task 032a - Extract Address Hooks And APIs

**Status:** Complete
**Date:** 2026-07-13

- Added address-domain request functions and all five React Query hooks.
- Migrated account, checkout, overview, and subscription consumers.
- Removed central address exports from both hook modules.
- Preserved `queryKeys.addresses`, promise-returning invalidations, request bodies,
  response unwrapping, errors, and `204` behavior.
- Scoped ESLint passed after removing one newly unused central import.

## Task 032b - Extract Cart Hooks And APIs

**Status:** Complete
**Date:** 2026-07-13

- Added cart-domain request functions and all six React Query hooks.
- Migrated cart, product, recipe, wishlist, order, and checkout consumers.
- Removed central cart exports and types.
- Preserved `queryKeys.cart`, returned-cart cache seeding, bulk-result cache seeding,
  clear-cart invalidation, request payloads, and `204` behavior.
- Scoped ESLint passed; central cart-definition search returned zero matches.

## Task 032c - Extract Shipping Hooks And APIs

**Status:** Complete
**Date:** 2026-07-13

- Added the available-shipping request and React Query hook to the shipping domain.
- Migrated checkout and removed central shipping exports/types.
- Preserved the exact query key, enabled condition, BFF transport, response
  unwrapping, query serialization, and `weight=0` behavior.
- Scoped ESLint passed; only the stale central module comment remained for final
  cleanup after coupon extraction.

## Task 032d - Extract Coupon Hooks And APIs

**Status:** Complete
**Date:** 2026-07-13

- Added coupon validation request/hook ownership to the coupon domain.
- Migrated checkout and removed central coupon exports/types.
- Preserved the exact payload, response unwrapping, BFF errors, and absence of
  query-key/cache side effects.
- Removed unused centralized cart/address endpoint constants and corrected stale
  central hook documentation found by parallel final review.
- Combined scoped ESLint passed with zero warnings or errors.
- Full TypeScript has no Task Group 032 errors; unrelated baseline failures remain.
- Two parallel final reviewers found no behavioral or migration defects.
- `git diff --check` passed.

## Task 031 - Split Order APIs By Account/Admin Caller

**Status:** Complete
**Date:** 2026-07-13

### What Changed

- Replaced the mixed `features/orders/api.ts` with explicit server-only
  `api/account.ts`, `api/admin.ts`, and `api/index.ts` boundaries.
- Added browser-only account/admin clients with exact success, error, pagination,
  and `204` cancellation handling.
- Moved account order React Query hooks and keys into the order domain while
  preserving cart/order invalidation after creation and order invalidation after
  cancellation.
- Added real admin order hooks, list pagination, typed status mutation errors,
  optimistic rollback, and list invalidation.
- Migrated account views, checkout, confirmation, admin detail/list, and recent
  analytics orders to domain-owned APIs and hooks.
- Removed the admin-local API duplicate, empty account/admin placeholders, stale
  architecture sketch, central order hook/key ownership, and unused endpoint
  constants.
- Removed fake admin-order fallback data and replaced it with explicit loading,
  retry, empty, and paginated states.
- Moved the live order status badge into the order domain so order surfaces no
  longer depend on the missing global admin mock module.
- Removed unsupported account invoice/tracking controls and the misleading fake
  refund action; only implemented print and status-update behavior remains.
- Corrected the backend order list repository to return a purpose-built list
  projection instead of scanning `SELECT *`, which had broken after gift columns
  were added.
- Corrected backend `item_count` to sum real order-item quantities instead of
  returning zero for every account/admin list item.

### Verification

- Full backend `go test ./...` passed.
- Full backend `go vet ./...` passed.
- Order-scoped ESLint passed with zero errors and zero warnings.
- Full frontend lint passed with zero errors and 14 unrelated existing warnings.
- Full TypeScript validation reports no order-specific errors; remaining failures
  belong to customer/catalog/review/global-mock migrations.
- Search confirmed no live stale order API names, admin-client imports, mock-data
  imports, central order keys/hooks, or direct route-level order fetches.
- `git diff --check` passed.

### Notes / Follow-Ups

- The backend still gates the entire `/admin` route group to the literal `admin`
  role while the frontend models support/manager permissions. That broader RBAC
  mismatch affects every admin domain and requires a separate authorization task.

## Task Group 033 - Social-Commerce Domain APIs

**Status:** Complete
**Date:** 2026-07-13

### Task 033a - Reviews

- Moved public review pagination into a review-owned Server Action and removed the
  product feature dependency on the App Router action file.
- Added domain-owned review clients, hooks, query keys, mutation actions, cache
  tags, and typed mutation errors.
- Replaced raw PDP review requests with typed create/reaction hooks and preserved
  optimistic reaction rollback plus conflict/access messaging.
- Added real `/reviews/mine` and `/reviews/pending` account endpoints backed by
  product/order joins; migrated the account review view and real delete flow.
- Replaced the mock admin queue with live, status-filtered backend pagination and
  real moderation; removed the unsupported admin delete control.
- Fixed review write/detail/moderation scans, reviewer names, nullable image alt
  text, empty image arrays, owner protection for unapproved images, and public
  visibility of unapproved review details.
- Enforced delivered-purchase eligibility and added a partial unique index for one
  active review per user/product, including safe historical duplicate cleanup.
- Made reactions one vote per user using `review_votes`, with idempotent repeated
  votes and correct counter changes when switching vote type.
- Added backend regression tests for purchase eligibility, verified purchase, and
  non-null account response arrays.

### Task 033b - Wishlist

- Added domain-owned wishlist API functions, hooks, and cache keys, including the
  previously unexposed clear operation.
- Preserved optimistic add/remove, rollback, membership updates, and root-prefix
  invalidation behavior exactly.
- Migrated PDP and account consumers and removed central wishlist hooks, keys, and
  endpoint constants.
- Added product slugs to wishlist responses for direct PDP links.
- Normalized empty item arrays, made missing inventory safely report out of stock,
  and mapped missing item removal to `404 NOT_FOUND`.

### Task 033c - Recommendations

- Added domain-owned authenticated clients, hooks, and keys for `for-you`,
  interactions, profile reads, and profile recomputation while retaining cached
  public trending/similar/frequently-bought-together APIs.
- Removed the nonexistent bare `/recommendations` request and migrated home,
  account, PDP wishlist/review, and recently-viewed consumers.
- Removed the false coupling between taste-profile categories and the separate
  interaction/order recommendation engine.
- Added typed view, wishlist, and review signals; browser clients can no longer
  forge purchase or add-to-cart signals.
- Limited interaction sources to the database's 40-character contract, deduplicated
  trending interaction weight per user/product/type/day, and excluded pending,
  failed, cancelled, and fully refunded orders from purchase-derived signals.
- Added a truly anonymous public request transport so public review/recommendation
  reads remain shared and cacheable rather than reading session state.

### Verification

- Full backend `go test ./...` passed, including the new review service tests.
- Full backend `go vet ./...` passed.
- Full frontend lint passed with zero errors and 14 unrelated existing warnings.
- Full TypeScript reports no review/wishlist/recommendation errors; remaining
  failures belong to customer/catalog/global-admin cleanup.
- Two independent read-only reviewers found backend/frontend issues; all concrete
  high/medium findings and contract-validation lows were fixed before archival.
- Search confirmed no stale app-owned review action, social central hooks/keys,
  mock review data, raw social BFF requests, or unsupported bare recommendation
  endpoint remains.
- `git diff --check` passed.

### Notes / Follow-Ups

- The cross-domain backend admin-role mismatch documented under Task 031 still
  affects support/manager moderation and remains a separate RBAC task.

## Task 034 - Extract Profile, Auth, And Customer APIs

**Status:** Complete
**Date:** 2026-07-13

- Added domain-owned profile requests/hooks with the exact `['auth', 'me']` key
  and successful mutation cache replacement.
- Split auth transport into same-origin browser functions and direct server
  functions, preserving NextAuth orchestration without introducing an
  `auth.ts -> apiFetch -> auth.ts` cycle.
- Migrated registration, OTP request, forgot-password, and password-reset forms
  while preserving their status/code-specific and enumeration-safe UI behavior.
- Moved customer contracts, server reads, browser mutation, and typed field errors
  from admin presentation ownership to `features/customers`.
- Removed duplicate profile hooks/types, dead mock customer hooks/keys, obsolete
  auth/admin-user endpoint constants, and empty auth API/hook placeholders.
- Scoped ESLint passed with zero warnings or errors; static cycle and stale-import
  searches returned zero matches.
- Full TypeScript reports no Task 034 errors. Existing missing sample-data/admin
  modules and catalog helper failures remain assigned to later work.
- Parallel final review found no auth/profile regression and no Task 033 damage.
- `git diff --check` passed.

## Task Group 035 - Wallet And Small Account-Domain APIs

**Status:** Complete
**Date:** 2026-07-13

### Task 035a - Wallet

- Moved exact decimal-string wallet contracts, request functions, hooks, and keys
  to top-level `features/wallet` ownership.
- Migrated wallet/account consumers and removed the stale number-valued central
  duplicate and nested account API/type ownership.

### Task 035b - Payments

- Added server and browser admin payment APIs, domain query keys, and hooks for
  real list/detail/transaction-ID endpoints without inventing mutations or UI.

### Task 035c - Loyalty

- Split loyalty requests, hooks, keys, and contracts into the loyalty domain.
- Preserved account/transaction cache identities and wallet-root invalidation on
  point redemption.

### Task 035d - Gift Cards

- Split customer redemption and admin issuance transports under gift-card
  ownership, preserving decimal strings, field errors, and wallet invalidation.

### Task 035e - Subscriptions

- Added subscription request, hook, key, and contract ownership with exact object
  payloads and list invalidation after create/update.

### Task 035f - Referrals

- Added referral request, hook, key, and contract ownership; preserved the
  object-shaped claim payload and bodyless `204` response.

### Task 035g - Taste Profile

- Added taste request, hook, key, option, and nullable response ownership; migrated
  account composition without restoring the removed recommendation coupling.

### Task 035h - Product Alerts

- Split alert requests, hooks, keys, and exact nullable contracts; preserved list
  invalidation and `204` deletion.

### Verification

- Full frontend lint passed with zero errors and 14 existing warnings.
- Full TypeScript passed with zero errors.
- Full backend `go test ./...` passed.
- Independent final review found no Task Group 035 behavioral regression.
- Search found no central/nested legacy imports or duplicate hooks.
- `git diff --check` passed.

## Task Group 036 - Content And Settings APIs

**Status:** Complete
**Date:** 2026-07-13

### Task 036a - Recipes

- Split cached public/server recipe reads from browser/admin writes under the
  recipe domain, preserving fallbacks, pagination, field errors, and `204` delete.
- Migrated routes, sitemap, LLM output, cards, filters, forms, and boards from the
  deleted legacy recipe module.

### Task 036b - Journal

- Added cached public journal APIs and journal-owned utilities/contracts.
- Migrated routes, sitemap, LLM output, and cards from the deleted legacy journal
  module while preserving empty/null fallbacks and the existing 100-post limit.

### Task 036c - Hero Slides

- Split cached public fallback reads and typed admin browser writes under a
  top-level hero-slide domain.
- Migrated home and admin consumers, preserved the 300-second cache/fallback,
  query invalidation, typed errors, and bodyless delete behavior.

### Task 036d - Site Settings

- Consolidated public/admin settings contracts and server/browser APIs under
  `features/settings` and migrated the admin page/form.
- Public reads now use anonymous `publicRequest`; admin reads/writes retain their
  authenticated server/BFF transports.

### Verification

- Full frontend lint passed with zero errors and 14 existing warnings.
- Full TypeScript passed with zero errors.
- Full backend `go test ./...` passed.
- Search found no raw domain fetches, old legacy imports, or unsupported endpoints.
- Independent review confirmed endpoint/envelope/cache behavior; retained backend
  nullable-clear and journal pagination limits are documented existing behavior.
- `git diff --check` passed.

## Task Group 037 - Inventory And Analytics APIs

**Status:** Complete
**Date:** 2026-07-13

### Task 037a - Inventory

- Added inventory-owned contracts, APIs, Server Action, mutation hook, query key,
  status utilities, and stock badge.
- Migrated inventory routes/components from missing sample data to exact backend
  reads and writes with truthful loading, error, empty, and refresh behavior.
- Preserved inventory invalidation and removed duplicate admin-domain placeholders.

### Task 037b - Analytics

- Added analytics-owned contracts, APIs, date-range logic, and formatting helpers.
- Migrated dashboard components from admin/sample ownership while preserving
  server request deduplication and Suspense boundaries.
- Replaced silent sample/empty failure behavior with explicit API error and valid
  empty states.
- Corrected missing analytics rollups to return `404` rather than `500`.

### Verification

- Full backend tests passed.
- Scoped frontend lint passed with zero errors.
- No inventory/analytics TypeScript errors or stale sample imports remain.
- `git diff --check` passed.

## Task 038 - Retire Disabled Global Admin Client

**Status:** Complete
**Date:** 2026-07-13

- Added a focused standalone-upload browser client with exact multipart folder,
  progress, cancellation, success-envelope, and typed-error behavior.
- Migrated `FlexibleImageInput` without changing its component contract.
- Deleted `lib/api/admin-client.txt`; no global catch-all or compatibility shim was
  introduced.
- Updated current architecture/API documentation to describe domain-owned admin
  transports.
- Search confirms zero executable or current-document references to the deleted
  client, `adminRequest`, or `AdminApiError`.

## Task 039 - Green Frontend Baseline

**Status:** Complete
**Date:** 2026-07-13

- Removed the final fabricated customer sample panels instead of recreating the
  deleted mock module.
- Pruned the shared status badge to active backend-backed exports, deleted the
  unconsumed central admin hooks module, migrated LLM category output, and repaired
  the legacy product card without broadening into Task 043b.
- Made public category/product/brand prerender reads anonymous and safely
  backend-unavailable.
- Added `typecheck`, deterministic test, and watch-test scripts using installed
  TypeScript and Vitest tooling.

### Acceptance Verification

- `npm run typecheck` passed with zero errors.
- `npm run lint` passed with zero errors and 14 pre-existing warnings.
- `npm run test` passed; no test files currently exist.
- Production `next build` passed with the backend intentionally unreachable,
  proving public prerender routes use safe fallbacks.
- Full backend `go test ./...` and `go vet ./...` passed.
- Stale deleted-module searches and `git diff --check` passed.

### Phase Result

- Phase C is complete. Task 040 starts Phase D.

## Task 040 - Consolidate The Product Image Uploader

**Status:** Complete
**Date:** 2026-07-13

### What Changed

- Selected the active modular `features/image-uploader` implementation and
  retained the canonical catalog `ProductImage` plus browser upload signature.
- Restored the semantic product-image form section and storage-key-aware optimized
  previews while preserving duplicate filtering, limits, progress, keyboard
  reorder controls, live announcements, and create/edit behavior.
- Made `flush(productId)` exclusive and durable: it waits for in-flight uploads
  and mutations, rejects validation/upload/persistence failures, persists final
  order/primary state, and prevents false product-save success.
- Made edit-mode optimistic delete, primary, alt, and reorder operations truthful
  with interaction locking and rollback; primary deletion promotes a replacement
  before deleting the current primary.
- Made create-mode partial image failure navigate to the already-created product
  instead of inviting accidental duplicate creation on resubmit.
- Fixed object-URL cleanup, mobile reorder controls, unique alt labels, live error
  announcements, and accessible progress labels.
- Deleted the two unused monolithic uploaders and dead product-image list wrappers;
  no compatibility shim was added.

### Verification

- `npm run typecheck` passed with zero errors.
- `npm run lint` passed with zero errors and 14 existing warnings.
- `npm run test` passed; no test files currently exist.
- Production `npm run build` passed.
- Search confirmed one uploader implementation, one product upload client, the
  `file` multipart field, and zero stale duplicate imports.
- Two independent review rounds drove concurrency/primary-state fixes.
- `git diff --check` passed.

### Follow-Up

- Existing product update/deactivation semantics, product-detail cache
  invalidation after image writes, and multi-phase product/variant persistence
  require backend/product workflow changes outside this consolidation task.

## Task 041 - Move Auth Components Into Feature Ownership

**Status:** Complete
**Date:** 2026-07-13

### What Changed

- Moved login, phone/OTP login, registration, forgot-password, and reset-password
  leaf forms from `components/auth` to `features/auth/components`.
- Moved login tabs after its leaf dependencies and updated both imports directly.
- Moved `SessionGuard` and updated the root providers import without changing
  provider order or terminal refresh-failure behavior.
- Updated all auth routes directly; no old-path barrel or compatibility shim was
  created.
- Removed the now-empty top-level auth component directory and updated current
  auth/architecture documentation and the project tree.
- Preserved all callback propagation, typed auth-client handling, OTP cooldown,
  enumeration-safe forgot-password response, reset flow, and session behavior.

### Verification

- `npm run typecheck` passed.
- Auth-scoped and full `npm run lint` passed with zero errors; 14 existing warnings
  remain outside this task.
- `npm run test` passed; no test files currently exist.
- Production `next build` passed with the backend intentionally unreachable.
- Search found zero executable/current-document imports from `components/auth`.
- `git diff --check` passed.

### Follow-Up

- External `callbackUrl` validation is an existing security-hardening opportunity;
  it was not changed during this behavior-preserving relocation.

## Task 042a - Move Category Tree Hook And Domain Files

**Status:** Complete
**Date:** 2026-07-14

### What Changed

- Moved the client category-tree query hook from top-level `components` into the
  catalog category domain.
- Added an allowlisted public BFF category-tree read for the client hook and
  retained its query key and five-minute client stale time without importing the
  server-only category transport.
- Removed the duplicate top-level raw fetch helper; the storefront header remains
  server-fed by the canonical category API.

### Verification

- Scoped ESLint passed.
- Full frontend typecheck passed.
- Search found no stale top-level category helper imports.
- `git diff --check` passed.
- Cumulative Task Group 042 lint, test, build, viewport, and keyboard gates passed
  after Task 042e.

## Task 042b - Move Product Mega Menu

**Status:** Complete
**Date:** 2026-07-14

### What Changed

- Moved the desktop product mega menu into catalog category ownership.
- Added an always-present all-products route and an intentional empty-category
  panel instead of removing desktop product navigation.
- Guarded optional slugs, exposed each root-category destination in its active
  panel, and removed the unsupported discount-sort destination.
- Replaced raw category images with a reusable category thumbnail backed by
  `SmartImage` and a monogram fallback.
- Added outside-pointer dismissal, Escape focus restoration, reduced-motion
  behavior, visible focus states, and larger interaction targets.
- Added roving category tabs and collision-safe panel positioning within viewport
  gutters.

### Verification

- Scoped ESLint passed with zero warnings.
- Full frontend typecheck passed.
- Stale import and unsupported menu-route searches passed.
- `git diff --check` passed.
- Cumulative Task Group 042 lint, test, build, viewport, and keyboard gates passed
  after Task 042e.

## Task 042c - Move Mobile Category Drawer

**Status:** Complete
**Date:** 2026-07-14

### What Changed

- Moved the mobile drawer into the storefront navigation feature while retaining
  category contracts, imagery, and URL construction in the category domain.
- Added shared slug-safe category URL generation and reused it in desktop and
  mobile navigation.
- Preserved stack-based drill-down with explicit back and current-category links.
- Added a truthful no-category/no-child state, persistent all-products access,
  44px-or-larger controls, visible focus, and canonical image fallbacks.
- Restored focus to the new level heading after drill-down/back navigation and
  reserved physical RTL space for the sheet close control.

### Verification

- Scoped ESLint passed with zero warnings.
- Full frontend typecheck passed.
- Stale import and unsafe category-link searches passed.
- `git diff --check` passed.
- Cumulative Task Group 042 lint, test, build, viewport, and keyboard gates passed
  after Task 042e.

## Task 042d - Move Header Search

**Status:** Complete
**Date:** 2026-07-14

### What Changed

- Moved the shared desktop/drawer search component into storefront navigation.
- Preserved trimmed, URL-encoded navigation to the existing search route and the
  drawer close callback.
- Added a named query control, explicit form/control labels, visible keyboard
  focus, and 44px submit/clear targets.
- Returned focus to the input when clearing so the conditional clear control does
  not strand keyboard focus.

### Verification

- Scoped ESLint passed with zero warnings.
- Full frontend typecheck passed.
- Search found no stale top-level header-search imports.
- `git diff --check` passed.
- Cumulative Task Group 042 lint, test, build, viewport, and keyboard gates passed
  after Task 042e.

## Task 042e - Move Header Actions And Site-Header Composition

**Status:** Complete
**Date:** 2026-07-14

### What Changed

- Moved header actions, logo, static links, announcement, search, mobile drawer,
  and site-header composition into `features/storefront/navigation`.
- Converted `SiteHeader` back to a Server Component and isolated scroll state in
  a small `HeaderChrome` client slot, following the installed Next.js 16
  server/client interleaving guidance.
- Centralized primary links, announcement copy, and product-menu promotion data.
- Kept category contracts, URL construction, thumbnails, and desktop category
  navigation in the catalog category domain.
- Removed all obsolete top-level business-specific header/navigation components
  and updated the storefront layout directly without compatibility shims.

### Acceptance Verification For Task Group 042

- Full `npm run typecheck` passed.
- Full `npm run lint` passed with zero errors and 12 pre-existing warnings outside
  Task Group 042.
- `npm run test` passed; the project currently contains no test files.
- Production `npm run build` passed.
- Browser checks passed at 320, 375, 768, 1024, and 1440px with no horizontal
  overflow or RTL title/close overlap.
- Mobile open/drill/back/close, level focus, and search-clear focus passed.
- Desktop outside-click, Escape restoration, roving tab/arrow flow, category
  links, and empty-tree fallback passed.
- Search found zero executable imports from removed top-level navigation modules.
- Independent review found no remaining Task Group 042 defects.
- `git diff --check` passed.

## Task 043a - Move Add-To-Cart Button

**Status:** Complete
**Date:** 2026-07-14

### What Changed

- Moved the real authenticated, variant-aware cart mutation into cart ownership.
- Updated product detail, recipe detail, and journal detail consumers directly.
- Deleted the unused synthetic-product toast button and the old product-domain
  module without compatibility shims.
- Added the missing unique cart-line migration and made cart add/update operations
  enforce cumulative stock atomically at the repository boundary.

### Verification

- Scoped ESLint passed with zero warnings.
- Full frontend typecheck passed.
- Search found only cart-owned add-to-cart imports.
- `git diff --check` passed.

## Task 043b - Consolidate And Redesign The Canonical Product Card

**Status:** Complete
**Date:** 2026-07-14

### What Changed

- Deleted the unused synthetic legacy card and kept one canonical list card.
- Added backend `purchasable_variant_id` only when exactly one active, in-stock
  variant can be selected deterministically; multi-variant products never guess a
  variant.
- Added explicit active/available variant counts so sold-out, multi-option, and
  missing-slug products are represented truthfully.
- Replaced generated bottle artwork with responsive real product media using the
  canonical storage key, URL, alt text, transform pipeline, and branded fallback.
- Moved the storage-aware optimized image out of admin-only ownership.
- Added a larger luxe-minimal card, slug-safe links, truthful price/availability,
  touch-visible controls, hover/focus overlays, real quick-add, and real wishlist
  mutations with pending/error/auth states.
- In-stock multi-variant cards route to option selection; sold-out products expose
  a disabled unavailable action.

### Verification

- Product response JSON contract test passed.
- Scoped backend model/repository tests passed.
- Scoped ESLint passed with no new warnings.
- Full frontend typecheck passed.
- Legacy card and admin-only optimized-image searches passed.
- `git diff --check` passed.

## Task 043c - Move Age Gate To Compliance Domain

**Status:** Complete
**Date:** 2026-07-14

- Moved the browser-local age gate into compliance ownership and updated the sole
  storefront-layout import directly.
- Preserved local storage, custom-event synchronization, redirect, and body scroll
  locking.
- Corrected the stale `21+` comment to the rendered `18+` policy and added dialog
  labeling, focus containment, background inertness, and non-dismissible modal
  behavior.
- Scoped ESLint, full typecheck, ownership search, and `git diff --check` passed.

## Task 043d - Move Brand Marquee To Brand Ownership

**Status:** Complete
**Date:** 2026-07-14

- Moved the server-rendered marquee into the catalog brand domain and updated its
  sole home-page consumer directly.
- Preserved the compositor-only loop, duplicated-track accessibility suppression,
  hover pause, and existing reduced-motion CSS.
- Scoped ESLint, full typecheck, ownership search, and `git diff --check` passed.

## Task 043e - Split Multi-Domain Admin Status Badges

**Status:** Complete
**Date:** 2026-07-14

- Moved account status and backend-supported role labels into customer ownership.
- Added a product-owned published/draft badge instead of presenting product state
  through a user-account component.
- Updated all consumers and deleted the shared multi-domain admin badge module.
- Scoped ESLint, full typecheck, ownership search, and `git diff --check` passed.

## Task 043f - Move Variant Picker To Product Domain

**Status:** Complete
**Date:** 2026-07-14

- Moved the real two-step product/variant picker beside the admin product browser
  API and updated its recipe-form consumer directly.
- Preserved searchable product selection, edit labels, errors, retries, and query
  caching while excluding inactive variants from new shoppable selections.
- Scoped ESLint passed with no new warnings; full typecheck, ownership search, and
  `git diff --check` passed.

## Task 043g - Move Category Image Input

**Status:** Complete
**Date:** 2026-07-14

- Replaced the fabricated CDN upload with a category-owned wrapper around the real
  authenticated upload flow.
- Moved the reusable URL-or-upload field into admin upload ownership and updated
  category, recipe, and hero consumers.
- Fixed default MIME validation, field ID/blur wiring, and the category form's
  stale slug-effect dependency.
- Blocked category, recipe, and hero submission while their standalone upload is
  in flight.
- Added an explicit backend `categories` standalone-upload folder.
- Scoped backend handler tests, scoped ESLint with no new warnings, full frontend
  typecheck, stale mock/import searches, and `git diff --check` passed.

## Task Group 043 - Acceptance Verification

**Status:** Complete
**Date:** 2026-07-14

- Full backend `go test ./...` passed.
- Frontend typecheck and production build passed.
- Frontend tests passed: 1 file, 5 safe-callback cases.
- Full lint passed with zero errors and 11 unrelated existing warnings.

## Task 048 - Add Route-Level Loading, Error, Not-Found, And Retry States

**Status:** Complete
**Date:** 2026-07-15

- Added localized loading, error, not-found, and `unstable_retry` states for the
  root, storefront, account, checkout, and admin route segments, plus a focused
  journal-detail skeleton and a failure-independent terminal global fallback.
- Made primary public reads truthful: list failures propagate, typed detail 404s
  become missing data, non-404 failures rethrow, and static-param discovery fails
  softly with sanitized build logs.
- Added explicit loading/error/retry states to the touched account queries and
  mapped missing account orders to the successful not-found branch while retaining
  cached wallet data after failed background refetches.
- Documented Next 16.2.6 streamed soft-404 and same-segment layout-boundary
  constraints, and corrected all active API guidance to the real `apiFetch` API.
- Extracted one shared `ApiError` identity, added jsdom interaction coverage for
  rendered retry controls and ARIA state regions, and tested real public/account
  transport error classification.
- Independent acceptance review found no blockers. Frontend tests passed (5 files,
  37 tests), typecheck/typegen passed, lint passed with zero errors and 11 existing
  warnings, focused backend tests passed, production build rendered all 23 static
  pages against a deterministic empty API contract, and `git diff --check` passed.

## Task 047a - Split `RecipeForm` Responsibilities

**Status:** Complete
**Date:** 2026-07-15

- Reduced `RecipeForm.tsx` from 891 to 223 lines while retaining form state,
  defaults, watches, upload coordination, payload construction, API errors,
  mutations, toasts, and navigation in the orchestration owner.
- Extracted cohesive general, content, specification, ingredient, shoppable
  product, SEO, image, publication, tag, and action presentation components under
  recipe-form ownership with no schema, API, markup, or behavior redesign.
- Scoped ESLint passed with zero errors and the existing React Hook Form compiler
  warning; frontend typecheck, eight validation tests, and `git diff --check`
  passed.

## Task 047b - Split `CheckoutFlow` Responsibilities

**Status:** Complete
**Date:** 2026-07-15

- Reduced `checkout-flow.tsx` from 641 to 302 lines while retaining all checkout
  hooks, state, calculations, validation, mutations, payload construction, error
  handling, redirects, and wizard navigation in the orchestration owner.
- Extracted the progress stepper, four step presentations, shared rows, and sticky
  order summary without changing copy, classes, coupon/gift semantics, submit
  paths, or the render-time address synchronization reserved for Task 050.
- Scoped ESLint, frontend typecheck, and `git diff --check` passed.

## Task 047c - Split `WalletView` Responsibilities

**Status:** Complete
**Date:** 2026-07-15

- Reduced `wallet-view.tsx` from 575 to 173 lines while retaining wallet hooks,
  URL-backed filters, date/direction filtering, monthly summaries, pagination,
  clamping, query synchronization, and refetch orchestration in the owner.
- Extracted balance/month overview and transaction filter/table/pager presentation,
  preserving the read-only top-up state, data test IDs, copy, classes, and all
  loading/error/empty behavior.
- Scoped ESLint, frontend typecheck, and `git diff --check` passed.

## Task 047d - Split `SettingsForm` Responsibilities

**Status:** Complete
**Date:** 2026-07-15

- Reduced `SettingsForm.tsx` from 509 to 250 lines while retaining form state,
  complete defaults/payload mapping, server-error handling, mutation/reset,
  previews, dirty state, and router orchestration in the owner.
- Extracted shared form layout and six typed tab sections without changing fields,
  IDs, validation, tab order, maintenance warnings, classes, or the responsive tab
  behavior reserved for Task 054.
- Scoped ESLint passed with zero errors and the existing React Hook Form compiler
  warning; frontend typecheck, eight validation tests, and `git diff --check`
  passed.

## Task 047e - Split Hero-Form Responsibilities

**Status:** Complete
**Date:** 2026-07-15

- Reduced `hero-form.tsx` from 485 to 204 lines while retaining mode/defaults,
  concurrent upload tracking, watches, payload mapping, server errors, mutations,
  toasts, and navigation in the owner.
- Extracted typed content, responsive-media, CTA, appearance/publication/ordering,
  layout, and live-preview components without adding scheduling fields or changing
  existing uploader, preview, theme, publication, submit, or cancel behavior.
- Scoped ESLint passed with zero errors and the existing React Hook Form compiler
  warning; frontend typecheck, eight validation tests, and `git diff --check`
  passed.

## Task 047f - Split Customer-Form Responsibilities

**Status:** Complete
**Date:** 2026-07-15

- Reduced `UserEditForm.tsx` from 455 to 186 lines while retaining localized
  conversion, defaults, form watches, payload mapping, API errors, mutations,
  reset, toasts, and router orchestration in the owner.
- Extracted profile, access/RBAC, identity-summary, and action presentation while
  preserving supported roles, field contracts, warnings, and the critical rule
  that self-edits omit role and active-status fields.
- Scoped ESLint, frontend typecheck, eight validation tests, and `git diff --check`
  passed.

## Task 047g - Split Subscriptions-View Responsibilities

**Status:** Complete
**Date:** 2026-07-15

- Reduced `subscriptions-view.tsx` from 446 to 116 lines while retaining all
  subscription/address hooks, cadence and confirmation state, status sorting,
  mutations, row-busy state, and feedback in the owner.
- Extracted bounded create, list-state, card, display-helper, and controlled
  confirmation-dialog modules; the largest presentation file is 247 lines.
- Preserved supported actions, address rendering, cadence/status ordering, copy,
  classes, and row-local mutation behavior.
- Scoped ESLint, frontend typecheck, the backend subscription model test, and
  `git diff --check` passed.

## Task 047h - Split Reviews-Section Responsibilities

**Status:** Complete
**Date:** 2026-07-15

- Reduced `reviews-section.tsx` from 443 to 162 lines while retaining session,
  filtering, pagination, pending-review merge, transitions, optimistic reactions,
  rollback, and guest/auth orchestration in the owner.
- Extracted bounded summary, display, list, card, and write-dialog components while
  preserving required-title validation, pending visibility, and 403/409 mutation
  error distinctions.
- Scoped ESLint, frontend typecheck, backend review service tests, and
  `git diff --check` passed.

## Task Group 047 - Acceptance Verification

**Status:** Complete
**Date:** 2026-07-15

- Split all eight oversized owners into domain-local orchestration and bounded
  presentation modules without adding compatibility barrels or behavior changes.
- Full frontend typecheck, 13 tests, production build, and `git diff --check`
  passed.
- Full lint passed with zero errors and 11 existing unrelated warnings.

## Task 046a - Thin Product-Create Route

**Status:** Complete
**Date:** 2026-07-14

- Extracted the exact product-create option loading, header, navigation, and form
  composition into the server-only `product-editor-view.tsx` feature module.
- Kept the products-write permission guard in the route and preserved parallel
  option reads plus silent dependency failure-to-empty behavior.
- Scoped ESLint, full frontend typecheck, ownership/stale-import searches, and
  `git diff --check` passed.

## Task 046b - Thin Product-Edit Route

**Status:** Complete
**Date:** 2026-07-14

- Added `ProductEditView` to the server-only product editor module and reused its
  shared failure-safe category, brand, and tag option loader.
- Kept products-read permission and promised parameter resolution in the route;
  preserved raw ID number conversion, 404 handling, errors, header, and form props.
- Scoped ESLint, full frontend typecheck, ownership/stale-import searches, and
  `git diff --check` passed.

## Task 046c - Thin Category-Create Route

**Status:** Complete
**Date:** 2026-07-14

- Extracted category-create tree loading, header, navigation, and form composition
  into the server-only `category-editor-view.tsx` feature module.
- Kept products-write permission in the route and preserved tree failure-to-empty
  behavior, exact copy, form mode, tree, and submit label.
- Scoped ESLint, full frontend typecheck, ownership/stale-import searches, and
  `git diff --check` passed.

## Task 046d - Thin Category-Edit Route

**Status:** Complete
**Date:** 2026-07-14

- Added `CategoryEditView` to the server-only category editor module and reused
  its shared failure-safe category-tree loader.
- Kept products-read permission and promised parameter resolution in the route;
  preserved raw ID fetch behavior, 404 handling, header, and exact edit form props.
- Scoped ESLint, full frontend typecheck, ownership/stale-import searches, and
  `git diff --check` passed.

## Task 046e - Thin Brand-Edit Route

**Status:** Complete
**Date:** 2026-07-14

- Extracted brand fetch, not-found handling, header, navigation, and form
  composition into server-only `brand-edit-view.tsx`.
- Kept products-write permission and promised parameter resolution in the route;
  preserved raw string ID behavior, error propagation, copy, and form props.
- Scoped ESLint, full frontend typecheck, ownership/stale-import searches, and
  `git diff --check` passed.

## Task 046f - Thin Recipe-Create Route

**Status:** Complete
**Date:** 2026-07-14

- Extracted recipe-create tag loading, header, navigation, and form composition
  into the server-only `recipe-editor-view.tsx` feature module.
- Kept recipes-write permission in the route and preserved public tag pagination,
  failure-to-empty behavior, exact copy, form mode, tags, and submit label.
- Scoped ESLint, full frontend typecheck, ownership/stale-import searches, and
  `git diff --check` passed.

## Task 046g - Thin Recipe-Edit Route

**Status:** Complete
**Date:** 2026-07-14

- Added `RecipeEditView` to the server-only recipe editor module and reused its
  shared failure-safe tag loader.
- Kept recipes-read permission and promised parameter resolution in the route;
  preserved admin detail hydration, raw ID behavior, 404 handling, and form output.
- Scoped ESLint, full frontend typecheck, ownership/stale-import searches, and
  `git diff --check` passed.

## Task 046h - Thin Settings Route

**Status:** Complete
**Date:** 2026-07-14

- Extracted the settings fetch, complete custom unavailable state, header, and
  form composition into server-only `admin-settings-view.tsx`.
- Kept settings-manage permission in the route and preserved catch-all fetch
  failure handling, null handling, alert semantics, copy, and form props.
- Scoped ESLint, full frontend typecheck, ownership/stale-import searches, and
  `git diff --check` passed.

## Task 046i - Thin Customer-List Route

**Status:** Complete
**Date:** 2026-07-14

- Extracted query parsing, Suspense composition, user fetch, failure and empty
  states, table, and pagination into server-only `customers-view.tsx`.
- Kept customers-read permission and promised search-parameter resolution in the
  route; preserved coercion, Suspense key/fallback, output, and link behavior.
- Scoped ESLint, full frontend typecheck, ownership/stale-import searches, and
  `git diff --check` passed.

## Task 046j - Thin Customer-Detail Route

**Status:** Complete
**Date:** 2026-07-14

- Extracted the admin-user fetch, custom unavailable state, header, identity card,
  and conditional edit action into server-only `customer-detail-view.tsx`.
- Kept customers-read permission, promised params, and customers-write capability
  computation in the route; preserved the active-user 404 distinction and output.
- Scoped ESLint, full frontend typecheck, ownership/stale-import searches, and
  `git diff --check` passed.

## Task 046k - Thin Customer-Edit Route

**Status:** Complete
**Date:** 2026-07-14

- Extracted the admin-user fetch, custom unavailable state, self detection,
  header, and form composition into server-only `customer-edit-view.tsx`.
- Kept customers-write permission, promised params, and target/current user ID
  passing in the route; preserved role/status self-lock behavior and exact output.
- Scoped ESLint, full frontend typecheck, ownership/stale-import searches, and
  `git diff --check` passed.

## Task 046l - Thin Order-Detail Route

**Status:** Complete
**Date:** 2026-07-14

- Extracted admin order fetch/404 handling, header, status/actions, invoice table,
  totals, and summary into server-only `order-detail-view.tsx`.
- Kept orders-read permission, promised params, positive integer validation, and
  orders-write capability in the route; preserved the `OrderActions` client island.
- Scoped ESLint, full frontend typecheck, ownership/stale-import searches, and
  `git diff --check` passed.

## Task 046m - Thin Roles Route

**Status:** Complete
**Date:** 2026-07-14

- Extracted static role summaries, member counts, permission percentages, and the
  complete access matrix into server-only `roles-view.tsx`.
- Kept roles-manage permission in the route and preserved all existing sample
  data, copy, ordering, styles, and table output for later backend alignment work.
- Scoped ESLint, full frontend typecheck, ownership/stale-import searches, and
  `git diff --check` passed.

## Task Group 046 - Acceptance Verification

**Status:** Complete
**Date:** 2026-07-14

- All 13 scoped admin routes retain their page-level permission guards and only
  route-owned params, search params, ID validation, and capability computations.
- Ten feature-owned views are explicit Server Components; shared product, category,
  and recipe loaders preserve existing failure behavior.
- Customer unavailable states, order ID/404 behavior, headers, tables, forms,
  Suspense boundaries, pagination, and client action islands are preserved.
- Independent review found no blockers or major defects.
- Frontend typecheck, 13 tests, production build, ownership searches, and
  `git diff --check` passed.
- Full lint passed with zero errors and 11 unrelated existing warnings.

## Task 044a - Extract Settings Validation

**Status:** Complete
**Date:** 2026-07-14

- Moved the flat settings form schema and inferred value type into canonical
  settings ownership.
- Preserved every trim, refinement, Persian message, default, wholesale payload,
  and backend field-error mapping.
- Deleted the empty admin-owned validation placeholder.
- Scoped ESLint passed with no new warnings; full typecheck, ownership search, and
  `git diff --check` passed.

## Task 044b - Extract Brand Validation

**Status:** Complete
**Date:** 2026-07-14

- Moved the brand form schema, inferred values, and shared current-year boundary
  into catalog brand ownership.
- Preserved URL matching, year refinement, Persian messages, defaults, and null
  payload conversion.
- Deleted the empty admin-owned validation placeholder.
- Scoped ESLint passed with no new warnings; full typecheck and diff check passed.

## Task 044c - Extract Customer Validation

**Status:** Complete
**Date:** 2026-07-14

- Moved the exact customer-edit schema and inferred values into customer ownership.
- Preserved role/gender constraints, digit/date conversion, self-edit restrictions,
  and backend field-error mapping.
- Deleted the empty admin-owned validation placeholder.
- Scoped ESLint, full typecheck, and ownership search passed.

## Task 044d - Extract Recipe Validation

**Status:** Complete
**Date:** 2026-07-14

- Moved recipe, ingredient, and linked-product form schemas into recipe ownership.
- Preserved integer refinements, rich-text checks, UI-only picker fields, inferred
  nested form types, and complete replacement payload behavior.
- Deleted the empty admin-owned validation placeholder.
- Scoped ESLint passed with no new warnings; full typecheck, ownership search, and
  `git diff --check` passed.

## Task 044e - Extract Hero-Slide Validation

**Status:** Complete
**Date:** 2026-07-14

- Moved the exact hero-slide form schema and inferred values into hero-slide
  ownership.
- Preserved trim differences, string-integer refinement, omitted scheduling fields,
  complete payload behavior, and backend field mapping.
- Deleted the empty admin-owned validation placeholder.
- Scoped ESLint passed with no new warnings; full typecheck and ownership search
  passed.

## Task 044f - Extract Category Validation

**Status:** Complete
**Date:** 2026-07-14

- Moved the exact category form schema and inferred values into catalog category
  ownership.
- Preserved unrestricted numeric strings, relative uploaded image paths, Persian
  messages, defaults, and payload conversion behavior.
- Deleted the empty admin-owned validation placeholder.
- Scoped ESLint passed with no new warnings; full typecheck, ownership search, and
  `git diff --check` passed.

## Task 044g - Extract Address Validation

**Status:** Complete
**Date:** 2026-07-14

- Moved the exact account address form schema and exported value type into address
  ownership.
- Preserved Iran-specific phone/postal rules, required province, country injection,
  defaults, and complete update payload behavior.
- Deleted the empty account-owned validation placeholder.
- Scoped ESLint, full typecheck, ownership search, and `git diff --check` passed.

## Task 044h - Extract Profile Validation

**Status:** Complete
**Date:** 2026-07-14

- Moved the exact account-settings profile schema and inferred values into profile
  ownership.
- Preserved trimmed name requirements, optional phone semantics, null payload
  conversion, and existing profile mutation behavior.
- Deleted the empty account-settings validation placeholder.
- Scoped ESLint, full typecheck, ownership search, and `git diff --check` passed.

## Task Group 044 - Acceptance Verification

**Status:** Complete
**Date:** 2026-07-14

- All eight active forms now import schemas from canonical business-domain
  validation modules; no reviewed form defines its schema inline.
- All eight empty wrong-owner admin/account validation placeholders were deleted.
- Added eight focused extraction-contract tests, including task-start settings and
  customer boundaries that intentionally differ from `HEAD`.
- Frontend tests passed: 2 files, 13 tests.
- Frontend typecheck and production build passed.
- Full lint passed with zero errors and 11 unrelated existing warnings.
- Full backend `go test ./...` passed.
- Independent acceptance review found no production-code blockers or major defects;
  its test-boundary recommendation was implemented and verified.
- Ownership searches and `git diff --check` passed.

## Task 045a - Thin Home Route

**Status:** Complete
**Date:** 2026-07-14

- Extracted the live async home composition into the feature-owned
  `home-view.tsx` Server Component.
- Kept `revalidate = 300` in the route and preserved concurrent API ownership
  changes, rendering, ordering, conditional output, and existing client islands.
- Scoped ESLint, full frontend typecheck, route-ownership/stale-import searches,
  and `git diff --check` passed.

## Task 045b - Thin Search Route

**Status:** Complete
**Date:** 2026-07-14

- Extracted the live search data orchestration and complete result/empty/idle
  rendering into the storefront search-owned Server Component.
- Kept metadata in the route and passed the promised `searchParams` contract
  unchanged to the view, preserving request-time rendering and query behavior.
- Scoped ESLint, full frontend typecheck, ownership/stale-import searches, and
  `git diff --check` passed.

## Task 045c - Thin Product-List Route

**Status:** Complete
**Date:** 2026-07-14

- Extracted the live product-list fetching, URL-state handling, JSON-LD,
  pagination, and complete rendered composition into `product-list-view.tsx`.
- Kept metadata in the route and forwarded the promised `searchParams` contract
  unchanged, including current sorting fields and client sort island.
- Scoped ESLint, full frontend typecheck, ownership/stale-import searches, and
  `git diff --check` passed.

## Task 045d - Thin Product-Detail Route

**Status:** Complete
**Date:** 2026-07-14

- Extracted the live product-detail lookup, `notFound`, transformations, JSON-LD,
  reviews, recommendations, and rendered composition into the product-owned view.
- Kept `revalidate`, `generateStaticParams`, and `generateMetadata` in the route;
  forwarded the original promised params and preserved all client islands.
- Scoped ESLint, full frontend typecheck, route-convention/ownership searches,
  and `git diff --check` passed.

## Task 045e - Thin Category-Index Route

**Status:** Complete
**Date:** 2026-07-14

- Extracted the live category directory orchestration, JSON-LD, and rendering
  into `category-index-view.tsx`.
- Moved the inline card into `category-directory-card.tsx` without changing its
  rendered markup or the audited `src={null}` image fallback.
- Kept metadata and `revalidate` in the route; scoped ESLint, full frontend
  typecheck, ownership/fallback searches, and `git diff --check` passed.

## Task 045f - Thin Category-Detail Route

**Status:** Complete
**Date:** 2026-07-14

- Extracted the live category lookup, `notFound`, product query, JSON-LD, and
  rendered composition into `category-detail-view.tsx`.
- Kept `revalidate`, static params, and metadata generation in the route and
  forwarded the promised params contract unchanged.
- Scoped ESLint, full frontend typecheck, route-convention/ownership searches,
  and `git diff --check` passed.

## Task 045g - Thin Recipe-List Route

**Status:** Complete
**Date:** 2026-07-14

- Extracted the live recipe URL parsing, fetching, spotlight, filters, JSON-LD,
  cards, empty state, and pagination into `recipe-list-view.tsx`.
- Kept metadata and `revalidate` in the route and forwarded the exact promised
  search-parameter contract while preserving the filter client island.
- Scoped ESLint, full frontend typecheck, ownership/stale-import searches, and
  `git diff --check` passed.

## Task 045h - Thin Recipe-Detail Route

**Status:** Complete
**Date:** 2026-07-14

- Extracted the live recipe lookup, `notFound`, structured data, content,
  ingredient/shop/related composition into `recipe-detail-view.tsx`.
- Moved the inline shoppable product card unchanged into its named recipe-owned
  component, preserving image, price, unavailable, and add-to-cart behavior.
- Kept revalidation, static params, and metadata generation in the route; scoped
  ESLint, full typecheck, ownership searches, and `git diff --check` passed.

## Task 045i - Thin Journal-List Route

**Status:** Complete
**Date:** 2026-07-14

- Extracted the live journal page parsing, fetching, featured-story selection,
  JSON-LD, explorer, empty state, and pagination into `journal-list-view.tsx`.
- Kept metadata and `revalidate` in the route and forwarded the existing promised
  page parameter unchanged, preserving the explorer client island.
- Scoped ESLint, full frontend typecheck, ownership/stale-import searches, and
  `git diff --check` passed.

## Task 045j - Thin Journal-Detail Route

**Status:** Complete
**Date:** 2026-07-14

- Extracted the live journal lookup, `notFound`, product/related hydration,
  BlogPosting JSON-LD, article body, share, shop, and read-next composition.
- Moved the inline article product card unchanged into its journal-owned file,
  preserving image, price, active-variant, add-to-cart, and link fallbacks.
- Kept revalidation, static params, and metadata generation in the route; scoped
  ESLint, full typecheck, ownership searches, and `git diff --check` passed.

## Task 045k - Thin Checkout-Confirmation Route

**Status:** Complete
**Date:** 2026-07-14

- Extracted order validation, authenticated lookup, 404-only translation,
  delivery formatting, totals, and rendered confirmation into the orders view.
- Kept the route awaiting the promised `id` and rendering the view; verified the
  `getAccountOrder -> apiFetch` path still injects auth and defaults to no-store.
- Scoped ESLint, full frontend typecheck, auth/cache/ownership searches, and
  `git diff --check` passed.

## Task 045l - Thin FAQ Route

**Status:** Complete
**Date:** 2026-07-14

- Extracted all live FAQ types, groups, exact hard-coded copy, FAQ/breadcrumb
  JSON-LD, grouped accordions, and support CTA into `faq-view.tsx`.
- Kept metadata and daily `revalidate` in the route and preserved the existing
  accordion client island and rendered ordering.
- Scoped ESLint, full frontend typecheck, content/ownership searches, and
  `git diff --check` passed.

## Task 045m - Thin About Route

**Status:** Complete
**Date:** 2026-07-14

- Extracted all live About constants, exact hard-coded copy, organization and
  breadcrumb JSON-LD, image paths, sections, and CTAs into `about-view.tsx`.
- Kept metadata and daily `revalidate` in the route and preserved the complete
  rendered ordering and motion composition.
- Scoped ESLint, full frontend typecheck, content/ownership searches, and
  `git diff --check` passed.

## Task Group 045 - Acceptance Verification

**Status:** Complete
**Date:** 2026-07-14

- All 13 storefront routes retain only Next route conventions and minimal feature
  view composition.
- Metadata, revalidation, static params, dynamic metadata, promised route props,
  JSON-LD, not-found behavior, cache boundaries, and client islands were preserved.
- Independent review found no blockers or major defects; its canonical recently
  viewed slug correction was implemented.
- Frontend typecheck, tests, production build, ownership searches, and
  `git diff --check` passed.
- Full lint passed with zero errors and 11 unrelated existing warnings.

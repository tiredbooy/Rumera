// Package models holds **cross-feature shared** types only.
//
// After the feature-architecture migration, domain entities and most
// request/response DTOs live next to their feature under
// internal/features/<name>/. This package is intentionally small:
//
//   - Sentinel errors used by multiple features (errors.go)
//   - List/pagination query helpers (filter.go, pagination.go)
//   - NullablePatch for PATCH omit-vs-null (nullable_patch.go)
//   - PaymentMethod shared by orders + payments (payment_method.go)
//   - Catalogue wire DTOs still shared across product/variant/media
//     (product_response.go, product_image.go) — moving these would force
//     import cycles; keep them here until a dedicated shared catalogue
//     types package is justified
//   - TaxRate constant used at checkout (tax.go)
//
// Rules for new code:
//
//  1. Prefer feature-local types for anything owned by one domain.
//  2. Put a type here only if two features need it and moving it would
//     create a cycle (or the type is a pure shared primitive).
//  3. Wire JSON tags on types here are part of the public API contract —
//     change only with intentional dual-doc.
//  4. Never put SQL or Gin types in this package.
//
// See apps/backend/docs/conventions.md § "Models ownership" and
// architecture/domain-map.md.
package models

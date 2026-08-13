// Package catalog is the umbrella for shop catalogue domains.
//
// Subpackages:
//   - product  — products and product aggregates
//   - variant  — product variants / SKUs
//   - option   — option types and values
//   - category — category tree
//   - brand    — brands
//   - tag      — product tags
//
// These live under one umbrella because they are tightly coupled and share
// storefront/admin catalogue contracts. Do not add loosely related domains here.
//
// See refactor-workstreams/backend-feature-architecture/CHARTER.md.
package catalog

// Package inventory is the vertical slice for stock levels, movements, and
// order lifecycle reserve/release/deduct.
//
// Ownership: model, repository (+ movement reads), service, mapper, handler,
// routes. Orders and payments call Service lifecycle methods under tx.
// Cart/variant/alerts may use Repository for stock reads / EnsureForVariant.
// Catalogue product writes call package-level EnsureForVariantTx in the same TX.
//
// Read order: doc.go → routes.go → handler.go → service.go → repository.go → model.go.
//
// See refactor-workstreams/backend-feature-architecture/CHARTER.md.
package inventory

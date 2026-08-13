// Package cart is the vertical slice for the customer shopping cart.
//
// Ownership: model, repository, service, handler, routes.
// Orders read cart items via Repository (GetOrCreate / GetItems / Clear under tx).
// Catalog variants stay on catalog/variant (migrated).
// Inventory stock checks use inventory.Repository (downward).
//
// Read order: doc.go → routes.go → handler.go → service.go → repository.go → model.go.
//
// See refactor-workstreams/backend-feature-architecture/CHARTER.md.
package cart

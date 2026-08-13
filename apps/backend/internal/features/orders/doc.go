// Package orders is the vertical slice for checkout order creation and lifecycle.
//
// Ownership: model, repository (+ item bulk create), service, mapper, handler, routes.
// Downward deps: cart, coupons, shipping, addresses, inventory, payments.
// Payments depend on Repository.MarkAsPaid / GetStockLines (not this package) to
// avoid an import cycle.
//
// Read order: doc.go → routes.go → handler.go → service.go → repository.go → model.go.
//
// See refactor-workstreams/backend-feature-architecture/CHARTER.md.
package orders

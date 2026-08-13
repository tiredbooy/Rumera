// Package addresses is the vertical slice for customer shipping addresses.
//
// Ownership:
//   - model.go / repository.go / service.go — domain + SQL + rules
//   - handler.go / routes.go — HTTP + RegisterCustomer
//
// Orders depend on Service.GetByID (via a narrow interface) for checkout region.
//
// Read order: doc.go → routes.go → handler.go → service.go → repository.go → model.go.
//
// See refactor-workstreams/backend-feature-architecture/CHARTER.md.
package addresses

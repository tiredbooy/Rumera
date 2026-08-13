// Package wishlist is the vertical slice for the customer wishlist.
//
// Ownership:
//   - model.go / repository.go / service.go — domain + SQL + rules
//   - mapper.go / handler.go / routes.go — HTTP + RegisterCustomer
//
// Each user has exactly one wishlist (get-or-create). Items are product variants.
//
// Read order: doc.go → routes.go → handler.go → service.go → repository.go → model.go.
//
// See refactor-workstreams/backend-feature-architecture/CHARTER.md.
package wishlist

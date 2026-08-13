// Package reviews is the vertical slice for product reviews (ratings, reactions, images).
//
// Ownership: model, repository (+ images), service, mapper, handler, routes.
//
// Read order: doc.go → routes.go → handler.go → service.go → repository.go → model.go.
//
// See refactor-workstreams/backend-feature-architecture/CHARTER.md.
package reviews

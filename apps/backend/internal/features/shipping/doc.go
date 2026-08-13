// Package shipping is the vertical slice for shipping zones, methods, and
// checkout rate estimation.
//
// Ownership: model, zone + method repositories, service (+ validation), mapper,
// handler, routes. Orders authorize methods via Service.AuthorizeCheckoutMethod
// (downward dependency; no HTTP).
//
// Read order: doc.go → routes.go → handler.go → service.go → repository → model.go.
//
// See refactor-workstreams/backend-feature-architecture/CHARTER.md.
package shipping

// Package coupons is the vertical slice for discount coupons (admin CRUD + checkout validate).
//
// Ownership: model, repository (+ usage), service, mapper, handler, routes.
// Orders redeem coupons via Repository/UsageRepository (LockByID, usage counts under tx).
//
// Read order: doc.go → routes.go → handler.go → service.go → repository.go → model.go.
//
// See refactor-workstreams/backend-feature-architecture/CHARTER.md.
package coupons

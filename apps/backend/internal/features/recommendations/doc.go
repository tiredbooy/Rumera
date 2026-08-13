// Package recommendations is the vertical slice for product recommendations
// (trending, similar, FBT, for-you profiles, interactions, admin ops stats).
//
// Ownership: model, repository, service, handler, routes.
// Cron profile refresh (internal/corn) depends on Service.RefreshActiveProfiles.
//
// Read order: doc.go → routes.go → handler.go → service.go → repository.go → model.go.
//
// See refactor-workstreams/backend-feature-architecture/CHARTER.md.
package recommendations

// Package hero is the vertical slice for home-page hero carousel slides.
//
// Ownership: model, repository, service (+ validation), mapper, handler, routes.
// Media cleanup uses a narrow MediaCleaner interface (satisfied by
// media.LifecycleService).
//
// Read order: doc.go → routes.go → handler.go → service.go → repository.go → model.go.
//
// See refactor-workstreams/backend-feature-architecture/CHARTER.md.
package hero

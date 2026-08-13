// Package blog is the vertical slice for the journal (posts + categories).
//
// Ownership: model, repository (posts + categories), service, mapper, handler, routes.
// Image cleanup uses MediaCleaner (media.LifecycleService).
//
// Read order: doc.go → routes.go → handler.go → service.go → repository.go → model.go.
//
// See refactor-workstreams/backend-feature-architecture/CHARTER.md.
package blog

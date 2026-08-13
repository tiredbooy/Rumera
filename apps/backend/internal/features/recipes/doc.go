// Package recipes is the vertical slice for cocktail recipes (content + shoppable products).
//
// Ownership: model, repository, service, mapper, handler, routes.
// Image cleanup uses MediaCleaner (media.LifecycleService).
// Public detail is Redis-cached (singleflight stampede protection) with eager invalidation on write.
//
// Read order: doc.go → routes.go → handler.go → service.go → repository.go → model.go.
//
// See refactor-workstreams/backend-feature-architecture/CHARTER.md.
package recipes

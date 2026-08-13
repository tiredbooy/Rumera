// Package site_settings is the vertical slice for the storefront configuration document.
//
// Ownership:
//   - model / repository / service — singleton JSONB document
//   - mapper / handler / routes — public GET + admin GET/PUT
//
// Public GET is read-through cached (Redis) with singleflight stampede protection;
// admin writes invalidate the cache key.
//
// Read order: doc.go → routes.go → handler.go → service.go → repository.go → model.go.
//
// See refactor-workstreams/backend-feature-architecture/CHARTER.md.
package site_settings

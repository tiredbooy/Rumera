// Package media is the vertical slice for image upload, transforms, lifecycle
// cleanup, and content-owner attachments.
//
// Ownership: service (+ lifecycle, keys, validation), repositories (lifecycle +
// content attach), handler, routes. ProductImage rows stay on models/catalog
// repositories until the catalog feature migrates.
//
// Consumers (downward): hero/blog/recipes MediaCleaner; product/variant/category
// services use LifecycleService / Service.
//
// Read order: doc.go → routes.go → handler.go → service.go → lifecycle.go.
//
// See refactor-workstreams/backend-feature-architecture/CHARTER.md.
package media

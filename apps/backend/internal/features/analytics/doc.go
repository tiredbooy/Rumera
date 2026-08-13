// Package analytics is the vertical slice for admin analytics dashboards and
// the stats/event services that feed them (and cron roll-ups).
//
// Ownership: event + daily product/revenue stats + search summary models,
// repositories, services, HTTP handler, routes.
//
// Capture path: internal/analytics.Queue still owns async event buffering and
// flushes via EventService.FlushEvents (downward dependency; no HTTP).
// Cron jobs in internal/corn call the stats services for roll-ups.
//
// Read order: doc.go → routes.go → handler.go → *_service.go → *_repository.go → model_*.go.
//
// See refactor-workstreams/backend-feature-architecture/CHARTER.md.
package analytics

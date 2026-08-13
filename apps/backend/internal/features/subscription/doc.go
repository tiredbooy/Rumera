// Package subscription is the vertical slice for recurring physical "cellar box"
// subscriptions (e-com box model: cadence, pause/skip/cancel, renewal email).
//
// Non-goals: unlimited catalog access, streaming entitlements, seat-based SaaS.
// Charging is intentionally NOT done by the renewal cron (email + date roll only).
// PH-043c closed: no tokenized auto-charge until re-open criteria in
// docs/architecture/box-auto-charge-decision.md.
//
// Cron job uses Repository from bootstrap (internal/corn/subscription_renewal_job.go).
// Product model: apps/backend/docs/architecture/box-subscriptions.md
// Read: doc.go → routes.go → handler.go → service.go → repository.go → model.go
package subscription

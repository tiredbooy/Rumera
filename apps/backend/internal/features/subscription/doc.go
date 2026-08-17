// Package subscription is the vertical slice for recurring physical "cellar box"
// subscriptions (e-com box model: cadence, pause/skip/cancel, renewal email).
//
// Non-goals: unlimited catalog access, streaming entitlements, seat-based SaaS.
// Charging is intentionally NOT done by the renewal cron (email + date roll only).
// PH-043c closed: no tokenized auto-charge until re-open criteria in
// docs/architecture/box-auto-charge-decision.md.
//
// PR-057b: at most one status=active cellar-box per customer. A second
// POST /subscriptions (or resume that would make two actives) is 409 CONFLICT.
// Paused / cancelled rows do not occupy the slot.
// PR-057a: ProcessDueRenewals advances next_renewal_at only after a successful
// send. Nil mailer or Send error leaves the row due (same honesty as PR-053a).
// PR-055a: cron prefers notifications.Dispatcher (DueMailer) when wired; inline
// mailer is the fallback. Dispatch/send failure still leaves the row due.
// Cron job uses Repository from bootstrap (internal/corn/subscription_renewal_job.go).
// Product model: apps/backend/docs/architecture/box-subscriptions.md
// Read: doc.go → routes.go → handler.go → service.go → renewal.go → repository.go → model.go
package subscription

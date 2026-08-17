// Package loyalty is the vertical slice for the points / Cellar Club programme.
//
// Read: doc.go → routes.go → handler.go → service.go → repository.go → model.go
// Dependents: referral awards, auth signup bonus (AwardSignup), payment earn hooks.
// Admin: programme snapshot + PUT rates/tiers/enabled (PR-003f),
// member search / account / paginated ledger (PR-003d),
// and POST /admin/users/:userID/loyalty/adjust grant/clawback (PR-003e).
// Customer GET /loyalty/transactions is paginated {results, pagination}
// and includes id / ref_type / ref_id (PR-003j).
// See refactor-workstreams/backend-feature-architecture/CHARTER.md.
package loyalty

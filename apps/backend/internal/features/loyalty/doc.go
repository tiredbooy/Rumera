// Package loyalty is the vertical slice for the points / Cellar Club programme.
//
// Read: doc.go → routes.go → handler.go → service.go → repository.go → model.go
// Dependents: referral awards, auth signup bonus (AwardSignup), payment earn hooks.
// Admin: programme snapshot + PUT rates/tiers/enabled (PR-003f),
// member search / account / paginated ledger (PR-003d) — ledger rows carry the
// staff note and a name-snapshotted actor (L-4),
// programme operations at GET /admin/loyalty/overview: points liability, tier
// distribution, birthday-job health (L-9),
// and POST /admin/users/:userID/loyalty/adjust grant/clawback (PR-003e).
// Customer GET /loyalty/transactions is paginated {results, pagination}
// and includes id / ref_type / ref_id (PR-003j).
// See refactor-workstreams/backend-feature-architecture/CHARTER.md.
package loyalty

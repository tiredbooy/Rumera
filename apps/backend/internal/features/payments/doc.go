// Package payments is the vertical slice for payment transactions and gateway webhooks.
//
// Ownership: model, repository, service, mapper, handler, webhook, routes.
// Orders create pending payments via Service.Create; webhooks Confirm/Fail.
// Inventory deduct/release and loyalty/referral hooks stay on Service.
//
// Read order: doc.go → routes.go → handler.go → webhook.go → service.go → repository.go → model.go.
//
// See refactor-workstreams/backend-feature-architecture/CHARTER.md.
package payments

// Package payments is the vertical slice for payment transactions and gateway webhooks.
//
// Ownership: model, repository, service, mapper, handler, webhook, routes.
// Orders create pending payments via Service.Create; webhooks Confirm/Fail.
// Inventory deduct/release stay on Service. Order earn is a same-TX
// payment_loyalty_awards row + post-commit retry (PR-003h); Confirm never
// fails because AwardForOrder failed after the money TX committed.
// After commit, order checkouts also record recs purchase interactions
// (PR-050d) and send the paid receipt email (PR-020o); failures are logged
// and do not undo payment. Unpaid POST /orders does not send a receipt.
//
// # payment_transactions is the GATEWAY ledger, not the paid ledger (A-5)
//
// The wallet rail settles inside the order transaction and deliberately writes
// NO payment_transactions row (orders.settleWalletInTx). So this table answers
// "what did the PSP do", never "was this order paid".
//
// Therefore: never hook Confirm to add a post-payment feature. Subscribe to
// order.paid.v1 instead — both rails emit it, on the same order-keyed
// idempotency key, inside the same transaction as the money. Loyalty and
// recommendations were each wired to Confirm once and each silently skipped
// every wallet buyer until they were moved onto the fact.
//
// Not "give wallet a row" because the row is load-bearing gateway state, not a
// receipt: attachPaymentURL builds a live pay-start link from transaction_id
// for every row it returns, and Confirm prefix-routes on transaction_id with a
// default branch that CREDITS WALLET BALANCE. A synthetic wallet row would put
// fabricated identifiers into a namespace that is addressable from the webhook.
// Nothing sums this table for revenue either — reporting reads the analytics
// events stream, which already buckets wallet separately.
//
// Read order: doc.go → routes.go → handler.go → webhook.go → service.go → repository.go → model.go.
//
// See refactor-workstreams/backend-feature-architecture/CHARTER.md.
package payments

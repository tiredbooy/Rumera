// Package wallet is the vertical slice for customer wallet balance and ledger.
//
// Ownership:
//   - model / repository / service — balance mutations + transactions
//   - handler / routes — customer read + admin credit
//
// Self-service deposit was removed (free-money risk). Credit flows from
// payments, refunds, gift/loyalty redemption, or admin credit.
//
// Dependents (call Service methods): loyalty redemption, gift-card (constructor
// signature), orders checkout via PurchaseTx (same TX as mark paid + deduct).
//
// Read order: doc.go → routes.go → handler.go → service.go → repository.go.
//
// See refactor-workstreams/backend-feature-architecture/CHARTER.md.
package wallet

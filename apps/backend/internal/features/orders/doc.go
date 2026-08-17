// Package orders is the vertical slice for checkout order creation and lifecycle.
//
// Ownership: model, repository (+ item bulk create), service, mapper, handler, routes.
// Downward deps: cart, coupons, shipping, addresses, inventory, payments
// (CreateTx pending intent in the create TX; POST /orders/:id/pay),
// wallet (WalletPurchaser.PurchaseTx on wallet checkout; WalletRefunder.Refund
// on admin POST /admin/orders/:id/refund — type-asserted; nil-safe for other rails),
// loyalty (orderEarnClawback on the refund command; nil-safe).
// Payments depend on Repository.MarkAsPaid / GetStockLines (not this package) to
// avoid an import cycle. The paid receipt email is orders.ReceiptSender,
// attached to payments.Confirm (and wallet-paid POST /orders). Pending create
// does not send (PR-020o).
//
// Read order: doc.go → routes.go → handler.go → service.go → repository.go → model.go.
//
// See refactor-workstreams/backend-feature-architecture/CHARTER.md.
package orders

package models

// TaxRate is applied to the post-discount subtotal at checkout.
// Shared by order pricing (not a feature-local constant) so wallet/payment
// docs and services can reference the same figure without importing orders.
const TaxRate = 0.08

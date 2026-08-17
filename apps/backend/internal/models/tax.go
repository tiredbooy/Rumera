package models

// TaxRate is applied at checkout to post-discount merchandise plus any
// selected gift add-on fees (IR VAT-style on the paid add-on). Shipping
// is excluded. The rate is not admin-editable.
// Shared by order pricing (not a feature-local constant) so wallet/payment
// docs and services can reference the same figure without importing orders.
const TaxRate = 0.08

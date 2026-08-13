package models

// PaymentMethod is the settlement rail chosen at checkout / recorded on payments.
// Shared by orders and payments (lives in models to avoid an import cycle).
type PaymentMethod string

const (
	PaymentMethodCard         PaymentMethod = "card"
	PaymentMethodCrypto       PaymentMethod = "crypto"
	PaymentMethodBankTransfer PaymentMethod = "bank_transfer"
	PaymentMethodWallet       PaymentMethod = "wallet"
	PaymentMethodGateway      PaymentMethod = "gateway"
)

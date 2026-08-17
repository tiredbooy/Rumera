package alerts

import "time"

// AlertType enumerates the kinds of product alerts a customer can subscribe to.
type AlertType string

const (
	AlertRestock   AlertType = "restock"
	AlertPriceDrop AlertType = "price_drop"
)

// ProductAlert is a customer's subscription to be notified about a variant.
// ProductTitle / ProductSlug / CurrentPrice are hydrated on list (JOIN);
// create RETURNING leaves them nil.
type ProductAlert struct {
	ID               int64      `db:"id"`
	UserID           int64      `db:"user_id"`
	ProductVariantID int64      `db:"product_variant_id"`
	AlertType        AlertType  `db:"alert_type"`
	TargetPrice      *float64   `db:"target_price"`
	ReferencePrice   float64    `db:"reference_price"`
	NotifiedAt       *time.Time `db:"notified_at"`
	CreatedAt        time.Time  `db:"created_at"`
	ProductTitle     *string    `db:"product_title"`
	ProductSlug      *string    `db:"product_slug"`
	CurrentPrice     *float64   `db:"current_price"`
}

// CreateProductAlertReq is the payload for subscribing to a product alert.
type CreateProductAlertReq struct {
	ProductVariantID int64     `json:"product_variant_id" validate:"required,min=1"`
	AlertType        AlertType `json:"alert_type"         validate:"required,oneof=restock price_drop"`
	TargetPrice      *float64  `json:"target_price"       validate:"omitempty,min=0"`
}

// ProductAlertResponse is the customer-facing view of a product alert.
// GET /alerts hydrates product_title, product_slug, and current_price
// (the subscribed variant's live price) so the account list needs no second hop.
type ProductAlertResponse struct {
	ID               int64      `json:"id"`
	ProductVariantID int64      `json:"product_variant_id"`
	AlertType        AlertType  `json:"alert_type"`
	TargetPrice      *float64   `json:"target_price"`
	NotifiedAt       *time.Time `json:"notified_at"`
	CreatedAt        time.Time  `json:"created_at"`
	ProductTitle     *string    `json:"product_title"`
	ProductSlug      *string    `json:"product_slug"`
	CurrentPrice     *float64   `json:"current_price"`
}

// PendingAlert is a satisfied alert row joined with everything the notifier
// needs to send the email and link back to the product.
type PendingAlert struct {
	ID           int64     `db:"id"`
	Email        string    `db:"email"`
	AlertType    AlertType `db:"alert_type"`
	ProductTitle string    `db:"product_title"`
	ProductSlug  *string   `db:"product_slug"`
	CurrentPrice float64   `db:"current_price"`
}

package orders

import (
	"time"

	"github.com/tiredbooy/internal/models"
)

type OrderStatus string

const (
	OrderStatusPending           OrderStatus = "pending"
	OrderStatusPaymentFailed     OrderStatus = "payment_failed"
	OrderStatusPaid              OrderStatus = "paid"
	OrderStatusProcessing        OrderStatus = "processing"
	OrderStatusReadyToShip       OrderStatus = "ready_to_ship"
	OrderStatusShipped           OrderStatus = "shipped"
	OrderStatusOutForDelivery    OrderStatus = "out_for_delivery"
	OrderStatusDelivered         OrderStatus = "delivered"
	OrderStatusRefundRequested   OrderStatus = "refund_requested"
	OrderStatusRefundApproved    OrderStatus = "refund_approved"
	OrderStatusRefunded          OrderStatus = "refunded"
	OrderStatusPartiallyRefunded OrderStatus = "partially_refunded"
	OrderStatusCancelled         OrderStatus = "cancelled"
)

type Order struct {
	ID               int64         `db:"id"`
	UserID           int64         `db:"user_id"`
	AddressID        *int64        `db:"address_id"`
	Status           OrderStatus   `db:"status"`
	PaymentMethod    models.PaymentMethod `db:"payment_method"`
	Subtotal         float64       `db:"subtotal"`
	DiscountAmount   float64       `db:"discount_amount"`
	ShippingCost     float64       `db:"shipping_cost"`
	TaxAmount        float64       `db:"tax_amount"`
	TotalAmount      float64       `db:"total_amount"`
	CouponID         *int64        `db:"coupon_id"`
	ShippingMethodID *int64        `db:"shipping_method_id"`
	Notes            *string       `db:"notes"`

	IsGift                bool       `db:"is_gift"`
	GiftMessage           *string    `db:"gift_message"`
	GiftWrap              bool       `db:"gift_wrap"`
	HidePrice             bool       `db:"hide_price"`
	GiftAddonsFee         float64    `db:"gift_addons_fee"`
	// GiftAddons is a JSON snapshot of selected modular gift options (id/label/price).
	GiftAddons            []byte     `db:"gift_addons"`
	ScheduledDeliveryDate *time.Time `db:"scheduled_delivery_date"`

	PaidAt           *time.Time    `db:"paid_at"`
	ShippedAt        *time.Time    `db:"shipped_at"`
	DeliveredAt      *time.Time    `db:"delivered_at"`
	CancelledAt      *time.Time    `db:"cancelled_at"`
	CreatedAt        time.Time     `db:"created_at"`
	UpdatedAt        time.Time     `db:"updated_at"`
}

type OrderItem struct {
	ID               int64     `db:"id"`
	OrderID          int64     `db:"order_id"`
	ProductID        int64     `db:"product_id"`
	ProductVariantID int64     `db:"product_variant_id"` // ← add this
	Quantity         int       `db:"quantity"`
	UnitPrice        float64   `db:"unit_price"`
	TotalPrice       float64   `db:"total_price"`
	CreatedAt        time.Time `db:"created_at"`
	UpdatedAt        time.Time `db:"updated_at"`
}

type CreateOrderReq struct {
	AddressID        int64         `json:"address_id"         validate:"required,min=1"`
	PaymentMethod    models.PaymentMethod `json:"payment_method"     validate:"required,oneof=card crypto bank_transfer wallet gateway"`
	ShippingMethodID int64         `json:"shipping_method_id" validate:"required,min=1"`
	CouponCode       *string       `json:"coupon_code"`
	Notes            *string       `json:"notes"`

	// Gift mode (all optional).
	IsGift                bool       `json:"is_gift"`
	GiftMessage           *string    `json:"gift_message"            validate:"omitempty,max=500"`
	GiftWrap              bool       `json:"gift_wrap"` // legacy; prefer gift_option_ids
	HidePrice             bool       `json:"hide_price"`
	// GiftOptionIDs selects admin-configured modular gift add-ons (server-priced).
	GiftOptionIDs         []string   `json:"gift_option_ids" validate:"omitempty,dive,max=64"`
	ScheduledDeliveryDate *time.Time `json:"scheduled_delivery_date"`
}

// GiftAddonSnapshot is persisted on the order so admin price/label changes later
// do not rewrite historical invoices.
type GiftAddonSnapshot struct {
	ID    string  `json:"id"`
	Label string  `json:"label"`
	Price float64 `json:"price"`
}

type UpdateOrderStatusReq struct {
	Status OrderStatus `json:"status" validate:"required,oneof=pending payment_failed paid processing ready_to_ship shipped out_for_delivery delivered refund_requested refund_approved refunded partially_refunded cancelled"`
}

type OrderFilter struct {
	models.BaseFilter
	UserID   *int64       `query:"user_id"`
	Status   *OrderStatus `query:"status"`
	PaidFrom *time.Time   `query:"paid_from"`
	PaidTo   *time.Time   `query:"paid_to"`
}

func (f *OrderFilter) Defaults() {
	f.BaseFilter.Defaults("created_at")
}

// internal/models/order.go
type OrderItemResponse struct {
	ID           int64   `json:"id"`
	ProductID    int64   `json:"product_id"`
	VariantID    int64   `json:"variant_id"` // ← add this
	ProductTitle string  `json:"product_title"`
	ImageURL     *string `json:"image_url,omitempty"`
	Quantity     int     `json:"quantity"`
	UnitPrice    float64 `json:"unit_price"`
	TotalPrice   float64 `json:"total_price"`
}
type OrderResponse struct {
	ID             int64               `json:"id"`
	Status         OrderStatus         `json:"status"`
	PaymentMethod  models.PaymentMethod       `json:"payment_method"`
	Subtotal       float64             `json:"subtotal"`
	DiscountAmount float64             `json:"discount_amount"`
	ShippingCost   float64             `json:"shipping_cost"`
	TaxAmount      float64             `json:"tax_amount"`
	TotalAmount    float64             `json:"total_amount"`
	Notes          *string             `json:"notes,omitempty"`

	IsGift                bool                `json:"is_gift,omitempty"`
	GiftMessage           *string             `json:"gift_message,omitempty"`
	GiftWrap              bool                `json:"gift_wrap,omitempty"`
	HidePrice             bool                `json:"hide_price,omitempty"`
	GiftAddonsFee         float64             `json:"gift_addons_fee,omitempty"`
	GiftAddons            []GiftAddonSnapshot `json:"gift_addons,omitempty"`
	ScheduledDeliveryDate *time.Time          `json:"scheduled_delivery_date,omitempty"`

	PaidAt         *time.Time          `json:"paid_at,omitempty"`
	ShippedAt      *time.Time          `json:"shipped_at,omitempty"`
	DeliveredAt    *time.Time          `json:"delivered_at,omitempty"`
	CancelledAt    *time.Time          `json:"cancelled_at,omitempty"`
	CreatedAt      time.Time           `json:"created_at"`
	Items          []OrderItemResponse `json:"items"`
}

type OrderListItem struct {
	ID            int64         `json:"id"`
	Status        OrderStatus   `json:"status"`
	PaymentMethod models.PaymentMethod `json:"payment_method"`
	TotalAmount   float64       `json:"total_amount"`
	ItemCount     int           `json:"item_count"`
	CreatedAt     time.Time     `json:"created_at"`
}

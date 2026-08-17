package orders

import (
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
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
	ID               int64                `db:"id"`
	UserID           int64                `db:"user_id"`
	AddressID        *int64               `db:"address_id"`
	Status           OrderStatus          `db:"status"`
	PaymentMethod    models.PaymentMethod `db:"payment_method"`
	Subtotal         float64              `db:"subtotal"`
	DiscountAmount   float64              `db:"discount_amount"`
	ShippingCost     float64              `db:"shipping_cost"`
	TaxAmount        float64              `db:"tax_amount"`
	TotalAmount      float64              `db:"total_amount"`
	CouponID         *int64               `db:"coupon_id"`
	CouponCode       *string              `db:"coupon_code"`
	ShippingMethodID *int64               `db:"shipping_method_id"`
	Notes            *string              `db:"notes"`

	// Fulfillment snapshots at place-order. Live FKs are ON DELETE SET NULL.
	ShipTo                []byte  `db:"ship_to"`
	ShippingMethodName    *string `db:"shipping_method_name"`
	ShippingMethodCarrier *string `db:"shipping_method_carrier"`

	IsGift        bool    `db:"is_gift"`
	GiftMessage   *string `db:"gift_message"`
	GiftWrap      bool    `db:"gift_wrap"`
	HidePrice     bool    `db:"hide_price"`
	GiftAddonsFee float64 `db:"gift_addons_fee"`
	// GiftAddons is a JSON snapshot of selected modular gift options (id/label/price).
	GiftAddons            []byte     `db:"gift_addons"`
	ScheduledDeliveryDate *time.Time `db:"scheduled_delivery_date"`

	PaidAt      *time.Time `db:"paid_at"`
	ShippedAt   *time.Time `db:"shipped_at"`
	DeliveredAt *time.Time `db:"delivered_at"`
	CancelledAt *time.Time `db:"cancelled_at"`

	// Parcel identifiers (PR-020r). Distinct from shipping_method_carrier.
	TrackingNumber *string `db:"tracking_number"`
	ParcelCarrier  *string `db:"parcel_carrier"`

	CreatedAt time.Time `db:"created_at"`
	UpdatedAt time.Time `db:"updated_at"`

	// Gateway intent (not stored on orders). Set on create / pay / read.
	PaymentID     int64  `db:"-"`
	TransactionID string `db:"-"`
	PaymentURL    string `db:"-"`
	PaymentStatus string `db:"-"`

	// Buyer identity joined at read/create (users.id = orders.user_id).
	Buyer OrderUserIdentity `db:"-"`
}

// ShipToSnapshot is the fulfillable address frozen at place-order.
type ShipToSnapshot struct {
	FullName      string  `json:"full_name"`
	PhoneNumber   *string `json:"phone_number,omitempty"`
	AddressLine1  string  `json:"address_line1"`
	AddressLine2  *string `json:"address_line2,omitempty"`
	City          string  `json:"city"`
	StateProvince *string `json:"state_province,omitempty"`
	PostalCode    string  `json:"postal_code"`
	Country       string  `json:"country"`
}

// OrderUserIdentity is the safe buyer projection on GET (no password / national code).
type OrderUserIdentity struct {
	ID        int64     `json:"id"`
	UserID    uuid.UUID `json:"user_id,omitempty"`
	FirstName *string   `json:"first_name,omitempty"`
	LastName  *string   `json:"last_name,omitempty"`
	Email     string    `json:"email,omitempty"`
	Phone     *string   `json:"phone,omitempty"`
}

// OrderShippingMethod is the method snapshot returned on GET.
type OrderShippingMethod struct {
	ID      int64   `json:"id"`
	Name    string  `json:"name,omitempty"`
	Carrier *string `json:"carrier,omitempty"`
}

// OrderCouponSummary is the coupon code snapshot returned on GET.
type OrderCouponSummary struct {
	ID   int64  `json:"id,omitempty"`
	Code string `json:"code"`
}

// OrderPaymentSummary is the attached gateway intent (PR-020f) when present.
type OrderPaymentSummary struct {
	ID            int64  `json:"id"`
	TransactionID string `json:"transaction_id"`
	Status        string `json:"status,omitempty"`
	PaymentURL    string `json:"payment_url,omitempty"`
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
	AddressID        int64                `json:"address_id"         validate:"required,min=1"`
	PaymentMethod    models.PaymentMethod `json:"payment_method"     validate:"required,oneof=card crypto bank_transfer wallet gateway"`
	ShippingMethodID int64                `json:"shipping_method_id" validate:"required,min=1"`
	CouponCode       *string              `json:"coupon_code"`
	Notes            *string              `json:"notes"`

	// Gift mode (all optional).
	IsGift      bool    `json:"is_gift"`
	GiftMessage *string `json:"gift_message"            validate:"omitempty,max=500"`
	GiftWrap    bool    `json:"gift_wrap"` // legacy; prefer gift_option_ids
	HidePrice   bool    `json:"hide_price"`
	// GiftOptionIDs selects admin-configured modular gift add-ons (server-priced).
	GiftOptionIDs         []string   `json:"gift_option_ids" validate:"omitempty,dive,max=64"`
	ScheduledDeliveryDate *time.Time `json:"scheduled_delivery_date"`

	// Fulfillment snapshots filled by CreateOrder (not client input).
	shipToJSON            []byte  `json:"-"`
	ShippingMethodName    string  `json:"-"`
	ShippingMethodCarrier *string `json:"-"`
	AppliedCouponCode     *string `json:"-"`
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
	// Tracking is optional and only persisted on shipped / out_for_delivery.
	TrackingNumber *string `json:"tracking_number" validate:"omitempty,max=64"`
	ParcelCarrier  *string `json:"parcel_carrier" validate:"omitempty,max=100"`
}

type OrderFilter struct {
	models.BaseFilter
	UserID *int64       `query:"user_id"`
	Status *OrderStatus `query:"status"`
	// Statuses is a comma-separated alternative to Status, for work-queue views
	// that span several states — "paid but not yet shipped" is paid, processing
	// and ready_to_ship, and without this there is no single URL that lists them.
	// A plain string rather than a slice so the generic query binder is untouched;
	// ValidStatuses does the parsing and rejects anything unknown, because
	// orders.status is a Postgres enum and an unknown literal is a 500, not a 400.
	Statuses string       `query:"statuses"`
	PaidFrom *time.Time   `query:"paid_from"`
	PaidTo   *time.Time   `query:"paid_to"`
	// UserUUID filters by the public customer identifier (users.user_id).
	//
	// UserID above filters on the internal bigint, which no customer-facing admin
	// response ever emits — "internal database IDs are never returned"
	// (docs/api/users.md). So the existing filter could only be used by someone
	// who already had an order open, which is the round trip CF-1 is about. This
	// takes the UUID the customers screen actually shows.
	UserUUID string `query:"user_uuid" validate:"omitempty,uuid4"`
	// includeBuyer projects buyer identity onto each row. Unexported on purpose:
	// the query binder skips fields it cannot set (httpx/bind.go `!fv.CanSet()`),
	// and it does NOT treat `query:"-"` as "skip" — that tag would bind from a
	// literal `?-=true`. Unexported is the only spelling a request cannot reach.
	// Same package, so the admin handler and the repository still set and read it.
	includeBuyer bool
}

// AdminListFilter opts a filter into the buyer projection (CF-1).
//
// The flag itself is unexported so no request can set it; this is the only way
// in, which keeps "who sees buyer identity" a decision made in admin handlers
// rather than something a query string can ask for.
func AdminListFilter(f OrderFilter) OrderFilter {
	f.includeBuyer = true
	return f
}

// orderStatusSet is every value the order_status enum accepts.
var orderStatusSet = map[OrderStatus]struct{}{
	OrderStatusPending: {}, OrderStatusPaymentFailed: {}, OrderStatusPaid: {},
	OrderStatusProcessing: {}, OrderStatusReadyToShip: {}, OrderStatusShipped: {},
	OrderStatusOutForDelivery: {}, OrderStatusDelivered: {},
	OrderStatusRefundRequested: {}, OrderStatusRefundApproved: {},
	OrderStatusRefunded: {}, OrderStatusPartiallyRefunded: {},
	OrderStatusCancelled: {},
}

// ValidStatuses parses the Statuses filter, dropping blanks and duplicates.
// Returns an error naming the offender if any value is not a real status, so a
// typo is a 400 instead of reaching Postgres as a bad enum literal.
func (f *OrderFilter) ValidStatuses() ([]OrderStatus, error) {
	if strings.TrimSpace(f.Statuses) == "" {
		return nil, nil
	}
	seen := map[OrderStatus]struct{}{}
	out := make([]OrderStatus, 0, len(orderStatusSet))
	for _, raw := range strings.Split(f.Statuses, ",") {
		s := OrderStatus(strings.TrimSpace(raw))
		if s == "" {
			continue
		}
		if _, ok := orderStatusSet[s]; !ok {
			return nil, fmt.Errorf("%w: unknown order status %q", apperr.ErrInvalidRequest, s)
		}
		if _, dup := seen[s]; dup {
			continue
		}
		seen[s] = struct{}{}
		out = append(out, s)
	}
	return out, nil
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
	ID             int64                `json:"id"`
	Status         OrderStatus          `json:"status"`
	PaymentMethod  models.PaymentMethod `json:"payment_method"`
	PaymentID      int64                `json:"payment_id,omitempty"`
	TransactionID  string               `json:"transaction_id,omitempty"`
	PaymentURL     string               `json:"payment_url,omitempty"`
	Subtotal       float64              `json:"subtotal"`
	DiscountAmount float64              `json:"discount_amount"`
	ShippingCost   float64              `json:"shipping_cost"`
	TaxAmount      float64              `json:"tax_amount"`
	TotalAmount    float64              `json:"total_amount"`
	Notes          *string              `json:"notes,omitempty"`

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
	TrackingNumber *string             `json:"tracking_number,omitempty"`
	ParcelCarrier  *string             `json:"parcel_carrier,omitempty"`
	CreatedAt      time.Time           `json:"created_at"`
	Items          []OrderItemResponse `json:"items"`

	UserID           int64                `json:"user_id"`
	AddressID        *int64               `json:"address_id,omitempty"`
	ShippingMethodID *int64               `json:"shipping_method_id,omitempty"`
	CouponID         *int64               `json:"coupon_id,omitempty"`
	CouponCode       *string              `json:"coupon_code,omitempty"`
	User             *OrderUserIdentity   `json:"user,omitempty"`
	Address          *ShipToSnapshot      `json:"address,omitempty"`
	ShipTo           *ShipToSnapshot      `json:"ship_to,omitempty"`
	ShippingMethod   *OrderShippingMethod `json:"shipping_method,omitempty"`
	Coupon           *OrderCouponSummary  `json:"coupon,omitempty"`
	Payment          *OrderPaymentSummary `json:"payment,omitempty"`
}

type OrderListItem struct {
	ID            int64                `json:"id"`
	Status        OrderStatus          `json:"status"`
	PaymentMethod models.PaymentMethod `json:"payment_method"`
	TotalAmount   float64              `json:"total_amount"`
	ItemCount     int                  `json:"item_count"`
	CreatedAt     time.Time            `json:"created_at"`

	TrackingNumber *string `json:"tracking_number,omitempty"`
	ParcelCarrier  *string `json:"parcel_carrier,omitempty"`

	// Buyer is populated on the admin list only (CF-1). It is the same identity
	// the order DETAIL endpoint already returns under the same orders:read gate,
	// so this exposes no new category of data — it removes the page load per
	// order that reading it used to cost.
	Buyer *OrderUserIdentity `json:"buyer,omitempty"`
}

// allowedPatchTransitions is the warehouse fulfilment graph (PR-020l).
// Money statuses (paid / refunded-family / cancelled) are never PATCH targets;
// unpaid (pending, payment_failed) cannot enter fulfilment via PATCH.
var allowedPatchTransitions = map[OrderStatus][]OrderStatus{
	OrderStatusPaid:           {OrderStatusProcessing},
	OrderStatusProcessing:     {OrderStatusReadyToShip, OrderStatusShipped},
	OrderStatusReadyToShip:    {OrderStatusShipped},
	OrderStatusShipped:        {OrderStatusOutForDelivery, OrderStatusDelivered},
	OrderStatusOutForDelivery: {OrderStatusDelivered},
}

// canPatchTransition reports whether PATCH may move from → to.
func canPatchTransition(from, to OrderStatus) bool {
	for _, allowed := range allowedPatchTransitions[from] {
		if allowed == to {
			return true
		}
	}
	return false
}

// canPersistParcelTracking is true for warehouse ship hops (PR-020r).
// Other PATCH targets ignore tracking fields so existing labels stay put.
func canPersistParcelTracking(status OrderStatus) bool {
	return status == OrderStatusShipped || status == OrderStatusOutForDelivery
}

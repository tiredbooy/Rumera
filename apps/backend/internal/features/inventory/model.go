package inventory

import (
	"sort"
	"time"

	"github.com/tiredbooy/internal/models"
)

type MovementType string

const (
	MovementTypePurchase    MovementType = "purchase"
	MovementTypeRestock     MovementType = "restock"
	MovementTypeRefund      MovementType = "refund"
	MovementTypeAdjustment  MovementType = "adjustment"
	MovementTypeReservation MovementType = "reservation"
	MovementTypeRelease     MovementType = "release"
	MovementTypeDamage      MovementType = "damage"
)

type Inventory struct {
	ID               int64   `db:"id"`
	ProductVariantID int64   `db:"product_variant_id"`
	ProductID        int64   `db:"product_id"`
	ProductTitle     string  `db:"product_title"`
	SKU              *string `db:"sku"`
	CategoryTitle    *string `db:"category_title"`
	UnitPrice        string  `db:"unit_price"`
	// WeightKg is the product package weight in kilograms (products.weight).
	// Nil when unset on the catalogue product (PH-020a).
	WeightKg        *float64   `db:"weight"`
	StockOnHand     int        `db:"stock_on_hand"`
	CommittedStock  int        `db:"committed_stock"`
	ReorderPoint    int        `db:"reorder_point"`
	ReorderQuantity int        `db:"reorder_quantity"`
	LastRestockAt   *time.Time `db:"last_restock_at"`
	UpdatedAt       time.Time  `db:"updated_at"`
}

type InventoryMovement struct {
	ID               int64        `db:"id"`
	ProductVariantID int64        `db:"product_variant_id"`
	Quantity         int          `db:"quantity"`
	Type             MovementType `db:"type"`
	ReferenceOrderID *int64       `db:"reference_order_id"`
	Note             *string      `db:"note"`
	CreatedAt        time.Time    `db:"created_at"`
}

type AdjustStockReq struct {
	Quantity int          `json:"quantity" validate:"required,min=-2147483648,max=2147483647"`
	Type     MovementType `json:"type"     validate:"required,oneof=purchase restock refund adjustment damage"`
	Note     *string      `json:"note"`
}

type UpdateReorderReq struct {
	ReorderPoint    *int `json:"reorder_point"    validate:"omitempty,min=0,max=2147483647"`
	ReorderQuantity *int `json:"reorder_quantity" validate:"omitempty,min=0,max=2147483647"`
}

type InventoryResponse struct {
	ID               int64   `json:"id"`
	ProductVariantID int64   `json:"product_variant_id"`
	ProductID        int64   `json:"product_id"`
	ProductTitle     string  `json:"product_title"`
	SKU              *string `json:"sku,omitempty"`
	CategoryTitle    *string `json:"category_title,omitempty"`
	UnitPrice        string  `json:"unit_price"`
	// Weight is package weight in kg from products.weight (PH-020a API extension).
	// Omitted when unset so admin UIs can pair with missing_weight.
	Weight *float64 `json:"weight,omitempty"`
	// MissingWeight is true when weight is null or not positive — shipping/quote
	// remediation signal for admin restock workflows (task 085a / PH-020b).
	MissingWeight   bool       `json:"missing_weight"`
	StockOnHand     int        `json:"stock_on_hand"`
	CommittedStock  int        `json:"committed_stock"`
	AvailableStock  int        `json:"available_stock"` // stock_on_hand - committed_stock
	ReorderPoint    int        `json:"reorder_point"`
	ReorderQuantity int        `json:"reorder_quantity"`
	LastRestockAt   *time.Time `json:"last_restock_at,omitempty"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type InventoryMovementResponse struct {
	ID               int64        `json:"id"`
	ProductVariantID int64        `json:"product_variant_id"`
	Quantity         int          `json:"quantity"`
	Type             MovementType `json:"type"`
	ReferenceOrderID *int64       `json:"reference_order_id,omitempty"`
	Note             *string      `json:"note,omitempty"`
	CreatedAt        time.Time    `json:"created_at"`
}

type InventoryFilter struct {
	models.BaseFilter
	LowStock bool `query:"low_stock"` // available stock <= reorder_point
}

func (f *InventoryFilter) Defaults() {
	f.BaseFilter.Defaults("updated_at")
}

type MovementFilter struct {
	models.BaseFilter
	ProductVariantID *int64        `query:"product_variant_id" validate:"omitempty,min=1"`
	Type             *MovementType `query:"type" validate:"omitempty,oneof=purchase restock refund adjustment reservation release damage"`
	OrderID          *int64        `query:"order_id" validate:"omitempty,min=1"`
}

func (f *MovementFilter) Defaults() {
	f.BaseFilter.Defaults("created_at")
}

// StockLine is the minimal order-line shape inventory needs for reserve/release/deduct.
// Kept here (not in orders) so payments and orders can depend downward without a cycle.
type StockLine struct {
	VariantID int64
	Quantity  int
}

// NormalizeStockLines returns the lines merged by VariantID and sorted ascending,
// leaving the caller's slice untouched.
//
// Two invariants ride on this and neither was enforced anywhere before:
//
//   - inventory_reservations is UNIQUE on (order_id, product_variant_id), so an
//     order carrying two lines for one variant must reserve/release/deduct their
//     SUM. Un-merged, the per-row quantity can never match the single aggregated
//     reservation row: closeReservation's `quantity = $3` predicate misses, Deduct
//     returns ErrInvalidState and Confirm rolls back — after the customer has paid.
//   - ascending VariantID is the lock order, so two checkouts sharing variants in
//     opposite order cannot deadlock (40P01).
func NormalizeStockLines(lines []StockLine) []StockLine {
	if len(lines) < 2 {
		return lines
	}
	byVariant := make(map[int64]int, len(lines))
	for _, l := range lines {
		byVariant[l.VariantID] += l.Quantity
	}
	out := make([]StockLine, 0, len(byVariant))
	for id, qty := range byVariant {
		out = append(out, StockLine{VariantID: id, Quantity: qty})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].VariantID < out[j].VariantID })
	return out
}

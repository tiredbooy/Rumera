package models

import "time"

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
	ID               int64      `db:"id"`
	ProductVariantID int64      `db:"product_variant_id"`
	ProductID        int64      `db:"product_id"`
	ProductTitle     string     `db:"product_title"`
	SKU              *string    `db:"sku"`
	CategoryTitle    *string    `db:"category_title"`
	UnitPrice        string     `db:"unit_price"`
	StockOnHand      int        `db:"stock_on_hand"`
	CommittedStock   int        `db:"committed_stock"`
	ReorderPoint     int        `db:"reorder_point"`
	ReorderQuantity  int        `db:"reorder_quantity"`
	LastRestockAt    *time.Time `db:"last_restock_at"`
	UpdatedAt        time.Time  `db:"updated_at"`
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
	Quantity int          `json:"quantity" validate:"required"`
	Type     MovementType `json:"type"     validate:"required,oneof=purchase restock refund adjustment reservation release damage"`
	Note     *string      `json:"note"`
}

type UpdateReorderReq struct {
	ReorderPoint    *int `json:"reorder_point"    validate:"omitempty,min=0"`
	ReorderQuantity *int `json:"reorder_quantity" validate:"omitempty,min=0"`
}

type InventoryResponse struct {
	ID               int64      `json:"id"`
	ProductVariantID int64      `json:"product_variant_id"`
	ProductID        int64      `json:"product_id"`
	ProductTitle     string     `json:"product_title"`
	SKU              *string    `json:"sku,omitempty"`
	CategoryTitle    *string    `json:"category_title,omitempty"`
	UnitPrice        string     `json:"unit_price"`
	StockOnHand      int        `json:"stock_on_hand"`
	CommittedStock   int        `json:"committed_stock"`
	AvailableStock   int        `json:"available_stock"` // stock_on_hand - committed_stock
	ReorderPoint     int        `json:"reorder_point"`
	ReorderQuantity  int        `json:"reorder_quantity"`
	LastRestockAt    *time.Time `json:"last_restock_at,omitempty"`
	UpdatedAt        time.Time  `json:"updated_at"`
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
	BaseFilter
	LowStock bool `query:"low_stock"` // available stock <= reorder_point
}

func (f *InventoryFilter) Defaults() {
	f.BaseFilter.Defaults("updated_at")
}

type MovementFilter struct {
	BaseFilter
	ProductVariantID *int64        `query:"product_variant_id"`
	Type             *MovementType `query:"type"`
	OrderID          *int64        `query:"order_id"`
}

func (f *MovementFilter) Defaults() {
	f.BaseFilter.Defaults("created_at")
}

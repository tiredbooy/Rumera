package models

import "time"

type ProductImage struct {
	ID               int64     `db:"id"`
	ProductID        *int64    `db:"product_id"`
	ProductVariantID *int64    `db:"product_variant_id"`
	ImageURL         string    `db:"image_url"`
	StorageKey       *string   `db:"storage_key"`
	AltText          *string   `db:"alt_text"`
	SortOrder        int       `db:"sort_order"`
	IsPrimary        bool      `db:"is_primary"`
	Width            *int      `db:"width"`
	Height           *int      `db:"height"`
	CreatedAt        time.Time `db:"created_at"`
	UpdatedAt        time.Time `db:"updated_at"`
}

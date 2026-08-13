package option

import "time"

// OptionType is a reusable product option dimension (e.g. volume, color).
type OptionType struct {
	ID          int64     `db:"id"           json:"id"`
	Title       string    `db:"title"        json:"title"`
	DisplayName string    `db:"display_name" json:"display_name"`
	CreatedAt   time.Time `db:"created_at"   json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at"   json:"updated_at"`
}

// OptionValue is a concrete choice under an option type (e.g. "750 ml").
type OptionValue struct {
	ID           int64     `db:"id"             json:"id"`
	OptionTypeID int64     `db:"option_type_id" json:"option_type_id"`
	Value        string    `db:"value"          json:"value"`
	SortOrder    int       `db:"sort_order"     json:"sort_order"`
	CreatedAt    time.Time `db:"created_at"     json:"created_at"`
	UpdatedAt    time.Time `db:"updated_at"     json:"updated_at"`
}

type CreateOptionTypeReq struct {
	Title       string `json:"title"        validate:"required,max=80"`
	DisplayName string `json:"display_name" validate:"required,max=100"`
}

type UpdateOptionTypeReq struct {
	Title       *string `json:"title"        validate:"omitempty,max=80"`
	DisplayName *string `json:"display_name" validate:"omitempty,max=100"`
}

type CreateOptionValueReq struct {
	Value     string `json:"value"      validate:"required,max=100"`
	SortOrder int    `json:"sort_order" validate:"min=0"`
}

type UpdateOptionValueReq struct {
	Value     *string `json:"value"      validate:"omitempty,max=100"`
	SortOrder *int    `json:"sort_order" validate:"omitempty,min=0"`
}

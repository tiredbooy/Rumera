package models

import "time"

type ReviewStatus string

const (
	ReviewStatusPending  ReviewStatus = "pending"
	ReviewStatusApproved ReviewStatus = "approved"
	ReviewStatusRejected ReviewStatus = "rejected"
)

type Review struct {
	ID               int64         `db:"id"`
	Title            string        `db:"title"`
	Content          string        `db:"content"`
	Rating           int           `db:"rating"`
	UserID           int64         `db:"user_id"`
	ProductID        int64         `db:"product_id"`
	LikeCount        int           `db:"like_count"`
	DislikeCount     int           `db:"dislike_count"`
	Images           []ReviewImage `json:"images"`
	VerifiedPurchase bool          `db:"verified_purchase"`
	Status           ReviewStatus  `db:"status"`
	CreatedAt        time.Time     `db:"created_at"`
	UpdatedAt        time.Time     `db:"updated_at"`
	DeletedAt        *time.Time    `db:"deleted_at"`
}

type CreateReviewReq struct {
	Title     string `json:"title"   validate:"required,max=255"`
	Content   string `json:"content" validate:"required"`
	Rating    int    `json:"rating"  validate:"required,min=1,max=5"`
	ProductID int64  `json:"product_id" validate:"required,min=1"`
}

type UpdateReviewReq struct {
	Title   *string `json:"title"   validate:"omitempty,max=255"`
	Content *string `json:"content" validate:"omitempty"`
	Rating  *int    `json:"rating"  validate:"omitempty,min=1,max=5"`
}

type UpdateReviewStatusReq struct {
	Status ReviewStatus `json:"status" validate:"required,oneof=pending approved rejected"`
}

type ReviewFilter struct {
	BaseFilter
	ProductID *int64        `query:"product_id"`
	UserID    *int64        `query:"user_id"`
	Status    *ReviewStatus `query:"status"`
	Rating    *int          `query:"rating"    validate:"omitempty,min=1,max=5"`
	Verified  *bool         `query:"verified"`
}

func (f *ReviewFilter) Defaults() {
	f.BaseFilter.Defaults("created_at")
}

type ReviewResponse struct {
	ID               int64         `json:"id"`
	Title            string        `json:"title"`
	Content          string        `json:"content"`
	Rating           int           `json:"rating"`
	UserID           int64         `json:"user_id"`
	UserFullName     string        `json:"user_full_name"`
	ProductID        int64         `json:"product_id"`
	LikeCount        int           `json:"like_count"`
	Images           []ReviewImage `json:"images"`
	DislikeCount     int           `json:"dislike_count"`
	VerifiedPurchase bool          `json:"verified_purchase"`
	Status           ReviewStatus  `json:"status"`
	CreatedAt        time.Time     `json:"created_at"`
}

type ReviewAdminResponse struct {
	ReviewResponse
	DeletedAt *time.Time `json:"deleted_at,omitempty"`
	UpdatedAt time.Time  `json:"updated_at"`
}

type ProductRatingSummary struct {
	ProductID     int64       `json:"product_id"`
	AverageRating float64     `json:"average_rating"`
	TotalReviews  int         `json:"total_reviews"`
	Distribution  map[int]int `json:"distribution"` // {1: 3, 2: 5, 3: 10, 4: 20, 5: 50}
}

type ReviewImage struct {
	ID        int64     `json:"id"`
	ReviewID  int64     `json:"review_id"`
	ImageURL  string    `json:"image_url"`
	AltTxt    string    `json:"alt_text"`
	SortOrder int       `json:"sort_order"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type ReviewImageReq struct {
	ReviewID  int64   `json:"review_id"`
	ImageURL  string  `json:"image_url"`
	AltTxt    *string `json:"alt_text"`
	SortOrder *int    `json:"sort_order"`
}

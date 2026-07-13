package models

import "time"

// BlogStatus mirrors the recipe publishing workflow so the public storefront can
// hide drafts/archived posts while admins still see everything.
type BlogStatus string

const (
	BlogStatusDraft     BlogStatus = "draft"
	BlogStatusPublished BlogStatus = "published"
	BlogStatusArchived  BlogStatus = "archived"
)

// ── Entities ──────────────────────────────────────────────────────────────────

type BlogCategory struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	Description *string   `json:"description"`
	Slug        *string   `json:"slug"`
	ParentID    *int64    `json:"parent_id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Blog struct {
	ID              int64      `json:"id"`
	AuthorID        int64      `json:"author_id"`
	Title           string     `json:"title"`
	Slug            string     `json:"slug"`
	Content         string     `json:"content"`
	Excerpt         *string    `json:"excerpt"`
	ImageURL        *string    `json:"image_url"`
	TimeToRead      int        `json:"time_to_read"`
	TotalReads      int64      `json:"total_reads"`
	Status          BlogStatus `json:"status"`
	IsFeatured      bool       `json:"is_featured"`
	MetaTitle       *string    `json:"meta_title"`
	MetaDescription *string    `json:"meta_description"`
	PublishedAt     *time.Time `json:"published_at"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	DeletedAt       *time.Time `json:"deleted_at"`
}

type BlogCategoryAssignment struct {
	ID             int64 `json:"id"`
	BlogID         int64 `json:"blog_id"`
	BlogCategoryID int64 `json:"blog_category_id"`
}

type BlogProduct struct {
	ID        int64 `json:"id"`
	BlogID    int64 `json:"blog_id"`
	ProductID int64 `json:"product_id"`
}

type BlogTag struct {
	ID     int64 `json:"id"`
	BlogID int64 `json:"blog_id"`
	TagID  int64 `json:"tag_id"`
}

// ── Requests ──────────────────────────────────────────────────────────────────

type BlogCategoryReq struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Slug        *string `json:"slug"`
	ParentID    *int64  `json:"parent_id"`
}

type BlogReq struct {
	AuthorID        int64      `json:"-"`
	Title           string     `json:"title"            validate:"required,max=255"`
	Slug            string     `json:"slug"             validate:"omitempty,max=255"`
	Content         string     `json:"content"          validate:"required"`
	Excerpt         *string    `json:"excerpt"`
	ImageURL        *string    `json:"image_url"`
	TimeToRead      int        `json:"time_to_read"     validate:"omitempty,min=1"`
	Status          BlogStatus `json:"status"           validate:"omitempty,oneof=draft published archived"`
	IsFeatured      bool       `json:"is_featured"`
	MetaTitle       *string    `json:"meta_title"       validate:"omitempty,max=255"`
	MetaDescription *string    `json:"meta_description"`
	PublishedAt     *time.Time `json:"published_at"`
	CategoryIDs     []int64    `json:"category_ids"`
	ProductIDs      []int64    `json:"product_ids"`
	TagIDs          []int64    `json:"tag_ids"`
}

type BlogUpdateReq struct {
	Title           *string     `json:"title"            validate:"omitempty,max=255"`
	Slug            *string     `json:"slug"             validate:"omitempty,max=255"`
	Content         *string     `json:"content"`
	Excerpt         *string     `json:"excerpt"`
	ImageURL        *string     `json:"image_url"`
	TimeToRead      *int        `json:"time_to_read"     validate:"omitempty,min=1"`
	Status          *BlogStatus `json:"status"           validate:"omitempty,oneof=draft published archived"`
	IsFeatured      *bool       `json:"is_featured"`
	MetaTitle       *string     `json:"meta_title"       validate:"omitempty,max=255"`
	MetaDescription *string     `json:"meta_description"`
	PublishedAt     *time.Time  `json:"published_at"`
	CategoryIDs     []int64     `json:"category_ids"`
	ProductIDs      []int64     `json:"product_ids"`
	TagIDs          []int64     `json:"tag_ids"`
}

// ── Filters ───────────────────────────────────────────────────────────────────

type BlogFilter struct {
	BaseFilter
	Status     *BlogStatus `query:"status"`
	IsFeatured *bool       `query:"is_featured"`
	// CategoryID restricts the public listing to posts assigned to a category.
	CategoryID *int64 `query:"category_id"`
}

func (f *BlogFilter) Defaults() {
	f.BaseFilter.Defaults("published_at")
}

// ── Responses ─────────────────────────────────────────────────────────────────

type BlogCategoryResponse struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	Description *string   `json:"description"`
	Slug        *string   `json:"slug"`
	ParentID    *int64    `json:"parent_id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type BlogResponse struct {
	ID              int64      `json:"id"`
	AuthorID        int64      `json:"author_id"`
	Title           string     `json:"title"`
	Slug            string     `json:"slug"`
	Content         string     `json:"content"`
	Excerpt         *string    `json:"excerpt"`
	ImageURL        *string    `json:"image_url"`
	TimeToRead      int        `json:"time_to_read"`
	TotalReads      int64      `json:"total_reads"`
	Status          BlogStatus `json:"status"`
	IsFeatured      bool       `json:"is_featured"`
	MetaTitle       *string    `json:"meta_title"`
	MetaDescription *string    `json:"meta_description"`
	PublishedAt     *time.Time `json:"published_at"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// BlogListItem — lightweight card for journal listings (no full content body).
type BlogListItem struct {
	ID          int64      `json:"id"`
	AuthorID    int64      `json:"author_id"`
	Title       string     `json:"title"`
	Slug        string     `json:"slug"`
	Excerpt     *string    `json:"excerpt"`
	ImageURL    *string    `json:"image_url"`
	TimeToRead  int        `json:"time_to_read"`
	TotalReads  int64      `json:"total_reads"`
	Status      BlogStatus `json:"status"`
	IsFeatured  bool       `json:"is_featured"`
	PublishedAt *time.Time `json:"published_at"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type BlogDetailResponse struct {
	BlogResponse
	Categories []BlogCategoryResponse `json:"categories"`
	ProductIDs []int64                `json:"product_ids"`
	TagIDs     []int64                `json:"tag_ids"`
}

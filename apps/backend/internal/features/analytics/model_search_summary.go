package analytics

import (
	"time"

	"github.com/shopspring/decimal"
)

// ── JSONB embedded types ──────────────────────────────────────────────────────

type TopClickedProduct struct {
	// Catalog product id as a decimal string (e.g. "42"), not an analytics UUID.
	ProductID  string `json:"product_id"`
	ClickCount int    `json:"click_count"`
}

type CommonFilterUsed struct {
	Filter string `json:"filter"`
	Value  string `json:"value"`
	Count  int    `json:"count"`
}

// ── Entity ────────────────────────────────────────────────────────────────────

type SearchSummary struct {
	Date      time.Time `json:"date"`
	QueryText string    `json:"query_text"`

	// volume
	SearchCount    int `json:"search_count"`
	UniqueUsers    int `json:"unique_users"`
	UniqueSessions int `json:"unique_sessions"`

	// quality
	AvgResultsCount  decimal.Decimal `json:"avg_results_count"`
	ZeroResultsCount int             `json:"zero_results_count"`

	// engagement
	ClickCount       int             `json:"click_count"`
	ClickThroughRate decimal.Decimal `json:"click_through_rate"`

	// conversion
	CartAddCount   int             `json:"cart_add_count"`
	PurchaseCount  int             `json:"purchase_count"`
	ConversionRate decimal.Decimal `json:"conversion_rate"`

	// jsonb
	TopClickedProducts []TopClickedProduct `json:"top_clicked_products"`
	CommonFiltersUsed  []CommonFilterUsed  `json:"common_filters_used"`

	ComputedAt time.Time `json:"computed_at"`
}

// ── Upsert request ────────────────────────────────────────────────────────────

type SearchSummaryUpsertReq struct {
	Date      time.Time `json:"date"`
	QueryText string    `json:"query_text"`

	SearchCount    int `json:"search_count"`
	UniqueUsers    int `json:"unique_users"`
	UniqueSessions int `json:"unique_sessions"`

	AvgResultsCount  decimal.Decimal `json:"avg_results_count"`
	ZeroResultsCount int             `json:"zero_results_count"`

	ClickCount    int `json:"click_count"`
	CartAddCount  int `json:"cart_add_count"`
	PurchaseCount int `json:"purchase_count"`

	TopClickedProducts []TopClickedProduct `json:"top_clicked_products"`
	CommonFiltersUsed  []CommonFilterUsed  `json:"common_filters_used"`
}

// ── Filters ───────────────────────────────────────────────────────────────────

type SearchSummaryFilter struct {
	DateFrom        time.Time
	DateTo          time.Time
	QueryText       *string // optional: drill into one term
	ZeroResultsOnly bool
	Limit           int
	Offset          int
}

// ── Responses ─────────────────────────────────────────────────────────────────

type SearchTermSummary struct {
	QueryText      string          `json:"query_text"`
	TotalSearches  int             `json:"total_searches"`
	TotalClicks    int             `json:"total_clicks"`
	AvgCTR         decimal.Decimal `json:"avg_ctr"`
	TotalPurchases int             `json:"total_purchases"`
	AvgConversion  decimal.Decimal `json:"avg_conversion"`
	ZeroResults    int             `json:"zero_results"`
}

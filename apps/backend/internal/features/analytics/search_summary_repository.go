package analytics

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type SearchSummaryRepository interface {
	Upsert(ctx context.Context, req *SearchSummaryUpsertReq) error
	UpsertBatch(ctx context.Context, reqs []*SearchSummaryUpsertReq) error
	GetByDateAndQuery(ctx context.Context, date time.Time, queryText string) (*SearchSummary, error)
	GetRange(ctx context.Context, filter SearchSummaryFilter) ([]*SearchSummary, error)

	// Aggregated views for dashboards
	TopSearchTerms(ctx context.Context, dateFrom, dateTo time.Time, limit int) ([]*SearchTermSummary, error)
	ZeroResultTerms(ctx context.Context, dateFrom, dateTo time.Time, limit int) ([]*SearchTermSummary, error)
	TopConvertingTerms(ctx context.Context, dateFrom, dateTo time.Time, limit int) ([]*SearchTermSummary, error)
}

type searchSummaryRepository struct{ db *pgxpool.Pool }

func NewSearchSummaryRepository(db *pgxpool.Pool) SearchSummaryRepository {
	return &searchSummaryRepository{db: db}
}

const upsertSearchQuery = `
	INSERT INTO search_summary (
		date, query_text,
		search_count, unique_users, unique_sessions,
		avg_results_count, zero_results_count,
		click_count, click_through_rate,
		cart_add_count, purchase_count, conversion_rate,
		top_clicked_products, common_filters_used,
		computed_at
	) VALUES (
		$1,$2,
		$3,$4,$5,
		$6,$7,
		$8,
		-- click_through_rate
		CASE WHEN $3 > 0 THEN $8::numeric / $3 ELSE 0 END,
		$9,$10,
		-- conversion_rate
		CASE WHEN $3 > 0 THEN $10::numeric / $3 ELSE 0 END,
		$11,$12,
		NOW()
	)
	ON CONFLICT (date, query_text) DO UPDATE SET
		search_count          = EXCLUDED.search_count,
		unique_users          = EXCLUDED.unique_users,
		unique_sessions       = EXCLUDED.unique_sessions,
		avg_results_count     = EXCLUDED.avg_results_count,
		zero_results_count    = EXCLUDED.zero_results_count,
		click_count           = EXCLUDED.click_count,
		click_through_rate    = EXCLUDED.click_through_rate,
		cart_add_count        = EXCLUDED.cart_add_count,
		purchase_count        = EXCLUDED.purchase_count,
		conversion_rate       = EXCLUDED.conversion_rate,
		top_clicked_products  = EXCLUDED.top_clicked_products,
		common_filters_used   = EXCLUDED.common_filters_used,
		computed_at           = NOW()`

func searchUpsertArgs(req *SearchSummaryUpsertReq) ([]any, error) {
	topClicked, err := json.Marshal(req.TopClickedProducts)
	if err != nil {
		return nil, fmt.Errorf("marshalling top_clicked_products: %w", err)
	}
	commonFilters, err := json.Marshal(req.CommonFiltersUsed)
	if err != nil {
		return nil, fmt.Errorf("marshalling common_filters_used: %w", err)
	}

	return []any{
		req.Date, req.QueryText,
		req.SearchCount, req.UniqueUsers, req.UniqueSessions,
		req.AvgResultsCount, req.ZeroResultsCount,
		req.ClickCount,
		req.CartAddCount, req.PurchaseCount,
		topClicked, commonFilters,
	}, nil
}

func (r *searchSummaryRepository) Upsert(ctx context.Context, req *SearchSummaryUpsertReq) error {
	args, err := searchUpsertArgs(req)
	if err != nil {
		return err
	}
	if _, err := r.db.Exec(ctx, upsertSearchQuery, args...); err != nil {
		return fmt.Errorf("upserting search summary: %w", err)
	}
	return nil
}

func (r *searchSummaryRepository) UpsertBatch(ctx context.Context, reqs []*SearchSummaryUpsertReq) error {
	if len(reqs) == 0 {
		return nil
	}

	batch := &pgx.Batch{}
	for _, req := range reqs {
		args, err := searchUpsertArgs(req)
		if err != nil {
			return err
		}
		batch.Queue(upsertSearchQuery, args...)
	}

	br := r.db.SendBatch(ctx, batch)
	defer br.Close()

	for range reqs {
		if _, err := br.Exec(); err != nil {
			return fmt.Errorf("batch upserting search summary: %w", err)
		}
	}
	return nil
}

func (r *searchSummaryRepository) GetByDateAndQuery(ctx context.Context, date time.Time, queryText string) (*SearchSummary, error) {
	query := `
		SELECT date, query_text,
		       search_count, unique_users, unique_sessions,
		       avg_results_count, zero_results_count,
		       click_count, click_through_rate,
		       cart_add_count, purchase_count, conversion_rate,
		       top_clicked_products, common_filters_used,
		       computed_at
		FROM search_summary WHERE date = $1 AND query_text = $2`

	s, err := scanSearchSummary(r.db.QueryRow(ctx, query, date, queryText))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("search summary not found")
		}
		return nil, fmt.Errorf("getting search summary: %w", err)
	}
	return s, nil
}

func (r *searchSummaryRepository) GetRange(ctx context.Context, filter SearchSummaryFilter) ([]*SearchSummary, error) {
	query := `
		SELECT date, query_text,
		       search_count, unique_users, unique_sessions,
		       avg_results_count, zero_results_count,
		       click_count, click_through_rate,
		       cart_add_count, purchase_count, conversion_rate,
		       top_clicked_products, common_filters_used,
		       computed_at
		FROM search_summary
		WHERE date >= $1
		  AND date <= $2
		  AND ($3::text IS NULL OR query_text = $3)
		  AND ($4 = FALSE OR zero_results_count > 0)
		ORDER BY date ASC, search_count DESC
		LIMIT $5 OFFSET $6`

	limit := filter.Limit
	if limit == 0 {
		limit = 100
	}

	rows, err := r.db.Query(ctx, query,
		filter.DateFrom, filter.DateTo,
		filter.QueryText,
		filter.ZeroResultsOnly,
		limit, filter.Offset,
	)
	if err != nil {
		return nil, fmt.Errorf("querying search summary range: %w", err)
	}
	defer rows.Close()

	summaries := make([]*SearchSummary, 0)
	for rows.Next() {
		s, err := scanSearchSummary(rows)
		if err != nil {
			return nil, fmt.Errorf("scanning search summary: %w", err)
		}
		summaries = append(summaries, s)
	}
	return summaries, rows.Err()
}

func (r *searchSummaryRepository) TopSearchTerms(ctx context.Context, dateFrom, dateTo time.Time, limit int) ([]*SearchTermSummary, error) {
	return r.aggregateTerms(ctx, dateFrom, dateTo, limit, "SUM(search_count)", false)
}

func (r *searchSummaryRepository) ZeroResultTerms(ctx context.Context, dateFrom, dateTo time.Time, limit int) ([]*SearchTermSummary, error) {
	return r.aggregateTerms(ctx, dateFrom, dateTo, limit, "SUM(zero_results_count)", true)
}

func (r *searchSummaryRepository) TopConvertingTerms(ctx context.Context, dateFrom, dateTo time.Time, limit int) ([]*SearchTermSummary, error) {
	return r.aggregateTerms(ctx, dateFrom, dateTo, limit, "SUM(purchase_count)", false)
}

func (r *searchSummaryRepository) aggregateTerms(
	ctx context.Context,
	dateFrom, dateTo time.Time,
	limit int,
	orderExpr string,
	zeroResultsOnly bool,
) ([]*SearchTermSummary, error) {
	query := fmt.Sprintf(`
		SELECT
			query_text,
			SUM(search_count)                                               AS total_searches,
			SUM(click_count)                                                AS total_clicks,
			CASE WHEN SUM(search_count) > 0
			     THEN SUM(click_count)::numeric / SUM(search_count)
			     ELSE 0 END                                                 AS avg_ctr,
			SUM(purchase_count)                                             AS total_purchases,
			CASE WHEN SUM(search_count) > 0
			     THEN SUM(purchase_count)::numeric / SUM(search_count)
			     ELSE 0 END                                                 AS avg_conversion,
			SUM(zero_results_count)                                         AS zero_results
		FROM search_summary
		WHERE date >= $1
		  AND date <= $2
		  AND ($3 = FALSE OR zero_results_count > 0)
		GROUP BY query_text
		ORDER BY %s DESC
		LIMIT $4`, orderExpr)

	rows, err := r.db.Query(ctx, query, dateFrom, dateTo, zeroResultsOnly, limit)
	if err != nil {
		return nil, fmt.Errorf("querying search term aggregates: %w", err)
	}
	defer rows.Close()

	terms := make([]*SearchTermSummary, 0)
	for rows.Next() {
		t := &SearchTermSummary{}
		if err := rows.Scan(
			&t.QueryText,
			&t.TotalSearches,
			&t.TotalClicks,
			&t.AvgCTR,
			&t.TotalPurchases,
			&t.AvgConversion,
			&t.ZeroResults,
		); err != nil {
			return nil, fmt.Errorf("scanning search term summary: %w", err)
		}
		terms = append(terms, t)
	}
	return terms, rows.Err()
}

func scanSearchSummary(row pgx.Row) (*SearchSummary, error) {
	s := &SearchSummary{}
	var topClickedRaw, commonFiltersRaw []byte

	err := row.Scan(
		&s.Date, &s.QueryText,
		&s.SearchCount, &s.UniqueUsers, &s.UniqueSessions,
		&s.AvgResultsCount, &s.ZeroResultsCount,
		&s.ClickCount, &s.ClickThroughRate,
		&s.CartAddCount, &s.PurchaseCount, &s.ConversionRate,
		&topClickedRaw, &commonFiltersRaw,
		&s.ComputedAt,
	)
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(topClickedRaw, &s.TopClickedProducts); err != nil {
		return nil, fmt.Errorf("unmarshalling top_clicked_products: %w", err)
	}
	if err := json.Unmarshal(commonFiltersRaw, &s.CommonFiltersUsed); err != nil {
		return nil, fmt.Errorf("unmarshalling common_filters_used: %w", err)
	}
	if s.TopClickedProducts == nil {
		s.TopClickedProducts = make([]TopClickedProduct, 0)
	}
	if s.CommonFiltersUsed == nil {
		s.CommonFiltersUsed = make([]CommonFilterUsed, 0)
	}

	return s, nil
}

package cron

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	models "github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/services"
)

type SearchCronJob struct {
	db  *pgxpool.Pool
	svc *services.SearchSummaryService
}

func NewSearchCronJob(db *pgxpool.Pool, svc *services.SearchSummaryService) *SearchCronJob {
	return &SearchCronJob{db: db, svc: svc}
}

func (j *SearchCronJob) Run(ctx context.Context) {
	yesterday := time.Now().UTC().AddDate(0, 0, -1).Truncate(24 * time.Hour)

	slog.Info("search summary job: aggregating", "date", yesterday.Format("2006-01-02"))

	reqs, err := j.aggregate(ctx, yesterday)
	if err != nil {
		slog.Error("search summary job: aggregation failed", "err", err)
		return
	}

	if len(reqs) == 0 {
		slog.Info("search summary job: no search events yesterday")
		return
	}

	if err := j.svc.FlushBatch(ctx, reqs); err != nil {
		slog.Error("search summary job: flush failed", "err", err)
		return
	}

	slog.Info("search summary job: done", "terms", len(reqs), "date", yesterday.Format("2006-01-02"))
}

func (j *SearchCronJob) aggregate(ctx context.Context, date time.Time) ([]*models.SearchSummaryUpsertReq, error) {
	from := date
	to := date.AddDate(0, 0, 1)

	// ── one row per distinct search term ─────────────────────────────────────
	rows, err := j.db.Query(ctx, `
		SELECT
			payload->>'query'                                               AS query_text,
			COUNT(*)                                                        AS search_count,
			COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL)     AS unique_users,
			COUNT(DISTINCT session_id)                                      AS unique_sessions,
			AVG((payload->>'results_count')::numeric)                      AS avg_results_count,
			COUNT(*) FILTER (WHERE (payload->>'results_count')::int = 0)   AS zero_results_count
		FROM events
		WHERE event_type = 'search_performed'
		  AND payload->>'query' IS NOT NULL
		  AND created_at >= $1 AND created_at < $2
		GROUP BY payload->>'query'`,
		from, to,
	)
	if err != nil {
		return nil, fmt.Errorf("querying search terms: %w", err)
	}
	defer rows.Close()

	type termBase struct {
		queryText        string
		searchCount      int
		uniqueUsers      int
		uniqueSessions   int
		avgResultsCount  float64
		zeroResultsCount int
	}

	var bases []termBase
	for rows.Next() {
		var b termBase
		if err := rows.Scan(
			&b.queryText,
			&b.searchCount,
			&b.uniqueUsers,
			&b.uniqueSessions,
			&b.avgResultsCount,
			&b.zeroResultsCount,
		); err != nil {
			return nil, fmt.Errorf("scanning search term base: %w", err)
		}
		bases = append(bases, b)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// ── per-term engagement and conversion ────────────────────────────────────
	reqs := make([]*models.SearchSummaryUpsertReq, 0, len(bases))
	for _, b := range bases {
		req := &models.SearchSummaryUpsertReq{
			Date:             date,
			QueryText:        b.queryText,
			SearchCount:      b.searchCount,
			UniqueUsers:      b.uniqueUsers,
			UniqueSessions:   b.uniqueSessions,
			ZeroResultsCount: b.zeroResultsCount,
		}

		// clicks after this search
		err := j.db.QueryRow(ctx, `
			SELECT COUNT(*)
			FROM events
			WHERE event_type = 'product_viewed'
			  AND session_id IN (
			      SELECT session_id FROM events
			      WHERE event_type = 'search_performed'
			        AND payload->>'query' = $1
			        AND created_at >= $2 AND created_at < $3
			  )
			  AND created_at >= $2 AND created_at < $3`,
			b.queryText, from, to,
		).Scan(&req.ClickCount)
		if err != nil {
			return nil, fmt.Errorf("counting clicks for term %q: %w", b.queryText, err)
		}

		// cart adds after this search
		err = j.db.QueryRow(ctx, `
			SELECT COUNT(*)
			FROM events
			WHERE event_type = 'cart_updated'
			  AND session_id IN (
			      SELECT session_id FROM events
			      WHERE event_type = 'search_performed'
			        AND payload->>'query' = $1
			        AND created_at >= $2 AND created_at < $3
			  )
			  AND created_at >= $2 AND created_at < $3`,
			b.queryText, from, to,
		).Scan(&req.CartAddCount)
		if err != nil {
			return nil, fmt.Errorf("counting cart adds for term %q: %w", b.queryText, err)
		}

		// purchases after this search
		err = j.db.QueryRow(ctx, `
			SELECT COUNT(*)
			FROM events
			WHERE event_type = 'order_created'
			  AND session_id IN (
			      SELECT session_id FROM events
			      WHERE event_type = 'search_performed'
			        AND payload->>'query' = $1
			        AND created_at >= $2 AND created_at < $3
			  )
			  AND created_at >= $2 AND created_at < $3`,
			b.queryText, from, to,
		).Scan(&req.PurchaseCount)
		if err != nil {
			return nil, fmt.Errorf("counting purchases for term %q: %w", b.queryText, err)
		}

		// top clicked products for this search term
		req.TopClickedProducts, err = j.topClickedProducts(ctx, b.queryText, from, to)
		if err != nil {
			return nil, fmt.Errorf("top clicked products for term %q: %w", b.queryText, err)
		}

		// common filters used with this search term
		req.CommonFiltersUsed, err = j.commonFilters(ctx, b.queryText, from, to)
		if err != nil {
			return nil, fmt.Errorf("common filters for term %q: %w", b.queryText, err)
		}

		reqs = append(reqs, req)
	}

	return reqs, nil
}

func (j *SearchCronJob) topClickedProducts(ctx context.Context, queryText string, from, to time.Time) ([]models.TopClickedProduct, error) {
	rows, err := j.db.Query(ctx, `
		SELECT payload->>'product_id' AS product_id, COUNT(*) AS click_count
		FROM events
		WHERE event_type = 'product_viewed'
		  AND payload->>'product_id' IS NOT NULL
		  AND session_id IN (
		      SELECT session_id FROM events
		      WHERE event_type = 'search_performed'
		        AND payload->>'query' = $1
		        AND created_at >= $2 AND created_at < $3
		  )
		  AND created_at >= $2 AND created_at < $3
		GROUP BY payload->>'product_id'
		ORDER BY click_count DESC
		LIMIT 5`,
		queryText, from, to,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []models.TopClickedProduct
	for rows.Next() {
		var p models.TopClickedProduct
		if err := rows.Scan(&p.ProductID, &p.ClickCount); err != nil {
			return nil, err
		}
		products = append(products, p)
	}
	return products, rows.Err()
}

func (j *SearchCronJob) commonFilters(ctx context.Context, queryText string, from, to time.Time) ([]models.CommonFilterUsed, error) {
	rows, err := j.db.Query(ctx, `
		SELECT
			payload->>'filter_name'     AS filter,
			payload->>'filter_value'    AS value,
			COUNT(*)                    AS count
		FROM events
		WHERE event_type = 'search_performed'
		  AND payload->>'query' = $1
		  AND payload->>'filter_name' IS NOT NULL
		  AND created_at >= $2 AND created_at < $3
		GROUP BY payload->>'filter_name', payload->>'filter_value'
		ORDER BY count DESC
		LIMIT 10`,
		queryText, from, to,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var filters []models.CommonFilterUsed
	for rows.Next() {
		var f models.CommonFilterUsed
		if err := rows.Scan(&f.Filter, &f.Value, &f.Count); err != nil {
			return nil, err
		}
		filters = append(filters, f)
	}
	return filters, rows.Err()
}

package analytics

import (
	"context"
	"fmt"
	"time"
)

type DailyRevenueStatsService struct {
	repo DailyRevenueStatsRepository
}

func NewDailyRevenueStatsService(repo DailyRevenueStatsRepository) *DailyRevenueStatsService {
	return &DailyRevenueStatsService{repo: repo}
}

// FlushStats is called by the cron worker after aggregating order data for a day.
func (s *DailyRevenueStatsService) FlushStats(ctx context.Context, req *DailyRevenueStatsUpsertReq) error {
	if err := s.repo.Upsert(ctx, req); err != nil {
		return fmt.Errorf("flushing daily revenue stats: %w", err)
	}
	return nil
}

// GetByDate returns the full revenue stats row for a specific day.
// Used by the admin dashboard daily summary card.
func (s *DailyRevenueStatsService) GetByDate(ctx context.Context, date time.Time) (*DailyRevenueStats, error) {
	stats, err := s.repo.GetByDate(ctx, date)
	if err != nil {
		return nil, fmt.Errorf("getting daily revenue stats: %w", err)
	}
	return stats, nil
}

// GetTimeSeries returns daily revenue rows over a date range — used for charts.
func (s *DailyRevenueStatsService) GetTimeSeries(ctx context.Context, from, to time.Time) ([]*DailyRevenueStats, error) {
	stats, err := s.repo.GetRange(ctx, RevenueStatsFilter{
		DateFrom: from,
		DateTo:   to,
	})
	if err != nil {
		return nil, fmt.Errorf("getting revenue stats time series: %w", err)
	}
	return stats, nil
}

// GetSummary aggregates revenue metrics across a date range.
// Used for period-over-period comparison cards in the admin dashboard.
func (s *DailyRevenueStatsService) GetSummary(ctx context.Context, from, to time.Time) (*RevenueStatsSummary, error) {
	summary, err := s.repo.Summary(ctx, RevenueStatsFilter{
		DateFrom: from,
		DateTo:   to,
	})
	if err != nil {
		return nil, fmt.Errorf("getting revenue stats summary: %w", err)
	}
	return summary, nil
}

// GetToday is a convenience wrapper for the live dashboard — always pulls today's row.
func (s *DailyRevenueStatsService) GetToday(ctx context.Context) (*DailyRevenueStats, error) {
	today := time.Now().UTC().Truncate(24 * time.Hour)
	return s.GetByDate(ctx, today)
}

// GetDateRange is a convenience wrapper that validates from <= to before querying.
func (s *DailyRevenueStatsService) GetDateRange(ctx context.Context, from, to time.Time) ([]*DailyRevenueStats, error) {
	if from.After(to) {
		return nil, fmt.Errorf("from date %s is after to date %s", from.Format("2006-01-02"), to.Format("2006-01-02"))
	}
	return s.GetTimeSeries(ctx, from, to)
}

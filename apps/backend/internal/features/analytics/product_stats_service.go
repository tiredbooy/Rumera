package analytics

import (
	"context"
	"fmt"
	"time"
)

type DailyProductStatsService struct {
	repo DailyProductStatsRepository
}

func NewDailyProductStatsService(repo DailyProductStatsRepository) *DailyProductStatsService {
	return &DailyProductStatsService{repo: repo}
}

func (s *DailyProductStatsService) FlushStats(ctx context.Context, reqs []*DailyProductStatsUpsertReq) error {
	if err := s.repo.UpsertBatch(ctx, reqs); err != nil {
		return fmt.Errorf("flushing daily product stats batch: %w", err)
	}
	return nil
}

func (s *DailyProductStatsService) UpsertOne(ctx context.Context, req *DailyProductStatsUpsertReq) error {
	if err := s.repo.Upsert(ctx, req); err != nil {
		return fmt.Errorf("upserting daily product stats: %w", err)
	}
	return nil
}

func (s *DailyProductStatsService) GetByProductAndDate(ctx context.Context, productID int64, date time.Time) (*DailyProductStats, error) {
	stats, err := s.repo.GetByProductAndDate(ctx, productID, date)
	if err != nil {
		return nil, fmt.Errorf("getting daily product stats: %w", err)
	}
	return stats, nil
}

func (s *DailyProductStatsService) GetTimeSeries(ctx context.Context, productID int64, from, to time.Time) ([]*DailyProductStats, error) {
	stats, err := s.repo.GetRangeByProduct(ctx, ProductStatsFilter{
		ProductID: &productID,
		DateFrom:  from,
		DateTo:    to,
	})
	if err != nil {
		return nil, fmt.Errorf("getting product stats time series: %w", err)
	}
	return stats, nil
}

func (s *DailyProductStatsService) GetSummary(ctx context.Context, productID int64, from, to time.Time) (*ProductStatsSummary, error) {
	summary, err := s.repo.SummaryByProduct(ctx, ProductStatsFilter{
		ProductID: &productID,
		DateFrom:  from,
		DateTo:    to,
	})
	if err != nil {
		return nil, fmt.Errorf("getting product stats summary: %w", err)
	}
	return summary, nil
}

func (s *DailyProductStatsService) TopByRevenue(ctx context.Context, from, to time.Time, limit int) ([]*TopProductEntry, error) {
	if limit <= 0 {
		limit = 10
	}
	entries, err := s.repo.TopProductsByRevenue(ctx, from, to, limit)
	if err != nil {
		return nil, fmt.Errorf("getting top products by revenue: %w", err)
	}
	return entries, nil
}

func (s *DailyProductStatsService) TopByViews(ctx context.Context, from, to time.Time, limit int) ([]*TopProductEntry, error) {
	if limit <= 0 {
		limit = 10
	}
	entries, err := s.repo.TopProductsByViews(ctx, from, to, limit)
	if err != nil {
		return nil, fmt.Errorf("getting top products by views: %w", err)
	}
	return entries, nil
}

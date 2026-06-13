package services

import (
	"context"
	"fmt"
	"time"

	analyticsmodels "github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
)

type SearchSummaryService struct {
	repo repositories.SearchSummaryRepository
}

func NewSearchSummaryService(repo repositories.SearchSummaryRepository) *SearchSummaryService {
	return &SearchSummaryService{repo: repo}
}

// FlushBatch is called by the cron worker — upserts many search term rows at once.
func (s *SearchSummaryService) FlushBatch(ctx context.Context, reqs []*analyticsmodels.SearchSummaryUpsertReq) error {
	if err := s.repo.UpsertBatch(ctx, reqs); err != nil {
		return fmt.Errorf("flushing search summary batch: %w", err)
	}
	return nil
}

// FlushOne upserts a single search term row — used when cron recomputes one term.
func (s *SearchSummaryService) FlushOne(ctx context.Context, req *analyticsmodels.SearchSummaryUpsertReq) error {
	if err := s.repo.Upsert(ctx, req); err != nil {
		return fmt.Errorf("flushing search summary: %w", err)
	}
	return nil
}

// GetByDateAndQuery drills into a single search term on a specific day.
func (s *SearchSummaryService) GetByDateAndQuery(ctx context.Context, date time.Time, queryText string) (*analyticsmodels.SearchSummary, error) {
	summary, err := s.repo.GetByDateAndQuery(ctx, date, queryText)
	if err != nil {
		return nil, fmt.Errorf("getting search summary: %w", err)
	}
	return summary, nil
}

func (s *SearchSummaryService) GetRange(ctx context.Context, filter analyticsmodels.SearchSummaryFilter) ([]*analyticsmodels.SearchSummary, error) {
	if filter.Limit == 0 {
		filter.Limit = 100
	}
	summaries, err := s.repo.GetRange(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("getting search summary range: %w", err)
	}
	return summaries, nil
}

func (s *SearchSummaryService) TopTerms(ctx context.Context, from, to time.Time, limit int) ([]*analyticsmodels.SearchTermSummary, error) {
	if limit <= 0 {
		limit = 20
	}
	terms, err := s.repo.TopSearchTerms(ctx, from, to, limit)
	if err != nil {
		return nil, fmt.Errorf("getting top search terms: %w", err)
	}
	return terms, nil
}

func (s *SearchSummaryService) ZeroResultTerms(ctx context.Context, from, to time.Time, limit int) ([]*analyticsmodels.SearchTermSummary, error) {
	if limit <= 0 {
		limit = 50
	}
	terms, err := s.repo.ZeroResultTerms(ctx, from, to, limit)
	if err != nil {
		return nil, fmt.Errorf("getting zero result search terms: %w", err)
	}
	return terms, nil
}

func (s *SearchSummaryService) TopConvertingTerms(ctx context.Context, from, to time.Time, limit int) ([]*analyticsmodels.SearchTermSummary, error) {
	if limit <= 0 {
		limit = 20
	}
	terms, err := s.repo.TopConvertingTerms(ctx, from, to, limit)
	if err != nil {
		return nil, fmt.Errorf("getting top converting search terms: %w", err)
	}
	return terms, nil
}
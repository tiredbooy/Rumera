package analytics

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type EventService struct {
	repo EventRepository
}

func NewEventService(repo EventRepository) *EventService {
	return &EventService{repo: repo}
}

func (s *EventService) FlushEvents(ctx context.Context, events []*EventReq) error {
	if err := s.repo.InsertBatch(ctx, events); err != nil {
		return fmt.Errorf("flushing events batch: %w", err)
	}
	return nil
}

func (s *EventService) GetUserJourney(ctx context.Context, sessionID uuid.UUID) ([]*Event, error) {
	events, err := s.repo.List(ctx, EventFilter{
		SessionID: &sessionID,
		Limit:     200,
	})
	if err != nil {
		return nil, fmt.Errorf("getting user journey: %w", err)
	}
	return events, nil
}

func (s *EventService) GetEventBreakdown(ctx context.Context, from, to time.Time) (map[string]int64, error) {
	counts, err := s.repo.CountByType(ctx, EventFilter{
		DateFrom: &from,
		DateTo:   &to,
	})
	if err != nil {
		return nil, fmt.Errorf("getting event breakdown: %w", err)
	}
	return counts, nil
}

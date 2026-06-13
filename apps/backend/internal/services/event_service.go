package services

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	models "github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
)

type EventService struct {
	repo repositories.EventRepository
}

func NewEventService(repo repositories.EventRepository) *EventService {
	return &EventService{repo: repo}
}

func (s *EventService) FlushEvents(ctx context.Context, events []*models.EventReq) error {
	if err := s.repo.InsertBatch(ctx, events); err != nil {
		return fmt.Errorf("flushing events batch: %w", err)
	}
	return nil
}

func (s *EventService) GetUserJourney(ctx context.Context, sessionID uuid.UUID) ([]*models.Event, error) {
	events, err := s.repo.List(ctx, models.EventFilter{
		SessionID: &sessionID,
		Limit:     200,
	})
	if err != nil {
		return nil, fmt.Errorf("getting user journey: %w", err)
	}
	return events, nil
}

func (s *EventService) GetEventBreakdown(ctx context.Context, from, to time.Time) (map[string]int64, error) {
	counts, err := s.repo.CountByType(ctx, models.EventFilter{
		DateFrom: &from,
		DateTo:   &to,
	})
	if err != nil {
		return nil, fmt.Errorf("getting event breakdown: %w", err)
	}
	return counts, nil
}

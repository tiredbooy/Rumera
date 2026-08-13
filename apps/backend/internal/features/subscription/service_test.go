package subscription

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

// memRepo is an in-memory Repository for lifecycle unit tests (no DB).
type memRepo struct {
	byID map[int64]*Subscription
}

func newMemRepo(subs ...Subscription) *memRepo {
	m := &memRepo{byID: make(map[int64]*Subscription)}
	for i := range subs {
		s := subs[i]
		cp := s
		m.byID[s.ID] = &cp
	}
	return m
}

func (m *memRepo) Create(_ context.Context, sub Subscription) (*Subscription, error) {
	sub.ID = int64(len(m.byID) + 1)
	sub.Status = SubscriptionStatusActive
	sub.CreatedAt = time.Now()
	sub.UpdatedAt = sub.CreatedAt
	cp := sub
	m.byID[sub.ID] = &cp
	return &cp, nil
}

func (m *memRepo) ListByUser(_ context.Context, userID int64) ([]Subscription, error) {
	var out []Subscription
	for _, s := range m.byID {
		if s.UserID == userID {
			out = append(out, *s)
		}
	}
	return out, nil
}

func (m *memRepo) Get(_ context.Context, id, userID int64) (*Subscription, error) {
	s, ok := m.byID[id]
	if !ok || s.UserID != userID {
		return nil, models.ErrNotFound
	}
	cp := *s
	return &cp, nil
}

func (m *memRepo) UpdateStatus(_ context.Context, id, userID int64, status SubscriptionStatus) error {
	s, ok := m.byID[id]
	if !ok || s.UserID != userID {
		return models.ErrNotFound
	}
	s.Status = status
	s.UpdatedAt = time.Now()
	return nil
}

func (m *memRepo) SetNextRenewal(_ context.Context, id, userID int64, t time.Time) error {
	s, ok := m.byID[id]
	if !ok || s.UserID != userID {
		return models.ErrNotFound
	}
	s.NextRenewalAt = t
	s.UpdatedAt = time.Now()
	return nil
}

func (m *memRepo) FindDue(context.Context, time.Time, int) ([]DueSubscription, error) {
	return nil, nil
}

func (m *memRepo) AdvanceRenewal(_ context.Context, id int64, next time.Time) error {
	s, ok := m.byID[id]
	if !ok {
		return models.ErrNotFound
	}
	s.NextRenewalAt = next
	return nil
}

func TestCreateUsesCellarBoxPlan(t *testing.T) {
	svc := NewService(newMemRepo())
	got, err := svc.Create(context.Background(), 7, CreateSubscriptionReq{
		Cadence: SubscriptionCadenceMonthly,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if got.Plan != PlanCellarBox {
		t.Fatalf("plan = %q, want %q", got.Plan, PlanCellarBox)
	}
	if got.Status != SubscriptionStatusActive {
		t.Fatalf("status = %q, want active", got.Status)
	}
	if got.Cadence != SubscriptionCadenceMonthly {
		t.Fatalf("cadence = %q", got.Cadence)
	}
}

func TestUpdateLifecycle(t *testing.T) {
	next := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
	repo := newMemRepo(Subscription{
		ID:            1,
		UserID:        9,
		Plan:          PlanCellarBox,
		Cadence:       SubscriptionCadenceMonthly,
		Status:        SubscriptionStatusActive,
		NextRenewalAt: next,
	})
	svc := NewService(repo)

	// skip advances next renewal
	got, err := svc.Update(context.Background(), 9, 1, string(SubscriptionActionSkip))
	if err != nil {
		t.Fatalf("skip: %v", err)
	}
	wantNext := NextRenewal(next, SubscriptionCadenceMonthly)
	if !got.NextRenewalAt.Equal(wantNext) {
		t.Fatalf("next after skip = %v, want %v", got.NextRenewalAt, wantNext)
	}

	// pause
	got, err = svc.Update(context.Background(), 9, 1, string(SubscriptionActionPause))
	if err != nil {
		t.Fatalf("pause: %v", err)
	}
	if got.Status != SubscriptionStatusPaused {
		t.Fatalf("status = %q, want paused", got.Status)
	}

	// skip while paused is invalid
	_, err = svc.Update(context.Background(), 9, 1, string(SubscriptionActionSkip))
	if !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("skip while paused err = %v, want ErrInvalidRequest", err)
	}

	// cancel from paused
	got, err = svc.Update(context.Background(), 9, 1, string(SubscriptionActionCancel))
	if err != nil {
		t.Fatalf("cancel: %v", err)
	}
	if got.Status != SubscriptionStatusCancelled {
		t.Fatalf("status = %q, want cancelled", got.Status)
	}

	// resume from cancelled
	got, err = svc.Update(context.Background(), 9, 1, string(SubscriptionActionResume))
	if err != nil {
		t.Fatalf("resume: %v", err)
	}
	if got.Status != SubscriptionStatusActive {
		t.Fatalf("status = %q, want active", got.Status)
	}
}

func TestUpdateNotFound(t *testing.T) {
	svc := NewService(newMemRepo())
	_, err := svc.Update(context.Background(), 1, 99, string(SubscriptionActionPause))
	if !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("err = %v, want ErrNotFound", err)
	}
}

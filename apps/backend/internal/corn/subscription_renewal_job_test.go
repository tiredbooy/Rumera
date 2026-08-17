package cron

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/tiredbooy/internal/features/subscription"
	"github.com/tiredbooy/internal/models"
)

func TestSubscriptionRenewalJob_DispatcherPreferredAndFailClosed(t *testing.T) {
	dueAt := time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC)
	due := []subscription.DueSubscription{
		{
			ID:            11,
			UserID:        1,
			Email:         "ok@example.com",
			Cadence:       subscription.SubscriptionCadenceMonthly,
			NextRenewalAt: dueAt,
		},
		{
			ID:            22,
			UserID:        2,
			Email:         "fail@example.com",
			Cadence:       subscription.SubscriptionCadenceMonthly,
			NextRenewalAt: dueAt,
		},
	}

	t.Run("dispatcher and mailer unset never advances", func(t *testing.T) {
		repo := newFakeSubRepo(due)
		job := NewSubscriptionRenewalJob(repo, nil, "https://rumera.example")
		job.Run(context.Background())
		if repo.advanceCalls != 0 {
			t.Fatalf("AdvanceRenewal called %d times", repo.advanceCalls)
		}
	})

	t.Run("dispatch error does not advance that id", func(t *testing.T) {
		repo := newFakeSubRepo([]subscription.DueSubscription{due[1]})
		disp := &fakeRenewalDispatcher{failIDs: map[int64]error{22: errors.New("outbox down")}}
		job := NewSubscriptionRenewalJob(repo, &fakeMailer{}, "https://rumera.example").WithDispatcher(disp)
		job.Run(context.Background())
		if repo.advanceCalls != 0 {
			t.Fatalf("AdvanceRenewal called %d times", repo.advanceCalls)
		}
	})

	t.Run("dispatch ok advances that id", func(t *testing.T) {
		repo := newFakeSubRepo([]subscription.DueSubscription{due[0]})
		disp := &fakeRenewalDispatcher{}
		job := NewSubscriptionRenewalJob(repo, nil, "https://rumera.example").WithDispatcher(disp)
		job.Run(context.Background())
		if !slices.Equal(repo.advanced, []int64{11}) {
			t.Fatalf("advanced = %v, want [11]", repo.advanced)
		}
		if !slices.Equal(disp.sent, []int64{11}) {
			t.Fatalf("dispatched = %v, want [11]", disp.sent)
		}
		if len(disp.periods) != 1 || disp.periods[0] != "2026-08-01" {
			t.Fatalf("periods = %v", disp.periods)
		}
	})

	t.Run("dispatcher preferred over mailer", func(t *testing.T) {
		repo := newFakeSubRepo(due)
		disp := &fakeRenewalDispatcher{failIDs: map[int64]error{22: errors.New("outbox down")}}
		mailer := &countingMailer{}
		job := NewSubscriptionRenewalJob(repo, mailer, "https://rumera.example").WithDispatcher(disp)
		job.Run(context.Background())
		if !slices.Equal(repo.advanced, []int64{11}) {
			t.Fatalf("advanced = %v, want [11]", repo.advanced)
		}
		if mailer.sends != 0 {
			t.Fatalf("mailer.Send called %d times; dispatcher should be preferred", mailer.sends)
		}
	})
}

type fakeRenewalDispatcher struct {
	failIDs map[int64]error
	sent    []int64
	periods []string
}

func (d *fakeRenewalDispatcher) DispatchSubscriptionRenewal(_ context.Context, _, _, _ string, subscriptionID int64, periodKey, _ string) error {
	if err, ok := d.failIDs[subscriptionID]; ok {
		return err
	}
	d.sent = append(d.sent, subscriptionID)
	d.periods = append(d.periods, periodKey)
	return nil
}

type fakeSubRepo struct {
	due          []subscription.DueSubscription
	advanced     []int64
	advanceCalls int
}

func newFakeSubRepo(due []subscription.DueSubscription) *fakeSubRepo {
	return &fakeSubRepo{due: due}
}

func (r *fakeSubRepo) Create(context.Context, subscription.Subscription) (*subscription.Subscription, error) {
	return nil, errors.New("fakeSubRepo.Create unused")
}
func (r *fakeSubRepo) ListByUser(context.Context, int64) ([]subscription.Subscription, error) {
	return nil, errors.New("fakeSubRepo.ListByUser unused")
}
func (r *fakeSubRepo) Get(context.Context, int64, int64) (*subscription.Subscription, error) {
	return nil, errors.New("fakeSubRepo.Get unused")
}
func (r *fakeSubRepo) UpdateStatus(context.Context, int64, int64, subscription.SubscriptionStatus) error {
	return errors.New("fakeSubRepo.UpdateStatus unused")
}
func (r *fakeSubRepo) SetNextRenewal(context.Context, int64, int64, time.Time) error {
	return errors.New("fakeSubRepo.SetNextRenewal unused")
}
func (r *fakeSubRepo) UpdateAddress(context.Context, int64, int64, int64) error {
	return errors.New("fakeSubRepo.UpdateAddress unused")
}
func (r *fakeSubRepo) FindDue(context.Context, time.Time, int) ([]subscription.DueSubscription, error) {
	out := make([]subscription.DueSubscription, len(r.due))
	copy(out, r.due)
	return out, nil
}
func (r *fakeSubRepo) AdvanceRenewal(_ context.Context, id int64, _ time.Time) error {
	r.advanceCalls++
	for _, d := range r.due {
		if d.ID == id {
			r.advanced = append(r.advanced, id)
			return nil
		}
	}
	return models.ErrNotFound
}

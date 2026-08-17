package cron

import (
	"context"
	"errors"
	"slices"
	"testing"

	"github.com/tiredbooy/internal/features/alerts"
	"github.com/tiredbooy/pkg/notify"
)

func TestAlertCheckJob_MarkNotifiedOnlyAfterSend(t *testing.T) {
	slug := "shiraz"
	pending := []alerts.PendingAlert{
		{
			ID:           11,
			Email:        "ok@example.com",
			AlertType:    alerts.AlertRestock,
			ProductTitle: "شیراز",
			ProductSlug:  &slug,
		},
		{
			ID:           22,
			Email:        "fail@example.com",
			AlertType:    alerts.AlertPriceDrop,
			ProductTitle: "جین",
		},
	}

	tests := []struct {
		name       string
		mailer     *fakeMailer
		nilMailer  bool
		pending    []alerts.PendingAlert
		wantMarked []int64
	}{
		{
			name:       "dispatcher and mailer unset never marks",
			nilMailer:  true,
			pending:    pending,
			wantMarked: nil,
		},
		{
			name: "send error does not mark that id",
			mailer: &fakeMailer{
				failTo: map[string]error{"fail@example.com": errors.New("smtp down")},
			},
			pending:    []alerts.PendingAlert{pending[1]},
			wantMarked: nil,
		},
		{
			name:       "send ok marks that id",
			mailer:     &fakeMailer{},
			pending:    []alerts.PendingAlert{pending[0]},
			wantMarked: []int64{11},
		},
		{
			name: "mixed batch marks only successes",
			mailer: &fakeMailer{
				failTo: map[string]error{"fail@example.com": errors.New("smtp down")},
			},
			pending:    pending,
			wantMarked: []int64{11},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &fakeAlertsRepo{pending: tt.pending}
			var mailer notify.Mailer
			if !tt.nilMailer {
				mailer = tt.mailer
			}
			job := NewAlertCheckJob(repo, mailer, "https://rumera.example")
			job.Run(context.Background())

			if tt.nilMailer && repo.markCalls != 0 {
				t.Fatalf("MarkNotified called %d times; want 0 when dispatcher and mailer are unset", repo.markCalls)
			}
			if !slices.Equal(repo.marked, tt.wantMarked) {
				t.Fatalf("marked = %v, want %v", repo.marked, tt.wantMarked)
			}
		})
	}
}

type fakeMailer struct {
	failTo map[string]error
}

func (m *fakeMailer) Send(_ context.Context, to, _, _ string) error {
	if err, ok := m.failTo[to]; ok {
		return err
	}
	return nil
}

type fakeAlertsRepo struct {
	pending   []alerts.PendingAlert
	marked    []int64
	markCalls int
}

func (r *fakeAlertsRepo) FindPending(_ context.Context, _ int) ([]alerts.PendingAlert, error) {
	return r.pending, nil
}

func (r *fakeAlertsRepo) MarkNotified(_ context.Context, ids []int64) error {
	r.markCalls++
	r.marked = append(r.marked, ids...)
	return nil
}

func (r *fakeAlertsRepo) Create(context.Context, alerts.ProductAlert) (*alerts.ProductAlert, error) {
	return nil, errors.New("fakeAlertsRepo.Create unused")
}

func (r *fakeAlertsRepo) ListByUser(context.Context, int64) ([]alerts.ProductAlert, error) {
	return nil, errors.New("fakeAlertsRepo.ListByUser unused")
}

func (r *fakeAlertsRepo) Delete(context.Context, int64, int64) error {
	return errors.New("fakeAlertsRepo.Delete unused")
}

func TestAlertCheckJob_DispatcherPreferredAndFailClosed(t *testing.T) {
	slug := "shiraz"
	pending := []alerts.PendingAlert{
		{
			ID:           11,
			Email:        "ok@example.com",
			AlertType:    alerts.AlertRestock,
			ProductTitle: "شیراز",
			ProductSlug:  &slug,
		},
		{
			ID:           22,
			Email:        "fail@example.com",
			AlertType:    alerts.AlertPriceDrop,
			ProductTitle: "جین",
		},
	}

	t.Run("dispatch error does not mark that id", func(t *testing.T) {
		repo := &fakeAlertsRepo{pending: []alerts.PendingAlert{pending[1]}}
		disp := &fakeAlertDispatcher{failIDs: map[int64]error{22: errors.New("outbox down")}}
		job := NewAlertCheckJob(repo, &fakeMailer{}, "https://rumera.example").WithDispatcher(disp)
		job.Run(context.Background())
		if repo.markCalls != 0 {
			t.Fatalf("MarkNotified called %d times; want 0 on dispatch error", repo.markCalls)
		}
	})

	t.Run("dispatch ok marks that id", func(t *testing.T) {
		repo := &fakeAlertsRepo{pending: []alerts.PendingAlert{pending[0]}}
		disp := &fakeAlertDispatcher{}
		job := NewAlertCheckJob(repo, nil, "https://rumera.example").WithDispatcher(disp)
		job.Run(context.Background())
		if !slices.Equal(repo.marked, []int64{11}) {
			t.Fatalf("marked = %v, want [11]", repo.marked)
		}
		if !slices.Equal(disp.sent, []int64{11}) {
			t.Fatalf("dispatched = %v, want [11]", disp.sent)
		}
	})

	t.Run("dispatcher preferred over mailer", func(t *testing.T) {
		repo := &fakeAlertsRepo{pending: pending}
		disp := &fakeAlertDispatcher{
			failIDs: map[int64]error{22: errors.New("outbox down")},
		}
		mailer := &countingMailer{}
		job := NewAlertCheckJob(repo, mailer, "https://rumera.example").WithDispatcher(disp)
		job.Run(context.Background())
		if !slices.Equal(repo.marked, []int64{11}) {
			t.Fatalf("marked = %v, want [11]", repo.marked)
		}
		if mailer.sends != 0 {
			t.Fatalf("mailer.Send called %d times; dispatcher should be preferred", mailer.sends)
		}
	})
}

type fakeAlertDispatcher struct {
	failIDs map[int64]error
	sent    []int64
}

func (d *fakeAlertDispatcher) DispatchAlert(_ context.Context, _, _, _ string, alertID int64, _ string) error {
	if err, ok := d.failIDs[alertID]; ok {
		return err
	}
	d.sent = append(d.sent, alertID)
	return nil
}

type countingMailer struct {
	sends int
}

func (m *countingMailer) Send(context.Context, string, string, string) error {
	m.sends++
	return nil
}

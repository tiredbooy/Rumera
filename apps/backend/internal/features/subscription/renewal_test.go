package subscription

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"
)

func TestProcessDueRenewals_AdvanceOnlyAfterSend(t *testing.T) {
	dueAt := time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC)
	due := []DueSubscription{
		{
			ID:            11,
			UserID:        1,
			Email:         "ok@example.com",
			Cadence:       SubscriptionCadenceMonthly,
			NextRenewalAt: dueAt,
		},
		{
			ID:            22,
			UserID:        2,
			Email:         "fail@example.com",
			Cadence:       SubscriptionCadenceMonthly,
			NextRenewalAt: dueAt,
		},
	}

	email := func(DueSubscription) (string, string) {
		return "باکس سرداب شما آماده است", "<p>reminder</p>"
	}

	tests := []struct {
		name         string
		mailer       *fakeRenewalMailer
		nilMailer    bool
		due          []DueSubscription
		wantAdvanced []int64
		wantErr      error
	}{
		{
			name:         "mailer nil never advances",
			nilMailer:    true,
			due:          due,
			wantAdvanced: nil,
			wantErr:      ErrMailerNil,
		},
		{
			name: "send error does not advance that id",
			mailer: &fakeRenewalMailer{
				failTo: map[string]error{"fail@example.com": errors.New("smtp down")},
			},
			due:          []DueSubscription{due[1]},
			wantAdvanced: nil,
		},
		{
			name:         "send ok advances that id",
			mailer:       &fakeRenewalMailer{},
			due:          []DueSubscription{due[0]},
			wantAdvanced: []int64{11},
		},
		{
			name: "mixed batch advances only successes",
			mailer: &fakeRenewalMailer{
				failTo: map[string]error{"fail@example.com": errors.New("smtp down")},
			},
			due:          due,
			wantAdvanced: []int64{11},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := newMemRepo(dueSubs(dueAt, tt.due)...)
			repo.due = tt.due

			var mailer Mailer
			if !tt.nilMailer {
				mailer = tt.mailer
			}

			n, err := ProcessDueRenewals(context.Background(), repo, mailer, dueAt, 500, email)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want %v", err, tt.wantErr)
			}
			if tt.nilMailer && repo.advanceCalls != 0 {
				t.Fatalf("AdvanceRenewal called %d times; want 0 when mailer is nil", repo.advanceCalls)
			}
			if !slices.Equal(repo.advanced, tt.wantAdvanced) {
				t.Fatalf("advanced = %v, want %v", repo.advanced, tt.wantAdvanced)
			}
			if n != len(tt.wantAdvanced) {
				t.Fatalf("advanced count = %d, want %d", n, len(tt.wantAdvanced))
			}

			wantNext := NextRenewal(dueAt, SubscriptionCadenceMonthly)
			for _, id := range tt.wantAdvanced {
				got := repo.byID[id].NextRenewalAt
				if !got.Equal(wantNext) {
					t.Fatalf("sub %d next_renewal_at = %v, want %v", id, got, wantNext)
				}
			}
			for _, d := range tt.due {
				if slices.Contains(tt.wantAdvanced, d.ID) {
					continue
				}
				if s, ok := repo.byID[d.ID]; ok && !s.NextRenewalAt.Equal(dueAt) {
					t.Fatalf("sub %d next_renewal_at mutated on failed send: %v", d.ID, s.NextRenewalAt)
				}
			}
		})
	}
}

func dueSubs(dueAt time.Time, due []DueSubscription) []Subscription {
	out := make([]Subscription, len(due))
	for i, d := range due {
		out[i] = Subscription{
			ID:            d.ID,
			UserID:        d.UserID,
			Plan:          PlanCellarBox,
			Cadence:       d.Cadence,
			Status:        SubscriptionStatusActive,
			NextRenewalAt: dueAt,
		}
	}
	return out
}

type fakeRenewalMailer struct {
	failTo map[string]error
	sent   []string
}

func (m *fakeRenewalMailer) Send(_ context.Context, to, _, _ string) error {
	if err, ok := m.failTo[to]; ok {
		return err
	}
	m.sent = append(m.sent, to)
	return nil
}

func TestProcessDueRenewals_DueMailerPreferredAndFailClosed(t *testing.T) {
	dueAt := time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC)
	due := []DueSubscription{
		{
			ID:            11,
			UserID:        1,
			Email:         "ok@example.com",
			Cadence:       SubscriptionCadenceMonthly,
			NextRenewalAt: dueAt,
		},
		{
			ID:            22,
			UserID:        2,
			Email:         "fail@example.com",
			Cadence:       SubscriptionCadenceMonthly,
			NextRenewalAt: dueAt,
		},
	}
	email := func(DueSubscription) (string, string) {
		return "باکس سرداب شما آماده است", "<p>reminder</p>"
	}

	t.Run("SendDue error does not advance that id", func(t *testing.T) {
		repo := newMemRepo(dueSubs(dueAt, due)...)
		repo.due = []DueSubscription{due[1]}
		mailer := &fakeDueMailer{failIDs: map[int64]error{22: errors.New("outbox down")}}
		n, err := ProcessDueRenewals(context.Background(), repo, mailer, dueAt, 500, email)
		if err != nil {
			t.Fatal(err)
		}
		if n != 0 || repo.advanceCalls != 0 {
			t.Fatalf("advanced=%d calls=%d; want 0", n, repo.advanceCalls)
		}
	})

	t.Run("SendDue ok advances that id", func(t *testing.T) {
		repo := newMemRepo(dueSubs(dueAt, due)...)
		repo.due = []DueSubscription{due[0]}
		mailer := &fakeDueMailer{}
		n, err := ProcessDueRenewals(context.Background(), repo, mailer, dueAt, 500, email)
		if err != nil {
			t.Fatal(err)
		}
		if n != 1 || !slices.Equal(repo.advanced, []int64{11}) {
			t.Fatalf("advanced=%v n=%d", repo.advanced, n)
		}
		if !slices.Equal(mailer.sent, []int64{11}) {
			t.Fatalf("sent=%v", mailer.sent)
		}
		if mailer.sendCalls != 0 {
			t.Fatal("plain Send must not be used when SendDue exists")
		}
	})

	t.Run("mixed batch advances only successes", func(t *testing.T) {
		repo := newMemRepo(dueSubs(dueAt, due)...)
		repo.due = due
		mailer := &fakeDueMailer{failIDs: map[int64]error{22: errors.New("outbox down")}}
		n, err := ProcessDueRenewals(context.Background(), repo, mailer, dueAt, 500, email)
		if err != nil {
			t.Fatal(err)
		}
		if n != 1 || !slices.Equal(repo.advanced, []int64{11}) {
			t.Fatalf("advanced=%v n=%d", repo.advanced, n)
		}
	})
}

func TestRenewalPeriodKey(t *testing.T) {
	dueAt := time.Date(2026, 8, 1, 15, 4, 5, 0, time.UTC)
	if got := RenewalPeriodKey(DueSubscription{NextRenewalAt: dueAt}); got != "2026-08-01" {
		t.Fatalf("period=%s", got)
	}
	if got := RenewalPeriodKey(DueSubscription{}); got != "unknown" {
		t.Fatalf("zero period=%s", got)
	}
}

type fakeDueMailer struct {
	failIDs   map[int64]error
	sent      []int64
	sendCalls int
}

func (m *fakeDueMailer) Send(context.Context, string, string, string) error {
	m.sendCalls++
	return errors.New("fakeDueMailer.Send unused")
}

func (m *fakeDueMailer) SendDue(_ context.Context, d DueSubscription, _, _ string) error {
	if err, ok := m.failIDs[d.ID]; ok {
		return err
	}
	m.sent = append(m.sent, d.ID)
	return nil
}

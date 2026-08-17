package cron

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/tiredbooy/internal/features/subscription"
	"github.com/tiredbooy/pkg/notify"
)

// subscriptionRenewalNotifier is the dispatcher subset used for box-due mail.
type subscriptionRenewalNotifier interface {
	DispatchSubscriptionRenewal(ctx context.Context, to, subject, htmlBody string, subscriptionID int64, periodKey, correlationID string) error
}

// SubscriptionRenewalJob emails customers whose cellar box is due and advances
// the subscription's next renewal date only after a successful dispatch or
// send (PR-057a / PR-055a). Charging is intentionally NOT done here (PH-043c
// closed: email-driven renewal only — architecture/box-auto-charge-decision.md).
type SubscriptionRenewalJob struct {
	subs       subscription.Repository
	mailer     notify.Mailer
	dispatcher subscriptionRenewalNotifier
	siteURL    string
}

func NewSubscriptionRenewalJob(subs subscription.Repository, mailer notify.Mailer, siteURL string) *SubscriptionRenewalJob {
	return &SubscriptionRenewalJob{subs: subs, mailer: mailer, siteURL: siteURL}
}

// WithDispatcher prefers the notification outbox (or inline dispatcher) over
// the mailer. Nil is allowed; bootstrap should chain this after New.
func (j *SubscriptionRenewalJob) WithDispatcher(d subscriptionRenewalNotifier) *SubscriptionRenewalJob {
	if j != nil {
		j.dispatcher = d
	}
	return j
}

func (j *SubscriptionRenewalJob) Run(ctx context.Context) {
	sender := j.sender()
	if sender == nil {
		slog.Error("subscription renewal job: dispatcher and mailer unset; leaving renewals unadvanced")
		return
	}
	advanced, err := subscription.ProcessDueRenewals(
		ctx, j.subs, sender, time.Now(), subscription.DefaultDueLimit,
		func(d subscription.DueSubscription) (string, string) {
			return renewalEmailSubject, buildRenewalEmailHTML(j.siteURL, d.Cadence)
		},
	)
	if err != nil || advanced == 0 {
		return
	}
	slog.Info("subscription renewal job: done", "advanced", advanced)
}

func (j *SubscriptionRenewalJob) sender() subscription.Mailer {
	if j.dispatcher != nil {
		return &renewalDispatchMailer{d: j.dispatcher}
	}
	return j.mailer
}

// renewalDispatchMailer adapts the dispatcher so ProcessDueRenewals can pass
// the due row for period-scoped outbox keys.
type renewalDispatchMailer struct {
	d subscriptionRenewalNotifier
}

func (m *renewalDispatchMailer) Send(context.Context, string, string, string) error {
	return fmt.Errorf("subscription: SendDue required for dispatcher mail")
}

func (m *renewalDispatchMailer) SendDue(ctx context.Context, d subscription.DueSubscription, subject, htmlBody string) error {
	period := subscription.RenewalPeriodKey(d)
	corr := fmt.Sprintf("subscription:%d:renewal", d.ID)
	return m.d.DispatchSubscriptionRenewal(ctx, d.Email, subject, htmlBody, d.ID, period, corr)
}

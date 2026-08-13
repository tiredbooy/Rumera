package cron

import (
	"context"
	"log/slog"
	"time"

	"github.com/tiredbooy/internal/features/subscription"
	"github.com/tiredbooy/pkg/notify"
)

// SubscriptionRenewalJob emails customers whose cellar box is due and advances
// the subscription's next renewal date. Charging is intentionally NOT done here
// (PH-043c closed: email-driven renewal only — architecture/box-auto-charge-decision.md).
type SubscriptionRenewalJob struct {
	subs    subscription.Repository
	mailer  notify.Mailer
	siteURL string
}

func NewSubscriptionRenewalJob(subs subscription.Repository, mailer notify.Mailer, siteURL string) *SubscriptionRenewalJob {
	return &SubscriptionRenewalJob{subs: subs, mailer: mailer, siteURL: siteURL}
}

func (j *SubscriptionRenewalJob) Run(ctx context.Context) {
	now := time.Now()
	due, err := j.subs.FindDue(ctx, now, 500)
	if err != nil {
		slog.Error("subscription renewal job: find due", "err", err)
		return
	}
	if len(due) == 0 {
		return
	}

	advanced := 0
	for _, d := range due {
		if j.mailer != nil {
			body := buildRenewalEmailHTML(j.siteURL, d.Cadence)
			if err := j.mailer.Send(ctx, d.Email, renewalEmailSubject, body); err != nil {
				slog.Warn("subscription renewal job: send failed", "sub_id", d.ID, "err", err)
			}
		}
		if err := j.subs.AdvanceRenewal(ctx, d.ID, subscription.NextRenewal(d.NextRenewalAt, d.Cadence)); err != nil {
			slog.Warn("subscription renewal job: advance failed", "sub_id", d.ID, "err", err)
			continue
		}
		advanced++
	}
	slog.Info("subscription renewal job: done", "advanced", advanced)
}

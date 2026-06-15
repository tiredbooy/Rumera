package cron

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/notify"
)

// SubscriptionRenewalJob emails customers whose cellar box is due and advances
// the subscription's next renewal date. Charging is intentionally NOT done here
// yet — it awaits a tokenized recurring payment method (see FEATURE-ROADMAP.md).
type SubscriptionRenewalJob struct {
	subs    repositories.SubscriptionRepository
	mailer  notify.Mailer
	siteURL string
}

func NewSubscriptionRenewalJob(subs repositories.SubscriptionRepository, mailer notify.Mailer, siteURL string) *SubscriptionRenewalJob {
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
			subject := "باکس سرداب شما آماده است"
			body := fmt.Sprintf(
				`<p>زمان باکس %s شما رسید.</p><p><a href="%s/account/subscriptions">مدیریت اشتراک</a></p>`,
				cadenceFa(d.Cadence), j.siteURL,
			)
			if err := j.mailer.Send(ctx, d.Email, subject, body); err != nil {
				slog.Warn("subscription renewal job: send failed", "sub_id", d.ID, "err", err)
			}
		}
		if err := j.subs.AdvanceRenewal(ctx, d.ID, models.NextRenewal(d.NextRenewalAt, d.Cadence)); err != nil {
			slog.Warn("subscription renewal job: advance failed", "sub_id", d.ID, "err", err)
			continue
		}
		advanced++
	}
	slog.Info("subscription renewal job: done", "advanced", advanced)
}

func cadenceFa(cadence string) string {
	if cadence == "quarterly" {
		return "فصلی"
	}
	return "ماهانه"
}

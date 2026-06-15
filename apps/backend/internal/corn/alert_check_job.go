package cron

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/notify"
)

// AlertCheckJob scans subscribed product alerts, emails the ones whose condition
// (back in stock / price dropped) is now satisfied, and marks them notified so
// each fires exactly once.
type AlertCheckJob struct {
	alerts  repositories.AlertRepository
	mailer  notify.Mailer
	siteURL string
}

func NewAlertCheckJob(alerts repositories.AlertRepository, mailer notify.Mailer, siteURL string) *AlertCheckJob {
	return &AlertCheckJob{alerts: alerts, mailer: mailer, siteURL: siteURL}
}

func (j *AlertCheckJob) Run(ctx context.Context) {
	pending, err := j.alerts.FindPending(ctx, 500)
	if err != nil {
		slog.Error("alert check job: find pending", "err", err)
		return
	}
	if len(pending) == 0 {
		return
	}

	sent := make([]int64, 0, len(pending))
	for _, a := range pending {
		subject, body := alertEmail(a, j.siteURL)
		if j.mailer != nil {
			if err := j.mailer.Send(ctx, a.Email, subject, body); err != nil {
				slog.Warn("alert check job: send failed", "alert_id", a.ID, "err", err)
				continue
			}
		}
		sent = append(sent, a.ID)
	}

	if err := j.alerts.MarkNotified(ctx, sent); err != nil {
		slog.Error("alert check job: mark notified", "err", err)
		return
	}
	slog.Info("alert check job: done", "notified", len(sent))
}

func alertEmail(a models.PendingAlert, siteURL string) (subject, body string) {
	link := siteURL
	if a.ProductSlug != nil {
		link = fmt.Sprintf("%s/products/%s", siteURL, *a.ProductSlug)
	}
	if a.AlertType == models.AlertRestock {
		subject = "دوباره موجود شد — " + a.ProductTitle
		body = fmt.Sprintf(
			`<p>خبر خوب! «%s» دوباره موجود شد.</p><p><a href="%s">همین حالا ببینید</a></p>`,
			a.ProductTitle, link,
		)
		return
	}
	subject = "کاهش قیمت — " + a.ProductTitle
	body = fmt.Sprintf(
		`<p>قیمت «%s» کاهش یافت.</p><p><a href="%s">مشاهدهٔ محصول</a></p>`,
		a.ProductTitle, link,
	)
	return
}

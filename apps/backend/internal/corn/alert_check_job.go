package cron

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/tiredbooy/internal/features/alerts"
	"github.com/tiredbooy/pkg/notify"
)

// AlertCheckJob scans subscribed product alerts, emails the ones whose condition
// (back in stock / price dropped) is now satisfied, and marks them notified so
// each fires exactly once. notified_at is set only after a successful dispatch
// or Send (PR-053a / PR-055a).
type AlertCheckJob struct {
	alerts     alerts.Repository
	mailer     notify.Mailer
	dispatcher alerts.ProductAlertNotifier
	siteURL    string
}

func NewAlertCheckJob(alerts alerts.Repository, mailer notify.Mailer, siteURL string) *AlertCheckJob {
	return &AlertCheckJob{alerts: alerts, mailer: mailer, siteURL: siteURL}
}

// WithDispatcher prefers the notification outbox (or inline dispatcher) over
// the mailer. Nil is allowed; bootstrap should chain this after New.
func (j *AlertCheckJob) WithDispatcher(d alerts.ProductAlertNotifier) *AlertCheckJob {
	if j != nil {
		j.dispatcher = d
	}
	return j
}

func (j *AlertCheckJob) Run(ctx context.Context) {
	if j.dispatcher == nil && j.mailer == nil {
		slog.Error("alert check job: dispatcher and mailer unset; leaving alerts unnotified")
		return
	}

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
		subject, body := alerts.EmailCopy(a, j.siteURL)
		if err := j.dispatch(ctx, a, subject, body); err != nil {
			slog.Warn("alert check job: send failed", "alert_id", a.ID, "err", err)
			continue
		}
		sent = append(sent, a.ID)
	}

	if len(sent) == 0 {
		return
	}
	if err := j.alerts.MarkNotified(ctx, sent); err != nil {
		slog.Error("alert check job: mark notified", "err", err)
		return
	}
	slog.Info("alert check job: done", "notified", len(sent))
}

func (j *AlertCheckJob) dispatch(ctx context.Context, a alerts.PendingAlert, subject, body string) error {
	if j.dispatcher != nil {
		return j.dispatcher.DispatchAlert(ctx, a.Email, subject, body, a.ID, a.CreatedAt, fmt.Sprintf("alert:%d:%d", a.ID, a.CreatedAt.UTC().Unix()))
	}
	if j.mailer == nil {
		return fmt.Errorf("alert check job: mailer nil")
	}
	return j.mailer.Send(ctx, a.Email, subject, body)
}

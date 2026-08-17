package subscription

import (
	"context"
	"errors"
	"log/slog"
	"time"
)

// Mailer is the subset of pkg/notify used for cellar-box due reminders.
// ProcessDueRenewals will not roll next_renewal_at unless Send succeeds (PR-057a).
type Mailer interface {
	Send(ctx context.Context, to, subject, htmlBody string) error
}

// DueMailer is implemented by dispatcher-backed senders so ProcessDueRenewals
// can pass the due row (id + period) for outbox idempotency (PR-055a).
type DueMailer interface {
	SendDue(ctx context.Context, d DueSubscription, subject, htmlBody string) error
}

// ErrMailerNil is returned when ProcessDueRenewals is invoked without a mailer.
// The due batch is left unadvanced so the next tick can retry.
var ErrMailerNil = errors.New("subscription: mailer nil")

// DefaultDueLimit is the cron batch size (same as the historical job).
const DefaultDueLimit = 500

// RenewalEmailFunc builds the reminder subject/body for a due row.
// The cron supplies the Persian RTL HTML; tests may pass a stub.
type RenewalEmailFunc func(d DueSubscription) (subject, body string)

// ProcessDueRenewals emails due cellar-box subscribers and advances
// next_renewal_at only after a successful dispatch or Send. Nil mailer or
// send failure leaves that row due for the next tick. Never charges (PH-043c).
func ProcessDueRenewals(
	ctx context.Context,
	repo Repository,
	mailer Mailer,
	now time.Time,
	limit int,
	email RenewalEmailFunc,
) (advanced int, err error) {
	if mailer == nil {
		slog.Error("subscription renewal job: dispatcher and mailer unset; leaving renewals unadvanced")
		return 0, ErrMailerNil
	}

	if limit <= 0 {
		limit = DefaultDueLimit
	}
	due, err := repo.FindDue(ctx, now, limit)
	if err != nil {
		slog.Error("subscription renewal job: find due", "err", err)
		return 0, err
	}
	if len(due) == 0 {
		return 0, nil
	}
	if email == nil {
		email = func(DueSubscription) (string, string) { return "", "" }
	}

	for _, d := range due {
		subject, body := email(d)
		if err := sendRenewal(ctx, mailer, d, subject, body); err != nil {
			slog.Warn("subscription renewal job: send failed", "sub_id", d.ID, "err", err)
			continue
		}
		next := NextRenewal(d.NextRenewalAt, d.Cadence)
		if err := repo.AdvanceRenewal(ctx, d.ID, next); err != nil {
			slog.Warn("subscription renewal job: advance failed", "sub_id", d.ID, "err", err)
			continue
		}
		advanced++
	}
	return advanced, nil
}

func sendRenewal(ctx context.Context, mailer Mailer, d DueSubscription, subject, body string) error {
	if dm, ok := mailer.(DueMailer); ok {
		return dm.SendDue(ctx, d, subject, body)
	}
	return mailer.Send(ctx, d.Email, subject, body)
}

// RenewalPeriodKey is the stable outbox idempotency slice for one box window.
func RenewalPeriodKey(d DueSubscription) string {
	if d.NextRenewalAt.IsZero() {
		return "unknown"
	}
	return d.NextRenewalAt.UTC().Format("2006-01-02")
}

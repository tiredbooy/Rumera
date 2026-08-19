package notifications_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/tiredbooy/internal/notifications"
)

func TestDispatcherAsyncEnqueuesOTP(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	outbox := notifications.NewMemoryOutbox()
	d := &notifications.Dispatcher{Mode: "async", Outbox: outbox}
	if err := d.DispatchOTP(ctx, "09121111111", "424242", "login", "c1"); err != nil {
		t.Fatal(err)
	}
	rows, err := outbox.ClaimUnpublished(ctx, 10)
	if err != nil || len(rows) != 1 {
		t.Fatalf("rows=%d err=%v", len(rows), err)
	}
	if rows[0].Topic != notifications.TopicOTP {
		t.Fatalf("topic=%s", rows[0].Topic)
	}
}

func TestDispatcherInlineUsesSMS(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	sms := &stubSMS{}
	d := &notifications.Dispatcher{Mode: "inline", SMS: sms}
	if err := d.DispatchOTP(ctx, "0912", "111111", "login", ""); err != nil {
		t.Fatal(err)
	}
	if sms.sends != 1 {
		t.Fatalf("sends=%d", sms.sends)
	}
}

func TestDispatcherGiftPurchasedAsyncEnqueues(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	outbox := notifications.NewMemoryOutbox()
	d := &notifications.Dispatcher{Mode: "async", Outbox: outbox}
	if err := d.DispatchGiftPurchasedTx(ctx, nil, "buyer@example.com", "کد کارت هدیه رومرا", "<p>x</p>", "gbuy-1", "gift_purchase:gbuy-1"); err != nil {
		t.Fatal(err)
	}
	rows, err := outbox.ClaimUnpublished(ctx, 10)
	if err != nil || len(rows) != 1 {
		t.Fatalf("rows=%d err=%v", len(rows), err)
	}
	if rows[0].Topic != notifications.TopicEmail {
		t.Fatalf("topic=%s", rows[0].Topic)
	}
}

func TestDispatcherGiftPurchasedInlineUsesMail(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	mail := &stubMail{}
	d := &notifications.Dispatcher{Mode: "inline", Mail: mail}
	if err := d.DispatchGiftPurchasedTx(ctx, nil, "buyer@example.com", "subj", "<p>ok</p>", "gbuy-1", "gift_purchase:gbuy-1"); err != nil {
		t.Fatal(err)
	}
	if mail.sends != 1 {
		t.Fatalf("sends=%d", mail.sends)
	}
}

func TestDispatcherAlertAsyncEnqueues(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	outbox := notifications.NewMemoryOutbox()
	d := &notifications.Dispatcher{Mode: "async", Outbox: outbox}
	armed := time.Unix(1_700_000_000, 0).UTC()
	if err := d.DispatchAlert(ctx, "ok@example.com", "دوباره موجود شد", "<p>x</p>", 11, armed, "alert:11"); err != nil {
		t.Fatal(err)
	}
	rows, err := outbox.ClaimUnpublished(ctx, 10)
	if err != nil || len(rows) != 1 {
		t.Fatalf("rows=%d err=%v", len(rows), err)
	}
	if rows[0].Topic != notifications.TopicEmail {
		t.Fatalf("topic=%s", rows[0].Topic)
	}
	if rows[0].IdempotencyKey != "alert:11:notify:1700000000" {
		t.Fatalf("idem=%s", rows[0].IdempotencyKey)
	}
}

func TestDispatcherAlertInlineUsesMail(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	mail := &stubMail{}
	d := &notifications.Dispatcher{Mode: "inline", Mail: mail}
	if err := d.DispatchAlert(ctx, "ok@example.com", "subj", "<p>ok</p>", 11, time.Unix(1, 0), "alert:11"); err != nil {
		t.Fatal(err)
	}
	if mail.sends != 1 {
		t.Fatalf("sends=%d", mail.sends)
	}
}

func TestDispatcherAlertNilFailsClosed(t *testing.T) {
	t.Parallel()
	var d *notifications.Dispatcher
	if err := d.DispatchAlert(context.Background(), "a@b.c", "s", "<p>", 1, time.Time{}, ""); err == nil {
		t.Fatal("expected error on nil dispatcher")
	}
	d = &notifications.Dispatcher{Mode: "inline"}
	if err := d.DispatchAlert(context.Background(), "a@b.c", "s", "<p>", 1, time.Time{}, ""); err == nil {
		t.Fatal("expected error when mailer unset")
	}
}

func TestDispatcherSubscriptionRenewalAsyncEnqueues(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	outbox := notifications.NewMemoryOutbox()
	d := &notifications.Dispatcher{Mode: "async", Outbox: outbox}
	if err := d.DispatchSubscriptionRenewal(ctx, "ok@example.com", "باکس سرداب شما آماده است", "<p>x</p>", 22, "2026-08-01", "sub:22"); err != nil {
		t.Fatal(err)
	}
	rows, err := outbox.ClaimUnpublished(ctx, 10)
	if err != nil || len(rows) != 1 {
		t.Fatalf("rows=%d err=%v", len(rows), err)
	}
	if rows[0].Topic != notifications.TopicEmail {
		t.Fatalf("topic=%s", rows[0].Topic)
	}
	if rows[0].IdempotencyKey != "subscription:22:renewal:2026-08-01" {
		t.Fatalf("idem=%s", rows[0].IdempotencyKey)
	}
}

func TestDispatcherSubscriptionRenewalInlineUsesMail(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	mail := &stubMail{}
	d := &notifications.Dispatcher{Mode: "inline", Mail: mail}
	if err := d.DispatchSubscriptionRenewal(ctx, "ok@example.com", "subj", "<p>ok</p>", 22, "2026-08-01", "sub:22"); err != nil {
		t.Fatal(err)
	}
	if mail.sends != 1 {
		t.Fatalf("sends=%d", mail.sends)
	}
}

func TestDispatcherSubscriptionRenewalNilFailsClosed(t *testing.T) {
	t.Parallel()
	var d *notifications.Dispatcher
	if err := d.DispatchSubscriptionRenewal(context.Background(), "a@b.c", "s", "<p>", 1, "2026-08-01", ""); err == nil {
		t.Fatal("expected error on nil dispatcher")
	}
	d = &notifications.Dispatcher{Mode: "inline"}
	if err := d.DispatchSubscriptionRenewal(context.Background(), "a@b.c", "s", "<p>", 1, "2026-08-01", ""); err == nil {
		t.Fatal("expected error when mailer unset")
	}
}

// failingMail sends successfully only after failN failures, so a test can watch
// a released claim actually re-send.
type failingMail struct {
	sends  int
	failN  int
	lastTo string
}

func (m *failingMail) Send(_ context.Context, to, _, _ string) error {
	m.sends++
	m.lastTo = to
	if m.sends <= m.failN {
		return errors.New("smtp down")
	}
	return nil
}

// sendOnce claims "an inline send at most once per idempotency key" — and the
// claim/confirm shape underneath means a FAILED send must release the claim, or
// a transient SMTP blip would silently swallow the message forever.
func TestInlineSendHappensAtMostOncePerIdempotencyKey(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	mail := &failingMail{}
	ledger := notifications.NewMemoryDeliveries()
	d := &notifications.Dispatcher{Mode: "inline", Mail: mail, Deliveries: ledger}

	const idem = "password_reset:7:abcd"
	for i := 0; i < 3; i++ {
		if err := d.DispatchPasswordReset(ctx, "a@b.c", "s", "<p>x</p>", "", idem); err != nil {
			t.Fatalf("attempt %d: %v", i, err)
		}
	}
	if mail.sends != 1 {
		t.Fatalf("sends = %d; want 1 — a retrying caller re-sent on a confirmed key", mail.sends)
	}

	// A failed send must NOT count as delivered.
	failing := &failingMail{failN: 1}
	d2 := &notifications.Dispatcher{
		Mode: "inline", Mail: failing, Deliveries: notifications.NewMemoryDeliveries(),
	}
	if err := d2.DispatchPasswordReset(ctx, "a@b.c", "s", "<p>x</p>", "", idem); err == nil {
		t.Fatal("a failed provider send returned nil")
	}
	if err := d2.DispatchPasswordReset(ctx, "a@b.c", "s", "<p>x</p>", "", idem); err != nil {
		t.Fatalf("retry after a failed send: %v", err)
	}
	if failing.sends != 2 {
		t.Fatalf("sends = %d; want 2 — a failed send was confirmed as delivered, so the mail is lost", failing.sends)
	}
}

// Idempotency is per arming: a crash-retry of the same created_at must not
// email twice, but a re-subscribe (same id, new created_at) must fire again.
func TestInlineAlertFiresOncePerArming(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	mail := &stubMail{}
	d := &notifications.Dispatcher{
		Mode: "inline", Mail: mail, Deliveries: notifications.NewMemoryDeliveries(),
	}
	firstArm := time.Unix(1_000, 0).UTC()
	for i := 0; i < 3; i++ {
		if err := d.DispatchAlert(ctx, "ok@example.com", "subj", "<p>ok</p>", 11, firstArm, "alert:11"); err != nil {
			t.Fatalf("attempt %d: %v", i, err)
		}
	}
	if mail.sends != 1 {
		t.Fatalf("sends = %d; want 1 — alert 11 was emailed again on a re-run", mail.sends)
	}
	// Re-subscribe resets created_at; the same alert id must send again.
	rearm := time.Unix(2_000, 0).UTC()
	if err := d.DispatchAlert(ctx, "ok@example.com", "subj", "<p>ok</p>", 11, rearm, "alert:11"); err != nil {
		t.Fatal(err)
	}
	if mail.sends != 2 {
		t.Fatalf("sends = %d; want 2 — re-armed alert 11 was swallowed by the first send's key", mail.sends)
	}
	// A different alert is a different key and must still send.
	if err := d.DispatchAlert(ctx, "ok@example.com", "subj", "<p>ok</p>", 12, firstArm, "alert:12"); err != nil {
		t.Fatal(err)
	}
	if mail.sends != 3 {
		t.Fatalf("sends = %d; want 3 — alert 12 was suppressed by alert 11's key", mail.sends)
	}
}

// periodKey scopes the renewal key: the same window must collapse, the next
// window must still go out.
func TestInlineSubscriptionRenewalFiresOncePerPeriodKey(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	mail := &stubMail{}
	d := &notifications.Dispatcher{
		Mode: "inline", Mail: mail, Deliveries: notifications.NewMemoryDeliveries(),
	}
	for i := 0; i < 3; i++ {
		if err := d.DispatchSubscriptionRenewal(ctx, "ok@example.com", "s", "<p>x</p>", 22, "2026-08-01", ""); err != nil {
			t.Fatalf("attempt %d: %v", i, err)
		}
	}
	if mail.sends != 1 {
		t.Fatalf("sends = %d; want 1 — the same renewal window mailed twice", mail.sends)
	}
	if err := d.DispatchSubscriptionRenewal(ctx, "ok@example.com", "s", "<p>x</p>", 22, "2026-09-01", ""); err != nil {
		t.Fatal(err)
	}
	if mail.sends != 2 {
		t.Fatalf("sends = %d; want 2 — the next cadence was swallowed as a duplicate", mail.sends)
	}
}

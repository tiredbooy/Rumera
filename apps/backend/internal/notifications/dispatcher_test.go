package notifications_test

import (
	"context"
	"testing"

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
	if err := d.DispatchGiftPurchased(ctx, "buyer@example.com", "کد کارت هدیه رومرا", "<p>x</p>", "gbuy-1", "gift_purchase:gbuy-1"); err != nil {
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
	if err := d.DispatchGiftPurchased(ctx, "buyer@example.com", "subj", "<p>ok</p>", "gbuy-1", "gift_purchase:gbuy-1"); err != nil {
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
	if err := d.DispatchAlert(ctx, "ok@example.com", "دوباره موجود شد", "<p>x</p>", 11, "alert:11"); err != nil {
		t.Fatal(err)
	}
	rows, err := outbox.ClaimUnpublished(ctx, 10)
	if err != nil || len(rows) != 1 {
		t.Fatalf("rows=%d err=%v", len(rows), err)
	}
	if rows[0].Topic != notifications.TopicEmail {
		t.Fatalf("topic=%s", rows[0].Topic)
	}
	if rows[0].IdempotencyKey != "alert:11:notify" {
		t.Fatalf("idem=%s", rows[0].IdempotencyKey)
	}
}

func TestDispatcherAlertInlineUsesMail(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	mail := &stubMail{}
	d := &notifications.Dispatcher{Mode: "inline", Mail: mail}
	if err := d.DispatchAlert(ctx, "ok@example.com", "subj", "<p>ok</p>", 11, "alert:11"); err != nil {
		t.Fatal(err)
	}
	if mail.sends != 1 {
		t.Fatalf("sends=%d", mail.sends)
	}
}

func TestDispatcherAlertNilFailsClosed(t *testing.T) {
	t.Parallel()
	var d *notifications.Dispatcher
	if err := d.DispatchAlert(context.Background(), "a@b.c", "s", "<p>", 1, ""); err == nil {
		t.Fatal("expected error on nil dispatcher")
	}
	d = &notifications.Dispatcher{Mode: "inline"}
	if err := d.DispatchAlert(context.Background(), "a@b.c", "s", "<p>", 1, ""); err == nil {
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

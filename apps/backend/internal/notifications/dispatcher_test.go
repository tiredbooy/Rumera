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

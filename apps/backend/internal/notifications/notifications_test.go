package notifications_test

import (
	"context"
	"testing"

	"github.com/tiredbooy/internal/notifications"
)

type stubSMS struct {
	sends int
}

func (s *stubSMS) Send(context.Context, string, string) error {
	s.sends++
	return nil
}

type stubMail struct {
	sends int
}

func (s *stubMail) Send(context.Context, string, string, string) error {
	s.sends++
	return nil
}

func TestEnqueueAndRelayPublishesOnce(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	outbox := notifications.NewMemoryOutbox()
	pub := &notifications.MemoryPublisher{}

	env, err := notifications.NewEnvelope(
		notifications.TypeOTPV1,
		"otp:09120000000:login:1",
		"corr-1",
		notifications.OTPData{Phone: "09120000000", Code: "12345", Purpose: "login"},
	)
	if err != nil {
		t.Fatal(err)
	}
	if err := notifications.EnqueueEnvelope(ctx, outbox, env); err != nil {
		t.Fatal(err)
	}
	// Duplicate idempotency is a no-op.
	if err := notifications.EnqueueEnvelope(ctx, outbox, env); err != nil {
		t.Fatal(err)
	}

	relay := &notifications.Relay{Outbox: outbox, Publisher: pub, BatchSize: 10}
	n, err := relay.RunOnce(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if n != 1 || len(pub.Messages) != 1 {
		t.Fatalf("published=%d msgs=%d; want 1", n, len(pub.Messages))
	}
	if pub.Messages[0].Topic != notifications.TopicOTP {
		t.Fatalf("topic=%s", pub.Messages[0].Topic)
	}
	if pub.Messages[0].Key != "09120000000" {
		t.Fatalf("key=%s", pub.Messages[0].Key)
	}

	// Second relay: already published.
	n, err = relay.RunOnce(ctx)
	if err != nil || n != 0 {
		t.Fatalf("second relay n=%d err=%v", n, err)
	}
}

func TestDeliveryHandlerIdempotent(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	sms := &stubSMS{}
	deliveries := notifications.NewMemoryDeliveries()
	h := &notifications.DeliveryHandler{Deliveries: deliveries, SMS: sms, MaxAttempts: 8}

	env, err := notifications.NewEnvelope(
		notifications.TypeOTPV1,
		"otp:idem-1",
		"",
		notifications.OTPData{Phone: "0912", Code: "99999", Purpose: "login"},
	)
	if err != nil {
		t.Fatal(err)
	}
	outbox := notifications.NewMemoryOutbox()
	if err := notifications.EnqueueEnvelope(ctx, outbox, env); err != nil {
		t.Fatal(err)
	}
	rows, err := outbox.ClaimUnpublished(ctx, 1)
	if err != nil || len(rows) != 1 {
		t.Fatalf("rows=%d err=%v", len(rows), err)
	}

	done, err := h.Handle(ctx, notifications.TopicOTP, rows[0].Payload)
	if err != nil || !done || sms.sends != 1 {
		t.Fatalf("first handle done=%v err=%v sends=%d", done, err, sms.sends)
	}
	done, err = h.Handle(ctx, notifications.TopicOTP, rows[0].Payload)
	if err != nil || !done || sms.sends != 1 {
		t.Fatalf("second handle should skip send: done=%v err=%v sends=%d", done, err, sms.sends)
	}
}

func TestTopicAndDLQRouting(t *testing.T) {
	t.Parallel()
	topic, err := notifications.TopicForEvent(notifications.TypeOrderConfirmedV1)
	if err != nil || topic != notifications.TopicEmail {
		t.Fatalf("topic=%s err=%v", topic, err)
	}
	for _, typ := range []string{
		notifications.TypeAlertV1,
		notifications.TypeSubscriptionRenewalV1,
		notifications.TypeGiftPurchasedV1,
	} {
		got, err := notifications.TopicForEvent(typ)
		if err != nil || got != notifications.TopicEmail {
			t.Fatalf("type %s topic=%s err=%v", typ, got, err)
		}
	}
	if notifications.DLQTopic(notifications.TopicEmail) != notifications.TopicEmailDLQ {
		t.Fatal("dlq mapping")
	}
	if !notifications.ShouldDLQ(8, 8) || notifications.ShouldDLQ(3, 8) {
		t.Fatal("dlq attempt gate")
	}
}

func TestEmailDispatch(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	mail := &stubMail{}
	h := &notifications.DeliveryHandler{
		Deliveries: notifications.NewMemoryDeliveries(),
		Mail:       mail,
	}
	env, err := notifications.NewEnvelope(
		notifications.TypeOrderConfirmedV1,
		"order:9:confirm",
		"c",
		notifications.EmailData{To: "a@b.c", Subject: "Order", Template: "<p>ok</p>"},
	)
	if err != nil {
		t.Fatal(err)
	}
	outbox := notifications.NewMemoryOutbox()
	_ = notifications.EnqueueEnvelope(ctx, outbox, env)
	rows, _ := outbox.ClaimUnpublished(ctx, 1)
	done, err := h.Handle(ctx, notifications.TopicEmail, rows[0].Payload)
	if err != nil || !done || mail.sends != 1 {
		t.Fatalf("done=%v err=%v sends=%d", done, err, mail.sends)
	}
}

func TestAlertAndRenewalEmailDispatch(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	for _, typ := range []string{notifications.TypeAlertV1, notifications.TypeSubscriptionRenewalV1} {
		mail := &stubMail{}
		h := &notifications.DeliveryHandler{
			Deliveries: notifications.NewMemoryDeliveries(),
			Mail:       mail,
		}
		env, err := notifications.NewEnvelope(
			typ,
			typ+":idem",
			"c",
			notifications.EmailData{To: "a@b.c", Subject: "s", Template: "<p>ok</p>"},
		)
		if err != nil {
			t.Fatal(err)
		}
		outbox := notifications.NewMemoryOutbox()
		_ = notifications.EnqueueEnvelope(ctx, outbox, env)
		rows, _ := outbox.ClaimUnpublished(ctx, 1)
		done, err := h.Handle(ctx, notifications.TopicEmail, rows[0].Payload)
		if err != nil || !done || mail.sends != 1 {
			t.Fatalf("type %s done=%v err=%v sends=%d", typ, done, err, mail.sends)
		}
	}
}

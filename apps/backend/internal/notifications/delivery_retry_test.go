package notifications

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
)

// scriptedSMS fails a scripted number of times before succeeding, recording
// every send it was actually asked to perform.
type scriptedSMS struct {
	failures int
	sent     []string
}

func (s *scriptedSMS) Send(_ context.Context, to, _ string) error {
	if s.failures > 0 {
		s.failures--
		return errors.New("gateway timeout")
	}
	s.sent = append(s.sent, to)
	return nil
}

func otpPayload(t *testing.T, key, phone, code string) []byte {
	t.Helper()
	env, err := NewEnvelope(TypeOTPV1, key, "", OTPData{Phone: phone, Code: code, Purpose: "login"})
	if err != nil {
		t.Fatalf("NewEnvelope: %v", err)
	}
	raw, err := json.Marshal(env)
	if err != nil {
		t.Fatalf("marshal envelope: %v", err)
	}
	return raw
}

// This is the regression that mattered most: the ledger used to be written
// BEFORE the provider call and treated as proof of delivery, so the first
// gateway failure marked the message delivered forever and the retry silently
// skipped it. At-least-once was really at-most-never.
func TestFailedSendIsRetriedAndEventuallyDelivered(t *testing.T) {
	sms := &scriptedSMS{failures: 1}
	deliveries := NewMemoryDeliveries()
	h := &DeliveryHandler{Deliveries: deliveries, SMS: sms}
	raw := otpPayload(t, "otp:0912:login", "0912", "123456")

	// First attempt: provider fails. Must be retryable and must NOT be recorded
	// as delivered.
	done, err := h.Handle(context.Background(), TopicOTP, raw)
	if err == nil {
		t.Fatal("first attempt returned no error despite a provider failure")
	}
	if done {
		t.Error("done=true after a transient provider failure; the message would be committed and lost")
	}
	if deliveries.Delivered("otp:0912:login") {
		t.Fatal("a failed send was recorded as delivered")
	}

	// Second attempt: provider recovers. The send must actually happen.
	done, err = h.Handle(context.Background(), TopicOTP, raw)
	if err != nil {
		t.Fatalf("retry failed: %v", err)
	}
	if !done {
		t.Error("done=false after a successful send")
	}
	if len(sms.sent) != 1 {
		t.Fatalf("provider received %d sends; want exactly 1 (the retry must re-send)", len(sms.sent))
	}
	if !deliveries.Delivered("otp:0912:login") {
		t.Error("successful send was not confirmed in the ledger")
	}
}

func TestConfirmedDeliveryIsNotResent(t *testing.T) {
	sms := &scriptedSMS{}
	deliveries := NewMemoryDeliveries()
	h := &DeliveryHandler{Deliveries: deliveries, SMS: sms}
	raw := otpPayload(t, "otp:0913:login", "0913", "654321")

	for i := 0; i < 3; i++ {
		done, err := h.Handle(context.Background(), TopicOTP, raw)
		if err != nil || !done {
			t.Fatalf("attempt %d: done=%v err=%v", i, done, err)
		}
	}
	if len(sms.sent) != 1 {
		t.Errorf("provider received %d sends across 3 deliveries; want 1", len(sms.sent))
	}
}

func TestPermanentFailuresAreNotRetried(t *testing.T) {
	cases := []struct {
		name    string
		handler *DeliveryHandler
		raw     []byte
	}{
		{
			name:    "malformed envelope",
			handler: &DeliveryHandler{Deliveries: NewMemoryDeliveries()},
			raw:     []byte("{not json"),
		},
		{
			name:    "unsupported type",
			handler: &DeliveryHandler{Deliveries: NewMemoryDeliveries()},
			raw: func() []byte {
				env, _ := NewEnvelope(TypeOTPV1, "k", "", OTPData{Phone: "1", Code: "2"})
				env.Type = "notification.unknown.v1"
				raw, _ := json.Marshal(env)
				return raw
			}(),
		},
		{
			name:    "provider not configured",
			handler: &DeliveryHandler{Deliveries: NewMemoryDeliveries(), SMS: nil},
			raw: func() []byte {
				env, _ := NewEnvelope(TypeOTPV1, "k2", "", OTPData{Phone: "1", Code: "2"})
				raw, _ := json.Marshal(env)
				return raw
			}(),
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			done, err := tc.handler.Handle(context.Background(), TopicOTP, tc.raw)
			if err == nil {
				t.Fatal("want an error")
			}
			// done=true routes to the DLQ. Without it the consumer would retry a
			// message that can never succeed, stalling the partition.
			if !done {
				t.Error("done=false for a permanent failure; it would be retried forever")
			}
		})
	}
}

func TestMissingIdempotencyKeyIsPermanent(t *testing.T) {
	h := &DeliveryHandler{Deliveries: NewMemoryDeliveries(), SMS: &scriptedSMS{}}
	env, _ := NewEnvelope(TypeOTPV1, "temp", "", OTPData{Phone: "1", Code: "2"})
	env.Rumera.IdempotencyKey = ""
	raw, _ := json.Marshal(env)

	done, err := h.Handle(context.Background(), TopicOTP, raw)
	if err == nil || !done {
		t.Errorf("got (done=%v, err=%v); an unkeyed message cannot be deduped and must be dead-lettered", done, err)
	}
}

// A ledger that is itself unavailable must not cause a send: without a claim,
// a redelivery would duplicate the message.
func TestLedgerFailureDoesNotSend(t *testing.T) {
	sms := &scriptedSMS{}
	h := &DeliveryHandler{Deliveries: brokenDeliveries{}, SMS: sms}
	raw := otpPayload(t, "otp:0914:login", "0914", "111111")

	done, err := h.Handle(context.Background(), TopicOTP, raw)
	if err == nil {
		t.Fatal("want an error when the ledger is down")
	}
	if done {
		t.Error("done=true when the ledger is down; the message would be committed unsent")
	}
	if len(sms.sent) != 0 {
		t.Error("sent without a delivery claim; a redelivery would duplicate it")
	}
}

type brokenDeliveries struct{}

func (brokenDeliveries) TryBegin(context.Context, string, string, string, string) (bool, error) {
	return false, errors.New("ledger unavailable")
}
func (brokenDeliveries) ConfirmDelivery(context.Context, string) error      { return nil }
func (brokenDeliveries) FailDelivery(context.Context, string, string) error { return nil }

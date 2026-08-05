package notifications

import (
	"context"
	"encoding/json"
	"fmt"
)

// SMSSender is the subset of pkg/sms used by the worker (keeps package free of
// import cycles in tests).
type SMSSender interface {
	Send(ctx context.Context, to, message string) error
}

// Mailer is the subset of pkg/notify used by the worker.
type Mailer interface {
	Send(ctx context.Context, to, subject, htmlBody string) error
}

// DeliveryHandler dispatches a single envelope to the correct channel after
// idempotency checks.
type DeliveryHandler struct {
	Deliveries DeliveryStore
	SMS        SMSSender
	Mail       Mailer
	// MaxAttempts before the worker should DLQ (attempt is on the envelope).
	MaxAttempts int
}

// Handle returns (done, error). done=true means commit offset (delivered, duplicate, or DLQ'd).
func (h *DeliveryHandler) Handle(ctx context.Context, topic string, raw []byte) (done bool, err error) {
	var env Envelope
	if err := json.Unmarshal(raw, &env); err != nil {
		// Poison message — send to DLQ path by signaling permanent failure.
		return true, fmt.Errorf("notifications: invalid envelope: %w", err)
	}
	if env.Rumera.IdempotencyKey == "" {
		return true, fmt.Errorf("notifications: missing idempotency_key")
	}

	channel := ChannelForEvent(env.Type)
	first, err := h.Deliveries.TryBegin(ctx, env.Rumera.IdempotencyKey, topic, env.ID, channel)
	if err != nil {
		return false, err
	}
	if !first {
		// Already delivered — safe to commit.
		return true, nil
	}

	if err := h.dispatch(ctx, &env); err != nil {
		return false, err
	}
	return true, nil
}

func (h *DeliveryHandler) dispatch(ctx context.Context, env *Envelope) error {
	switch env.Type {
	case TypeOTPV1:
		var data OTPData
		if err := json.Unmarshal(env.Data, &data); err != nil {
			return err
		}
		if h.SMS == nil {
			return fmt.Errorf("notifications: SMS sender not configured")
		}
		msg := fmt.Sprintf("کد تأیید رومرا: %s", data.Code)
		return h.SMS.Send(ctx, data.Phone, msg)
	case TypePasswordResetV1, TypeOrderConfirmedV1:
		var data EmailData
		if err := json.Unmarshal(env.Data, &data); err != nil {
			return err
		}
		if h.Mail == nil {
			return fmt.Errorf("notifications: mailer not configured")
		}
		body := data.Template
		if body == "" {
			body = "<p>Notification from Rumera</p>"
		}
		return h.Mail.Send(ctx, data.To, data.Subject, body)
	default:
		return fmt.Errorf("notifications: unsupported type %q", env.Type)
	}
}

// ShouldDLQ reports whether attempt has exhausted retries.
func ShouldDLQ(attempt, max int) bool {
	if max <= 0 {
		max = 8
	}
	return attempt >= max
}

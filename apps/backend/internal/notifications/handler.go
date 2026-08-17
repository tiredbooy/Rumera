package notifications

import (
	"context"
	"encoding/json"
	"errors"
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

// errPermanent marks a failure that retrying cannot fix — a malformed payload,
// an unknown type, a provider that is not wired up. These go straight to the
// DLQ instead of burning the retry budget and stalling the partition.
var errPermanent = errors.New("notifications: permanent failure")

// ErrDeliveredUnconfirmed means the side effect DID happen but the ledger write
// that records it did not. The offset must be committed (a redelivery would
// re-send), but the message must NOT be dead-lettered: the DLQ copy of an OTP
// carries the plaintext code, and a later bulk replay would text it again.
var ErrDeliveredUnconfirmed = errors.New("notifications: delivered but not confirmed")

// ErrRetryIndefinitely marks an infrastructure failure — the database is down,
// not the message is bad. Dead-lettering it would discard a perfectly good
// message because a dependency blinked, so the consumer keeps retrying instead
// of spending the attempt budget.
var ErrRetryIndefinitely = errors.New("notifications: retry indefinitely")

func permanent(format string, args ...any) error {
	return fmt.Errorf("%w: %s", errPermanent, fmt.Sprintf(format, args...))
}

// Handle returns (done, error).
//
// done=true means the offset may be committed: delivered, a confirmed
// duplicate, or permanently rejected (the caller DLQs it).
// done=false with a non-nil error means retry — the message is still owed.
func (h *DeliveryHandler) Handle(ctx context.Context, topic string, raw []byte) (done bool, err error) {
	var env Envelope
	if err := json.Unmarshal(raw, &env); err != nil {
		return true, permanent("invalid envelope: %v", err)
	}
	if env.Rumera.IdempotencyKey == "" {
		return true, permanent("missing idempotency_key")
	}

	channel := ChannelForEvent(env.Type)
	claimed, err := h.Deliveries.TryBegin(ctx, env.Rumera.IdempotencyKey, topic, env.ID, channel)
	if err != nil {
		// The ledger itself is unavailable — retryable, and we must NOT send
		// without a claim or a redelivery would duplicate. Flagged as
		// infrastructure so the message is not dead-lettered over a DB blip.
		return false, fmt.Errorf("%w: delivery ledger: %v", ErrRetryIndefinitely, err)
	}
	if !claimed {
		// Confirmed delivery already exists — safe to commit.
		return true, nil
	}

	if derr := h.dispatch(ctx, &env); derr != nil {
		// Release the claim so the retry actually re-sends.
		if ferr := h.Deliveries.FailDelivery(ctx, env.Rumera.IdempotencyKey, derr.Error()); ferr != nil {
			return false, fmt.Errorf("dispatch failed (%v); releasing claim also failed: %w", derr, ferr)
		}
		if errors.Is(derr, errPermanent) {
			return true, derr
		}
		return false, derr
	}

	if err := h.Deliveries.ConfirmDelivery(ctx, env.Rumera.IdempotencyKey); err != nil {
		// The side effect already happened. Commit — a retry would re-send — but
		// flag it so the consumer does NOT dead-letter a successful delivery.
		return true, fmt.Errorf("%w: key %s: %v", ErrDeliveredUnconfirmed, env.Rumera.IdempotencyKey, err)
	}
	return true, nil
}

func (h *DeliveryHandler) dispatch(ctx context.Context, env *Envelope) error {
	switch env.Type {
	case TypeOTPV1:
		var data OTPData
		if err := json.Unmarshal(env.Data, &data); err != nil {
			return permanent("bad %s payload: %v", env.Type, err)
		}
		if h.SMS == nil {
			return permanent("SMS sender not configured")
		}
		msg := fmt.Sprintf("کد تأیید رومرا: %s", data.Code)
		// A provider error IS retryable — the gateway may just be down.
		return h.SMS.Send(ctx, data.Phone, msg)
	case TypePasswordResetV1, TypeOrderConfirmedV1, TypeGiftPurchasedV1,
		TypeAlertV1, TypeSubscriptionRenewalV1:
		var data EmailData
		if err := json.Unmarshal(env.Data, &data); err != nil {
			return permanent("bad %s payload: %v", env.Type, err)
		}
		if h.Mail == nil {
			return permanent("mailer not configured")
		}
		body := data.Template
		if body == "" {
			body = "<p>Notification from Rumera</p>"
		}
		return h.Mail.Send(ctx, data.To, data.Subject, body)
	default:
		return permanent("unsupported type %q", env.Type)
	}
}

// ShouldDLQ reports whether attempt has exhausted retries.
func ShouldDLQ(attempt, max int) bool {
	if max <= 0 {
		max = 8
	}
	return attempt >= max
}

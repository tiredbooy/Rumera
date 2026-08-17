package notifications

import (
	"context"
	"fmt"
)

// Dispatcher is the single entry point handlers/services use for outbound
// notifications. Mode "async" writes the outbox (Kafka path); "inline" calls
// providers on the spot (legacy / local without brokers).
type Dispatcher struct {
	Mode   string // "inline" | "async"
	Outbox OutboxStore
	SMS    SMSSender
	Mail   Mailer
	// Deliveries dedupes INLINE sends. In async mode the outbox's unique
	// idempotency key does that job, but inline mode used to compute a key and
	// then throw it away — so a caller that retries (an event consumer, a cron
	// sweep) sent the message again. Optional: nil keeps the old send-every-time
	// behaviour.
	Deliveries DeliveryStore
}

// Async reports whether new notifications should go through the outbox.
func (d *Dispatcher) Async() bool {
	return d != nil && d.Mode == "async" && d.Outbox != nil
}

// sendOnce performs an inline send at most once per idempotency key.
//
// Same claim/confirm shape as the async worker's DeliveryHandler: reserve the
// key, send, then settle. A failed send releases the claim so a retry really
// re-sends; a confirmed one short-circuits every later attempt.
func (d *Dispatcher) sendOnce(ctx context.Context, idem, topic, channel string, send func(context.Context) error) error {
	if d.Deliveries == nil || idem == "" {
		return send(ctx)
	}
	claimed, err := d.Deliveries.TryBegin(ctx, idem, topic, idem, channel)
	if err != nil {
		return fmt.Errorf("notifications: claim %s: %w", idem, err)
	}
	if !claimed {
		return nil // already delivered
	}
	if err := send(ctx); err != nil {
		_ = d.Deliveries.FailDelivery(ctx, idem, err.Error())
		return err
	}
	return d.Deliveries.ConfirmDelivery(ctx, idem)
}

// DispatchOTP queues or sends a login OTP SMS.
func (d *Dispatcher) DispatchOTP(ctx context.Context, phone, code, purpose, correlationID string) error {
	if d == nil {
		return fmt.Errorf("notifications: dispatcher nil")
	}
	idem := fmt.Sprintf("otp:%s:%s:%s", phone, purpose, code)
	if d.Async() {
		env, err := NewEnvelope(TypeOTPV1, idem, correlationID, OTPData{
			Phone: phone, Code: code, Purpose: purpose,
		})
		if err != nil {
			return err
		}
		return EnqueueEnvelope(ctx, d.Outbox, env)
	}
	if d.SMS == nil {
		return fmt.Errorf("notifications: SMS not configured")
	}
	msg := fmt.Sprintf("کد ورود شما به رومرا: %s", code)
	return d.sendOnce(ctx, idem, TopicOTP, "sms", func(ctx context.Context) error {
		return d.SMS.Send(ctx, phone, msg)
	})
}

// DispatchPasswordReset queues or sends the reset email HTML body.
// idempotencyKey must be stable per reset token (e.g. password_reset:{userID}:{tokenPrefix}).
func (d *Dispatcher) DispatchPasswordReset(ctx context.Context, to, subject, htmlBody, correlationID, idempotencyKey string) error {
	if d == nil {
		return fmt.Errorf("notifications: dispatcher nil")
	}
	if idempotencyKey == "" {
		idempotencyKey = fmt.Sprintf("password_reset:%s:%d", to, len(htmlBody))
	}
	if d.Async() {
		env, err := NewEnvelope(TypePasswordResetV1, idempotencyKey, correlationID, EmailData{
			To: to, Subject: subject, Template: htmlBody,
		})
		if err != nil {
			return err
		}
		return EnqueueEnvelope(ctx, d.Outbox, env)
	}
	if d.Mail == nil {
		return fmt.Errorf("notifications: mailer not configured")
	}
	return d.sendOnce(ctx, idempotencyKey, TopicEmail, "email", func(ctx context.Context) error {
		return d.Mail.Send(ctx, to, subject, htmlBody)
	})
}

// DispatchOrderConfirmed queues or sends the order receipt email.
func (d *Dispatcher) DispatchOrderConfirmed(ctx context.Context, to, subject, htmlBody string, orderID int64, correlationID string) error {
	if d == nil {
		return fmt.Errorf("notifications: dispatcher nil")
	}
	idem := fmt.Sprintf("order:%d:confirm", orderID)
	if d.Async() {
		env, err := NewEnvelope(TypeOrderConfirmedV1, idem, correlationID, EmailData{
			To: to, Subject: subject, Template: htmlBody,
			Vars: map[string]any{"order_id": orderID},
		})
		if err != nil {
			return err
		}
		return EnqueueEnvelope(ctx, d.Outbox, env)
	}
	if d.Mail == nil {
		return fmt.Errorf("notifications: mailer not configured")
	}
	// Without this the order.paid receipt consumer would email again on every
	// retry, because inline mode previously discarded the idempotency key.
	return d.sendOnce(ctx, idem, TopicEmail, "email", func(ctx context.Context) error {
		return d.Mail.Send(ctx, to, subject, htmlBody)
	})
}

// DispatchGiftPurchased queues or sends the paid gift-card code email (PR-005b).
// idempotencyKey must be stable per purchase (e.g. gift_purchase:{purchaseTxID}).
func (d *Dispatcher) DispatchGiftPurchased(ctx context.Context, to, subject, htmlBody, correlationID, idempotencyKey string) error {
	if d == nil {
		return fmt.Errorf("notifications: dispatcher nil")
	}
	if idempotencyKey == "" {
		idempotencyKey = fmt.Sprintf("gift_purchase:%s:%d", to, len(htmlBody))
	}
	if d.Async() {
		env, err := NewEnvelope(TypeGiftPurchasedV1, idempotencyKey, correlationID, EmailData{
			To: to, Subject: subject, Template: htmlBody,
		})
		if err != nil {
			return err
		}
		return EnqueueEnvelope(ctx, d.Outbox, env)
	}
	if d.Mail == nil {
		return fmt.Errorf("notifications: mailer not configured")
	}
	return d.Mail.Send(ctx, to, subject, htmlBody)
}

// DispatchAlert queues or sends a restock / price-drop email (PR-055a).
// Idempotency is per alert id — each row fires once after notified_at is set.
func (d *Dispatcher) DispatchAlert(ctx context.Context, to, subject, htmlBody string, alertID int64, correlationID string) error {
	if d == nil {
		return fmt.Errorf("notifications: dispatcher nil")
	}
	idem := fmt.Sprintf("alert:%d:notify", alertID)
	if d.Async() {
		env, err := NewEnvelope(TypeAlertV1, idem, correlationID, EmailData{
			To: to, Subject: subject, Template: htmlBody,
			Vars: map[string]any{"alert_id": alertID},
		})
		if err != nil {
			return err
		}
		return EnqueueEnvelope(ctx, d.Outbox, env)
	}
	if d.Mail == nil {
		return fmt.Errorf("notifications: mailer not configured")
	}
	return d.Mail.Send(ctx, to, subject, htmlBody)
}

// DispatchSubscriptionRenewal queues or sends the cellar-box due reminder (PR-055a).
// periodKey must be stable per renewal window (typically next_renewal_at UTC date)
// so a later cadence is not treated as a duplicate of the previous send.
func (d *Dispatcher) DispatchSubscriptionRenewal(ctx context.Context, to, subject, htmlBody string, subscriptionID int64, periodKey, correlationID string) error {
	if d == nil {
		return fmt.Errorf("notifications: dispatcher nil")
	}
	if periodKey == "" {
		periodKey = "unknown"
	}
	idem := fmt.Sprintf("subscription:%d:renewal:%s", subscriptionID, periodKey)
	if d.Async() {
		env, err := NewEnvelope(TypeSubscriptionRenewalV1, idem, correlationID, EmailData{
			To: to, Subject: subject, Template: htmlBody,
			Vars: map[string]any{"subscription_id": subscriptionID, "period": periodKey},
		})
		if err != nil {
			return err
		}
		return EnqueueEnvelope(ctx, d.Outbox, env)
	}
	if d.Mail == nil {
		return fmt.Errorf("notifications: mailer not configured")
	}
	return d.Mail.Send(ctx, to, subject, htmlBody)
}

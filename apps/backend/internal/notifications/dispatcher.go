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
}

// Async reports whether new notifications should go through the outbox.
func (d *Dispatcher) Async() bool {
	return d != nil && d.Mode == "async" && d.Outbox != nil
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
	return d.SMS.Send(ctx, phone, msg)
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
	return d.Mail.Send(ctx, to, subject, htmlBody)
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
	return d.Mail.Send(ctx, to, subject, htmlBody)
}

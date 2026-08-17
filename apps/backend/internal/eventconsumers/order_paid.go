// Package eventconsumers holds the handlers that react to committed domain
// facts. It sits between internal/events (the bus) and internal/features (the
// behaviour), so features never import the bus and the bus never imports
// features.
//
// Every handler here must be idempotent — delivery is at-least-once. Each one
// leans on a domain-level guard (a unique ledger row, a per-order flag) rather
// than on the consumption ledger, because a crash between "side effect done"
// and "row marked done" re-runs the handler.
package eventconsumers

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/tiredbooy/internal/events"
)

// ── receipt ──────────────────────────────────────────────────────────────────

// ReceiptSender emails the buyer. Implemented by orders.ReceiptSender.
//
// Deliberately the *Now* (synchronous) method: the fire-and-forget variant
// detaches onto a goroutine and returns nil immediately, which would let this
// consumer mark the fact handled before the mail was handed off — a crash in
// that window loses the receipt with no retry, the exact failure the bus exists
// to remove.
type ReceiptSender interface {
	SendPaidOrderReceiptNow(ctx context.Context, userID, orderID int64, amount float64) error
}

// ReceiptConsumer sends the paid-order receipt.
//
// Replaces a post-commit `async.GoCtx` that lost the email on any crash between
// COMMIT and the goroutine actually running. Now the fact is durable before the
// transaction commits, so the receipt survives a restart.
type ReceiptConsumer struct {
	Sender ReceiptSender
}

func (c *ReceiptConsumer) Name() string    { return "order_paid.receipt" }
func (c *ReceiptConsumer) Types() []string { return []string{events.TypeOrderPaidV1} }

func (c *ReceiptConsumer) Handle(ctx context.Context, env *events.Envelope) error {
	var d events.OrderPaidData
	if err := env.UnmarshalData(&d); err != nil {
		return events.Permanent(err)
	}
	if c.Sender == nil {
		// Not wired in this deployment — nothing will ever send it.
		return events.Permanent(fmt.Errorf("receipt sender not configured"))
	}
	if d.OrderID <= 0 {
		return events.Permanent(fmt.Errorf("order.paid without an order id"))
	}
	// Dedupe lives in the notification outbox: the dispatcher keys this send on
	// "order:{id}:confirm", so a redelivered fact collapses to one email.
	return c.Sender.SendPaidOrderReceiptNow(ctx, d.UserID, d.OrderID, d.Amount)
}

// ── loyalty + referral ───────────────────────────────────────────────────────

// OrderEarner awards points for a paid order. Implemented by loyalty.Service.
type OrderEarner interface {
	AwardForOrder(ctx context.Context, userID, orderID int64, amount float64) error
}

// PaidOrderHook completes a pending referral. Implemented by referral.Service.
type PaidOrderHook interface {
	OnPaidOrder(ctx context.Context, refereeID int64) error
}

// EarnIntentCloser marks the payments-side earn intent as settled so the cron
// sweeper stops picking it up. Implemented by payments.Service's repository.
type EarnIntentCloser interface {
	MarkEarnAwarded(ctx context.Context, orderID int64) error
}

// OrderStatusReader reports whether an order is still in a paid-like state.
// Implemented by orders.ReceiptSender's lookup (orders.Service).
type OrderStatusReader interface {
	IsOrderStillPaid(ctx context.Context, orderID int64) (bool, error)
}

// LoyaltyConsumer awards loyalty points and completes referrals.
//
// This is the consumer that fixes the wallet hole: previously only gateway
// Confirm produced an earn intent, so wallet-paid orders never earned anything.
// Both rails now emit the same fact, so both earn.
//
// Idempotency is the loyalty ledger's own UNIQUE (reason, ref_type, ref_id) —
// a redelivered fact re-runs AwardForOrder and the second insert is a no-op.
type LoyaltyConsumer struct {
	Loyalty  OrderEarner
	Referral PaidOrderHook
	Intents  EarnIntentCloser
	// Orders re-checks that the order is still paid before awarding. Awarding is
	// no longer in-request, so a refund can now overtake it: the clawback runs on
	// an order that has not earned yet, finds nothing, and the award lands
	// afterwards leaving redeemable points on a refunded order. Optional — nil
	// skips the check and restores the previous (racy) behaviour.
	Orders OrderStatusReader
}

func (c *LoyaltyConsumer) Name() string    { return "order_paid.loyalty" }
func (c *LoyaltyConsumer) Types() []string { return []string{events.TypeOrderPaidV1} }

func (c *LoyaltyConsumer) Handle(ctx context.Context, env *events.Envelope) error {
	var d events.OrderPaidData
	if err := env.UnmarshalData(&d); err != nil {
		return events.Permanent(err)
	}
	if d.UserID <= 0 || d.OrderID <= 0 {
		return events.Permanent(fmt.Errorf("order.paid without user or order id"))
	}

	// The award is asynchronous now, so a refund issued in the meantime must
	// win. Without this a clawback that runs before the award finds no points to
	// reverse, and the award then credits an order that was already refunded.
	if c.Orders != nil {
		stillPaid, err := c.Orders.IsOrderStillPaid(ctx, d.OrderID)
		if err != nil {
			return fmt.Errorf("check order %d status: %w", d.OrderID, err)
		}
		if !stillPaid {
			slog.Info("eventconsumers: skipping loyalty award, order no longer paid",
				"order_id", d.OrderID)
			return nil
		}
	}

	// Award first, then complete the referral — same order as the legacy
	// post-commit path, so a partial failure retries in the same sequence.
	if c.Loyalty != nil {
		if err := c.Loyalty.AwardForOrder(ctx, d.UserID, d.OrderID, d.Amount); err != nil {
			return fmt.Errorf("award loyalty for order %d: %w", d.OrderID, err)
		}
	}
	if c.Referral != nil {
		if err := c.Referral.OnPaidOrder(ctx, d.UserID); err != nil {
			return fmt.Errorf("complete referral for user %d: %w", d.UserID, err)
		}
	}

	// Best effort: closing the intent only silences the cron sweeper. Failing
	// the whole consumption over it would re-award (harmlessly) forever.
	if c.Intents != nil && c.Loyalty != nil {
		if err := c.Intents.MarkEarnAwarded(ctx, d.OrderID); err != nil {
			slog.Warn("eventconsumers: mark earn awarded",
				"order_id", d.OrderID, "err", err)
		}
	}
	return nil
}

// ── recommendations ──────────────────────────────────────────────────────────

// PurchaseRecorder writes purchase signals. Implemented by recommendations.Service.
type PurchaseRecorder interface {
	RecordPurchasesForOrder(ctx context.Context, userID, orderID int64) error
}

// RecsConsumer records the purchase signal used by for-you and
// frequently-bought-together.
//
// Previously this ran post-commit and was logged-and-lost on failure, and never
// ran at all for wallet checkouts. It is idempotent per (order, UTC day).
type RecsConsumer struct {
	Recs PurchaseRecorder
}

func (c *RecsConsumer) Name() string    { return "order_paid.recs" }
func (c *RecsConsumer) Types() []string { return []string{events.TypeOrderPaidV1} }

func (c *RecsConsumer) Handle(ctx context.Context, env *events.Envelope) error {
	var d events.OrderPaidData
	if err := env.UnmarshalData(&d); err != nil {
		return events.Permanent(err)
	}
	if c.Recs == nil {
		return events.Permanent(fmt.Errorf("recommendations service not configured"))
	}
	if d.UserID <= 0 || d.OrderID <= 0 {
		return events.Permanent(fmt.Errorf("order.paid without user or order id"))
	}
	return c.Recs.RecordPurchasesForOrder(ctx, d.UserID, d.OrderID)
}

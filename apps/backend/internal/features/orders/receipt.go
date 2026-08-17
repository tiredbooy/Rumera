package orders

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/tiredbooy/internal/notifications"
	"github.com/tiredbooy/pkg/async"
	"github.com/tiredbooy/pkg/notify"
)

// ReceiptSender emails the buyer after an order is paid (PR-020o).
// Confirm (gateway) and wallet checkout (already paid on create) share this.
type ReceiptSender struct {
	lookup        paidOrderLookup
	notifications *notifications.Dispatcher
	mailer        notify.Mailer
}

type paidOrderLookup interface {
	GetOrder(ctx context.Context, id int64) (*Order, error)
}

// NewReceiptSender constructs a paid-order receipt sender. Nil dispatcher and
// mailer are allowed; SendPaidOrderReceipt is then a no-op.
func NewReceiptSender(lookup paidOrderLookup, n *notifications.Dispatcher, mail notify.Mailer) *ReceiptSender {
	return &ReceiptSender{lookup: lookup, notifications: n, mailer: mail}
}

// SendPaidOrderReceipt queues the receipt off the request path. Missing email,
// unpaid status, or unset mailer/dispatcher skip send. Confirm failures are
// logged by the caller and must not undo payment.
//
// Fire-and-forget: it detaches onto a goroutine and returns nil immediately, so
// the caller learns nothing about delivery. That is correct on a request path
// (checkout must not wait on SMTP) and WRONG in a background consumer — see
// SendPaidOrderReceiptNow.
func (r *ReceiptSender) SendPaidOrderReceipt(ctx context.Context, userID, orderID int64, amount float64) error {
	order, amount, ok, err := r.resolve(ctx, userID, orderID, amount)
	if err != nil || !ok {
		return err
	}
	email := strings.TrimSpace(order.Buyer.Email)
	subject, body := paidOrderReceiptMail(order.ID, amount)
	async.GoCtx("orders.paid_receipt", 15*time.Second, func(ctx context.Context) {
		_ = r.dispatch(ctx, order.ID, email, subject, body)
	})
	return nil
}

// SendPaidOrderReceiptNow sends synchronously and returns the real delivery
// error.
//
// This is the entry point for the order.paid consumer. The consumer is already
// a background worker with its own retry budget and dead-letter state, so
// detaching onto a goroutine there would let it mark the consumption done
// before the mail was handed off — a crash in that window loses the receipt
// silently, which is precisely the failure the event bus exists to remove.
// Returning the error instead lets the consumption retry.
func (r *ReceiptSender) SendPaidOrderReceiptNow(ctx context.Context, userID, orderID int64, amount float64) error {
	order, amount, ok, err := r.resolve(ctx, userID, orderID, amount)
	if err != nil || !ok {
		return err
	}
	email := strings.TrimSpace(order.Buyer.Email)
	subject, body := paidOrderReceiptMail(order.ID, amount)
	return r.dispatch(ctx, order.ID, email, subject, body)
}

// resolve loads the order and applies every skip rule. ok=false means there is
// nothing to send and that is not an error.
func (r *ReceiptSender) resolve(
	ctx context.Context, userID, orderID int64, amount float64,
) (order *Order, resolvedAmount float64, ok bool, err error) {
	if r == nil || (r.notifications == nil && r.mailer == nil) {
		return nil, 0, false, nil
	}
	if orderID <= 0 || r.lookup == nil {
		return nil, 0, false, nil
	}
	order, err = r.lookup.GetOrder(ctx, orderID)
	if err != nil {
		return nil, 0, false, err
	}
	if userID > 0 && order.UserID != 0 && order.UserID != userID {
		return nil, 0, false, nil
	}
	if !shouldSendPaidReceipt(order) {
		return nil, 0, false, nil
	}
	if amount <= 0 {
		amount = order.TotalAmount
	}
	return order, amount, true, nil
}

// dispatch hands the mail to the outbox (async mode) or the mailer (inline).
func (r *ReceiptSender) dispatch(ctx context.Context, orderID int64, email, subject, body string) error {
	if r.notifications != nil {
		return r.notifications.DispatchOrderConfirmed(ctx, email, subject, body, orderID, "")
	}
	return r.mailer.Send(ctx, email, subject, body)
}

// shouldSendPaidReceipt is true only for a paid-like order with a buyer email.
// Pending / payment_failed create must not send (PR-020o).
func shouldSendPaidReceipt(order *Order) bool {
	if order == nil {
		return false
	}
	if strings.TrimSpace(order.Buyer.Email) == "" {
		return false
	}
	return isRefundableStatus(order.Status)
}

func paidOrderReceiptMail(orderID int64, amount float64) (subject, body string) {
	subject = "Your order is confirmed"
	body = fmt.Sprintf(
		`<p>Thanks for your order!</p>`+
			`<p>Order <strong>#%d</strong> has been paid and is confirmed.</p>`+
			`<p>Total: <strong>%.2f</strong></p>`,
		orderID, amount,
	)
	return subject, body
}

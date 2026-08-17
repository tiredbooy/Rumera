package orders

import (
	"context"
	"strings"
	"testing"
)

type receiptLookupStub struct {
	order *Order
	err   error
}

func (s *receiptLookupStub) GetOrder(context.Context, int64) (*Order, error) {
	return s.order, s.err
}

func TestSendPaidOrderReceipt_SkipsUnpaid(t *testing.T) {
	t.Parallel()
	lookup := &receiptLookupStub{order: &Order{
		ID:     3,
		UserID: 9,
		Status: OrderStatusPending,
		Buyer:  OrderUserIdentity{Email: "ada@example.com"},
	}}
	sender := NewReceiptSender(lookup, nil, nil)
	if err := sender.SendPaidOrderReceipt(context.Background(), 9, 3, 10); err != nil {
		t.Fatalf("SendPaidOrderReceipt: %v", err)
	}
}

func TestShouldSendPaidReceipt(t *testing.T) {
	t.Parallel()
	paid := &Order{
		ID:     10,
		Status: OrderStatusPaid,
		Buyer:  OrderUserIdentity{Email: "ada@example.com"},
	}
	if !shouldSendPaidReceipt(paid) {
		t.Fatal("paid order with email must send")
	}

	pending := &Order{
		ID:     11,
		Status: OrderStatusPending,
		Buyer:  OrderUserIdentity{Email: "ada@example.com"},
	}
	if shouldSendPaidReceipt(pending) {
		t.Fatal("pending create must not send a receipt")
	}

	failed := &Order{
		ID:     12,
		Status: OrderStatusPaymentFailed,
		Buyer:  OrderUserIdentity{Email: "ada@example.com"},
	}
	if shouldSendPaidReceipt(failed) {
		t.Fatal("payment_failed must not send a receipt")
	}

	noEmail := &Order{ID: 13, Status: OrderStatusPaid}
	if shouldSendPaidReceipt(noEmail) {
		t.Fatal("paid order without email must not send")
	}

	if shouldSendPaidReceipt(nil) {
		t.Fatal("nil order must not send")
	}
}

func TestPaidOrderReceiptMail_DoesNotSayProcessed(t *testing.T) {
	t.Parallel()
	subject, body := paidOrderReceiptMail(42, 113)
	if !strings.Contains(strings.ToLower(subject), "confirm") {
		t.Fatalf("subject = %q; want confirmation", subject)
	}
	lower := strings.ToLower(body)
	if strings.Contains(lower, "being processed") {
		t.Fatalf("body must not say unpaid processing: %s", body)
	}
	if !strings.Contains(lower, "paid") || !strings.Contains(lower, "confirmed") {
		t.Fatalf("body must say paid + confirmed: %s", body)
	}
	if !strings.Contains(body, "#42") {
		t.Fatalf("body missing order id: %s", body)
	}
}

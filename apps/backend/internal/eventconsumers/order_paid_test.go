package eventconsumers

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/tiredbooy/internal/events"
)

func paidEnvelope(t *testing.T, d events.OrderPaidData) *events.Envelope {
	t.Helper()
	env, err := events.New(events.TypeOrderPaidV1, "order:1", events.OrderPaidKey(d.OrderID), d)
	if err != nil {
		t.Fatalf("build envelope: %v", err)
	}
	return env
}

// ── fakes ────────────────────────────────────────────────────────────────────

type fakeReceipt struct {
	calls []int64
	err   error
}

func (f *fakeReceipt) SendPaidOrderReceiptNow(_ context.Context, _, orderID int64, _ float64) error {
	if f.err != nil {
		return f.err
	}
	f.calls = append(f.calls, orderID)
	return nil
}

type fakeEarner struct {
	awarded []int64
	err     error
}

func (f *fakeEarner) AwardForOrder(_ context.Context, _, orderID int64, _ float64) error {
	if f.err != nil {
		return f.err
	}
	f.awarded = append(f.awarded, orderID)
	return nil
}

type fakeReferral struct {
	users []int64
	err   error
}

func (f *fakeReferral) OnPaidOrder(_ context.Context, userID int64) error {
	if f.err != nil {
		return f.err
	}
	f.users = append(f.users, userID)
	return nil
}

type fakeIntents struct {
	closed []int64
	err    error
}

func (f *fakeIntents) MarkEarnAwarded(_ context.Context, orderID int64) error {
	if f.err != nil {
		return f.err
	}
	f.closed = append(f.closed, orderID)
	return nil
}

type fakeRecs struct {
	recorded []int64
	err      error
}

func (f *fakeRecs) RecordPurchasesForOrder(_ context.Context, _, orderID int64) error {
	if f.err != nil {
		return f.err
	}
	f.recorded = append(f.recorded, orderID)
	return nil
}

// ── tests ────────────────────────────────────────────────────────────────────

func TestLoyaltyConsumerAwardsAndCompletesReferral(t *testing.T) {
	earner := &fakeEarner{}
	ref := &fakeReferral{}
	intents := &fakeIntents{}
	c := &LoyaltyConsumer{Loyalty: earner, Referral: ref, Intents: intents}

	env := paidEnvelope(t, events.OrderPaidData{
		OrderID: 42, UserID: 7, Amount: 250, Rail: "wallet", PaidAt: time.Now(),
	})
	if err := c.Handle(context.Background(), env); err != nil {
		t.Fatalf("Handle: %v", err)
	}

	if len(earner.awarded) != 1 || earner.awarded[0] != 42 {
		t.Errorf("awarded = %v; want [42]", earner.awarded)
	}
	if len(ref.users) != 1 || ref.users[0] != 7 {
		t.Errorf("referral completed for %v; want [7]", ref.users)
	}
	if len(intents.closed) != 1 {
		t.Errorf("earn intent not closed; the cron sweeper will keep re-picking it")
	}
}

// The wallet rail is exactly why this consumer exists: before it, only gateway
// Confirm produced an earn intent, so wallet checkouts earned nothing.
func TestLoyaltyConsumerHandlesWalletRailWithoutPaymentID(t *testing.T) {
	earner := &fakeEarner{}
	c := &LoyaltyConsumer{Loyalty: earner}

	env := paidEnvelope(t, events.OrderPaidData{
		OrderID: 99, UserID: 3, Amount: 500, Rail: "wallet", // no PaymentID
	})
	if err := c.Handle(context.Background(), env); err != nil {
		t.Fatalf("wallet-rail fact must be consumable without a payment id: %v", err)
	}
	if len(earner.awarded) != 1 {
		t.Error("wallet-paid order did not earn")
	}
}

func TestLoyaltyConsumerRetriesOnAwardFailure(t *testing.T) {
	c := &LoyaltyConsumer{Loyalty: &fakeEarner{err: errors.New("db timeout")}}
	env := paidEnvelope(t, events.OrderPaidData{OrderID: 5, UserID: 2, Amount: 10})

	err := c.Handle(context.Background(), env)
	if err == nil {
		t.Fatal("want an error so the consumption is retried")
	}
	if events.IsPermanent(err) {
		t.Error("a transient award failure was classified permanent; it would be dead-lettered instead of retried")
	}
}

func TestLoyaltyConsumerDoesNotFailOnIntentCloseError(t *testing.T) {
	earner := &fakeEarner{}
	c := &LoyaltyConsumer{
		Loyalty: earner,
		Intents: &fakeIntents{err: errors.New("update failed")},
	}
	env := paidEnvelope(t, events.OrderPaidData{OrderID: 6, UserID: 2, Amount: 10})

	// Closing the intent only silences the cron sweeper. Failing over it would
	// re-award (harmlessly) on every retry, forever.
	if err := c.Handle(context.Background(), env); err != nil {
		t.Errorf("Handle failed on a best-effort bookkeeping error: %v", err)
	}
	if len(earner.awarded) != 1 {
		t.Error("award did not happen")
	}
}

func TestConsumersRejectMalformedPayloadPermanently(t *testing.T) {
	bad := &events.Envelope{
		ID:   "x",
		Type: events.TypeOrderPaidV1,
		Data: json.RawMessage(`{"order_id": "not-a-number"}`),
	}
	consumers := []events.Handler{
		&ReceiptConsumer{Sender: &fakeReceipt{}},
		&LoyaltyConsumer{Loyalty: &fakeEarner{}},
		&RecsConsumer{Recs: &fakeRecs{}},
	}
	for _, c := range consumers {
		t.Run(c.Name(), func(t *testing.T) {
			err := c.Handle(context.Background(), bad)
			if err == nil {
				t.Fatal("want an error for a malformed payload")
			}
			if !events.IsPermanent(err) {
				t.Error("malformed payload must be permanent; retrying it burns the budget on something that can never parse")
			}
		})
	}
}

func TestConsumersRejectMissingIdentifiersPermanently(t *testing.T) {
	env := paidEnvelope(t, events.OrderPaidData{OrderID: 0, UserID: 0})
	consumers := []events.Handler{
		&ReceiptConsumer{Sender: &fakeReceipt{}},
		&LoyaltyConsumer{Loyalty: &fakeEarner{}},
		&RecsConsumer{Recs: &fakeRecs{}},
	}
	for _, c := range consumers {
		t.Run(c.Name(), func(t *testing.T) {
			err := c.Handle(context.Background(), env)
			if err == nil || !events.IsPermanent(err) {
				t.Errorf("got %v; want a permanent error for a fact with no order/user", err)
			}
		})
	}
}

func TestReceiptConsumerSends(t *testing.T) {
	r := &fakeReceipt{}
	c := &ReceiptConsumer{Sender: r}
	env := paidEnvelope(t, events.OrderPaidData{OrderID: 11, UserID: 4, Amount: 90})

	if err := c.Handle(context.Background(), env); err != nil {
		t.Fatalf("Handle: %v", err)
	}
	if len(r.calls) != 1 || r.calls[0] != 11 {
		t.Errorf("receipt sent for %v; want [11]", r.calls)
	}
}

func TestRecsConsumerRecords(t *testing.T) {
	r := &fakeRecs{}
	c := &RecsConsumer{Recs: r}
	env := paidEnvelope(t, events.OrderPaidData{OrderID: 12, UserID: 5, Amount: 30})

	if err := c.Handle(context.Background(), env); err != nil {
		t.Fatalf("Handle: %v", err)
	}
	if len(r.recorded) != 1 || r.recorded[0] != 12 {
		t.Errorf("recorded %v; want [12]", r.recorded)
	}
}

func TestAllConsumersSubscribeToOrderPaid(t *testing.T) {
	consumers := []events.Handler{
		&ReceiptConsumer{}, &LoyaltyConsumer{}, &RecsConsumer{},
	}
	seen := map[string]bool{}
	for _, c := range consumers {
		if c.Name() == "" {
			t.Error("consumer with an empty name; the ledger keys on it")
		}
		if seen[c.Name()] {
			t.Errorf("duplicate consumer name %q", c.Name())
		}
		seen[c.Name()] = true

		types := c.Types()
		if len(types) == 0 {
			t.Errorf("%s subscribes to nothing", c.Name())
		}
		if types[0] != events.TypeOrderPaidV1 {
			t.Errorf("%s subscribes to %q; want %q", c.Name(), types[0], events.TypeOrderPaidV1)
		}
	}
}

func TestOrderPaidHandlersSkipsUnwiredDependencies(t *testing.T) {
	// An unwired deployment must register nothing rather than register handlers
	// that would fail on every fact and dead-letter the lot.
	if got := OrderPaidHandlers(OrderPaidDeps{}); len(got) != 0 {
		t.Errorf("built %d handlers from empty deps; want 0", len(got))
	}

	got := OrderPaidHandlers(OrderPaidDeps{Recs: &fakeRecs{}})
	if len(got) != 1 || got[0].Name() != "order_paid.recs" {
		t.Errorf("partial deps built %v; want just the recs consumer", names(got))
	}

	full := OrderPaidHandlers(OrderPaidDeps{
		Receipt: &fakeReceipt{}, Loyalty: &fakeEarner{},
		Referral: &fakeReferral{}, Intents: &fakeIntents{}, Recs: &fakeRecs{},
	})
	if len(full) != 3 {
		t.Errorf("full deps built %d handlers; want 3 — %v", len(full), names(full))
	}
}

func names(hs []events.Handler) []string {
	out := make([]string, 0, len(hs))
	for _, h := range hs {
		out = append(out, h.Name())
	}
	return out
}

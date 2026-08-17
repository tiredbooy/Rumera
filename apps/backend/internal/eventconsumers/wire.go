package eventconsumers

import "github.com/tiredbooy/internal/events"

// OrderPaidDeps are the collaborators the order.paid consumers need.
//
// Every field is optional; a nil one disables its consumer rather than
// registering a handler that would fail on every fact forever.
type OrderPaidDeps struct {
	Receipt  ReceiptSender
	Loyalty  OrderEarner
	Referral PaidOrderHook
	Intents  EarnIntentCloser
	Orders   OrderStatusReader
	Recs     PurchaseRecorder
}

// OrderPaidHandlers builds the consumers that have their dependencies met.
//
// The nil checks matter more than they look: these fields are interfaces
// assigned from concrete pointers like *loyalty.Service, so an unwired service
// arrives as a NON-nil interface holding a nil pointer. Callers must therefore
// leave the field unset rather than pass a nil pointer, and this function only
// registers what is actually present.
func OrderPaidHandlers(d OrderPaidDeps) []events.Handler {
	var out []events.Handler
	if d.Receipt != nil {
		out = append(out, &ReceiptConsumer{Sender: d.Receipt})
	}
	if d.Loyalty != nil || d.Referral != nil {
		out = append(out, &LoyaltyConsumer{
			Loyalty:  d.Loyalty,
			Referral: d.Referral,
			Intents:  d.Intents,
			Orders:   d.Orders,
		})
	}
	if d.Recs != nil {
		out = append(out, &RecsConsumer{Recs: d.Recs})
	}
	return out
}

package orders

import (
	"context"
	"errors"
	"testing"

	"github.com/tiredbooy/internal/features/inventory"
	"github.com/tiredbooy/internal/features/payments"
	"github.com/tiredbooy/internal/features/wallet"
	"github.com/tiredbooy/internal/models"
)

type walletRefunderStub struct {
	walletPurchaserStub
	refundFn    func(ctx context.Context, userID int64, amount float64, orderID int64) (*wallet.Transaction, error)
	refundCalls int
	lastUser    int64
	lastAmount  float64
	lastOrder   int64
}

func (w *walletRefunderStub) Refund(ctx context.Context, userID int64, amount float64, orderID int64) (*wallet.Transaction, error) {
	w.refundCalls++
	w.lastUser = userID
	w.lastAmount = amount
	w.lastOrder = orderID
	if w.refundFn != nil {
		return w.refundFn(ctx, userID, amount, orderID)
	}
	return &wallet.Transaction{ID: 1, Amount: amount, Type: wallet.TransactionTypeRefund}, nil
}

func buildRefundService(orderRepo *orderRepoStub, invRepo *invRepoStub, w WalletPurchaser, clawback orderEarnClawback) Service {
	if orderRepo == nil {
		orderRepo = &orderRepoStub{}
	}
	if invRepo == nil {
		invRepo = &invRepoStub{}
	}
	inv := inventory.NewService(invRepo, movementStub{})
	pay := payments.NewService(&paymentRepoStub{}, orderRepo, inv, nil, nil, nil, nil)
	return NewService(
		orderRepo, itemRepoStub{}, &cartRepoStub{}, &couponRepoStub{}, &couponUsageStub{},
		stubShippingAuthorizer{cost: 9}, stubAddressLookup{}, inv, pay, nil, clawback, w,
	)
}

func paidWalletOrder(id int64) *Order {
	return &Order{
		ID:            id,
		UserID:        42,
		Status:        OrderStatusPaid,
		PaymentMethod: models.PaymentMethodWallet,
		TotalAmount:   113,
	}
}

func refundableRepo(order *Order, items []OrderItemResponse) *orderRepoStub {
	if items == nil {
		items = []OrderItemResponse{{VariantID: 10, Quantity: 2}, {VariantID: 20, Quantity: 1}}
	}
	return &orderRepoStub{
		getByIDFn: func(_ context.Context, id int64) (*Order, error) {
			if order.ID != 0 && id != order.ID {
				return nil, models.ErrNotFound
			}
			cp := *order
			return &cp, nil
		},
		itemsFn: func(context.Context, int64) ([]OrderItemResponse, error) {
			return items, nil
		},
		updateStatusFn: func(_ context.Context, id int64, req UpdateOrderStatusReq) (*Order, error) {
			cp := *order
			cp.ID = id
			cp.Status = req.Status
			return &cp, nil
		},
	}
}

func TestRefundOrder_PaidWalletCallsRefundRestockClawbackStatus(t *testing.T) {
	repo := refundableRepo(paidWalletOrder(99), []OrderItemResponse{
		{VariantID: 10, Quantity: 2},
		{VariantID: 20, Quantity: 1},
	})
	invRepo := &invRepoStub{}
	w := &walletRefunderStub{}
	cb := &clawbackStub{}
	svc := buildRefundService(repo, invRepo, w, cb)

	got, err := svc.RefundOrder(context.Background(), 99)
	if err != nil {
		t.Fatalf("RefundOrder err = %v; want nil", err)
	}
	if got.Status != OrderStatusRefunded {
		t.Fatalf("status = %s; want refunded", got.Status)
	}
	if w.refundCalls != 1 {
		t.Fatalf("wallet.Refund calls = %d; want 1", w.refundCalls)
	}
	if w.lastUser != 42 || w.lastAmount != 113 || w.lastOrder != 99 {
		t.Fatalf("wallet.Refund args user=%d amount=%v order=%d; want 42, 113, 99", w.lastUser, w.lastAmount, w.lastOrder)
	}
	if len(invRepo.adjustCalls) != 2 {
		t.Fatalf("AdjustStock calls = %d; want 2", len(invRepo.adjustCalls))
	}
	wantQty := map[int64]int{10: 2, 20: 1}
	for _, call := range invRepo.adjustCalls {
		if call.req.Type != inventory.MovementTypeRefund {
			t.Fatalf("adjust type = %s; want refund", call.req.Type)
		}
		if call.req.Quantity != wantQty[call.variantID] {
			t.Fatalf("adjust variant %d qty = %d; want %d", call.variantID, call.req.Quantity, wantQty[call.variantID])
		}
		if call.orderID == nil || *call.orderID != 99 {
			t.Fatalf("adjust orderID = %v; want 99", call.orderID)
		}
	}
	if len(cb.calls) != 1 || cb.calls[0][0] != 42 || cb.calls[0][1] != 99 {
		t.Fatalf("clawback calls = %v; want [{42 99}]", cb.calls)
	}
	if repo.statusWrites != 1 {
		t.Fatalf("status writes = %d; want 1", repo.statusWrites)
	}
}

func TestRefundOrder_RefusePending(t *testing.T) {
	order := paidWalletOrder(7)
	order.Status = OrderStatusPending
	repo := refundableRepo(order, []OrderItemResponse{{VariantID: 10, Quantity: 2}})
	invRepo := &invRepoStub{}
	w := &walletRefunderStub{}
	cb := &clawbackStub{}
	svc := buildRefundService(repo, invRepo, w, cb)

	_, err := svc.RefundOrder(context.Background(), 7)
	if !errors.Is(err, errOrderNotRefundable) {
		t.Fatalf("err = %v; want errOrderNotRefundable", err)
	}
	if w.refundCalls != 0 {
		t.Fatal("must not credit wallet for a pending order")
	}
	if len(invRepo.adjustCalls) != 0 {
		t.Fatal("must not restock a pending order")
	}
	if len(cb.calls) != 0 {
		t.Fatal("must not clawback a pending order")
	}
	if repo.statusWrites != 0 {
		t.Fatal("must not write status for a pending order")
	}
}

func TestRefundOrder_RefuseDoubleRefund(t *testing.T) {
	order := paidWalletOrder(11)
	order.Status = OrderStatusRefunded
	repo := refundableRepo(order, []OrderItemResponse{{VariantID: 10, Quantity: 2}})
	invRepo := &invRepoStub{}
	w := &walletRefunderStub{}
	cb := &clawbackStub{}
	svc := buildRefundService(repo, invRepo, w, cb)

	_, err := svc.RefundOrder(context.Background(), 11)
	if !errors.Is(err, errAlreadyRefunded) {
		t.Fatalf("err = %v; want errAlreadyRefunded", err)
	}
	if w.refundCalls != 0 {
		t.Fatal("must not double-credit the wallet")
	}
	if len(invRepo.adjustCalls) != 0 {
		t.Fatal("must not restock an already refunded order")
	}
	if len(cb.calls) != 0 {
		t.Fatal("must not clawback an already refunded order")
	}
	if repo.statusWrites != 0 {
		t.Fatal("must not rewrite status on a refund replay")
	}
}

func TestRefundOrder_NonWalletSkipsWalletCredit(t *testing.T) {
	order := paidWalletOrder(5)
	order.PaymentMethod = models.PaymentMethodCard
	repo := refundableRepo(order, []OrderItemResponse{{VariantID: 10, Quantity: 1}})
	invRepo := &invRepoStub{}
	w := &walletRefunderStub{}
	cb := &clawbackStub{}
	svc := buildRefundService(repo, invRepo, w, cb)

	got, err := svc.RefundOrder(context.Background(), 5)
	if err != nil {
		t.Fatalf("RefundOrder err = %v; want nil", err)
	}
	if got.Status != OrderStatusRefunded {
		t.Fatalf("status = %s; want refunded", got.Status)
	}
	if w.refundCalls != 0 {
		t.Fatal("card tender must not call wallet.Refund; money return is operator/manual")
	}
	if len(invRepo.adjustCalls) != 1 {
		t.Fatalf("AdjustStock calls = %d; want 1", len(invRepo.adjustCalls))
	}
	if len(cb.calls) != 1 {
		t.Fatalf("clawback calls = %d; want 1", len(cb.calls))
	}
}

func TestRefundOrder_WalletFailureStopsBeforeRestock(t *testing.T) {
	repo := refundableRepo(paidWalletOrder(3), []OrderItemResponse{{VariantID: 10, Quantity: 1}})
	invRepo := &invRepoStub{}
	w := &walletRefunderStub{
		refundFn: func(context.Context, int64, float64, int64) (*wallet.Transaction, error) {
			return nil, errors.New("ledger down")
		},
	}
	cb := &clawbackStub{}
	svc := buildRefundService(repo, invRepo, w, cb)

	_, err := svc.RefundOrder(context.Background(), 3)
	if err == nil {
		t.Fatal("want wallet refund error")
	}
	if w.refundCalls != 1 {
		t.Fatalf("wallet.Refund calls = %d; want 1", w.refundCalls)
	}
	if len(invRepo.adjustCalls) != 0 || len(cb.calls) != 0 || repo.statusWrites != 0 {
		t.Fatal("wallet failure must be fail-closed (no restock, clawback, or status)")
	}
}

func TestRefundOrder_CancelledNotRefundable(t *testing.T) {
	order := paidWalletOrder(8)
	order.Status = OrderStatusCancelled
	repo := refundableRepo(order, nil)
	w := &walletRefunderStub{}
	svc := buildRefundService(repo, &invRepoStub{}, w, &clawbackStub{})

	if _, err := svc.RefundOrder(context.Background(), 8); !errors.Is(err, errOrderNotRefundable) {
		t.Fatalf("err = %v; want errOrderNotRefundable", err)
	}
	if w.refundCalls != 0 {
		t.Fatal("must not credit wallet for a cancelled order")
	}
}

func TestUpdateOrderStatus_PatchRefundedRejected(t *testing.T) {
	repo := statusOrderRepo(42, 99)
	cb := &clawbackStub{}
	svc := buildRefundService(repo, &invRepoStub{}, &walletRefunderStub{}, cb)

	_, err := svc.UpdateOrderStatus(context.Background(), 99, UpdateOrderStatusReq{Status: OrderStatusRefunded})
	if !errors.Is(err, errUseRefundEndpoint) {
		t.Fatalf("err = %v; want errUseRefundEndpoint", err)
	}
	if repo.statusWrites != 0 {
		t.Fatal("PATCH refunded must not write status")
	}
	if len(cb.calls) != 0 {
		t.Fatal("PATCH refunded must not clawback")
	}
}

// Compile-time: a purchase-only stub is not a WalletRefunder.
var _ WalletPurchaser = (*walletPurchaserStub)(nil)

func TestRefundOrder_WalletWithoutRefunderFailsClosed(t *testing.T) {
	repo := refundableRepo(paidWalletOrder(2), []OrderItemResponse{{VariantID: 10, Quantity: 1}})
	invRepo := &invRepoStub{}
	cb := &clawbackStub{}
	svc := buildRefundService(repo, invRepo, &walletPurchaserStub{}, cb)

	_, err := svc.RefundOrder(context.Background(), 2)
	if !errors.Is(err, errWalletRefundUnavailable) {
		t.Fatalf("err = %v; want errWalletRefundUnavailable", err)
	}
	if len(invRepo.adjustCalls) != 0 || len(cb.calls) != 0 || repo.statusWrites != 0 {
		t.Fatal("missing WalletRefunder must not restock, clawback, or mark refunded")
	}
}

func TestRefundOrder_MissingOrder(t *testing.T) {
	svc := buildRefundService(&orderRepoStub{}, &invRepoStub{}, &walletRefunderStub{}, &clawbackStub{})
	_, err := svc.RefundOrder(context.Background(), 404)
	if !errors.Is(err, models.ErrNotFound) {
		t.Fatalf("err = %v; want ErrNotFound", err)
	}
}

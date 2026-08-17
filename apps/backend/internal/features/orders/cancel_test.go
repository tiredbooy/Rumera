package orders

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/tiredbooy/internal/features/inventory"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

func TestCancelMissError(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name    string
		status  string
		rowUser int64
		owner   int64
		want    error
	}{
		{"customer cancelled", string(OrderStatusCancelled), 9, 9, apperr.ErrOrderCancelled},
		{"customer paid", string(OrderStatusPaid), 9, 9, apperr.ErrOrderAlreadyPaid},
		{"customer processing", string(OrderStatusProcessing), 9, 9, apperr.ErrOrderAlreadyPaid},
		{"customer other owner", string(OrderStatusPending), 8, 9, models.ErrNotFound},
		{"admin cancelled", string(OrderStatusCancelled), 8, 0, apperr.ErrOrderCancelled},
		{"admin paid", string(OrderStatusPaid), 8, 0, apperr.ErrOrderAlreadyPaid},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := cancelMissError(tc.status, tc.rowUser, tc.owner)
			if !errors.Is(got, tc.want) {
				t.Fatalf("cancelMissError = %v; want %v", got, tc.want)
			}
		})
	}
}

func newCancelService(orderRepo *orderRepoStub, usage *couponUsageStub, invRepo *invRepoStub) Service {
	if orderRepo == nil {
		orderRepo = &orderRepoStub{}
	}
	if usage == nil {
		usage = &couponUsageStub{}
	}
	if invRepo == nil {
		invRepo = &invRepoStub{}
	}
	inv := inventory.NewService(invRepo, movementStub{})
	return NewService(orderRepo, itemRepoStub{}, &cartRepoStub{}, &couponRepoStub{}, usage, stubShippingAuthorizer{cost: 9}, stubAddressLookup{}, inv, nil, nil, nil, nil)
}

func TestCancelOrder_ReleasesAndReversesCouponInSameTx(t *testing.T) {
	tx := &fakeTx{}
	orderRepo := &orderRepoStub{
		tx: tx,
		itemsFn: func(context.Context, int64) ([]OrderItemResponse, error) {
			return []OrderItemResponse{{VariantID: 7, Quantity: 2}}, nil
		},
	}
	usage := &couponUsageStub{}
	invRepo := &invRepoStub{}
	svc := newCancelService(orderRepo, usage, invRepo)

	if err := svc.CancelOrder(context.Background(), 42, 9); err != nil {
		t.Fatalf("CancelOrder err = %v; want nil", err)
	}
	if orderRepo.cancelTxCalls != 1 {
		t.Fatalf("CancelTx calls = %d; want 1", orderRepo.cancelTxCalls)
	}
	if orderRepo.cancelTxUser != 9 {
		t.Fatalf("CancelTx owner = %d; want 9", orderRepo.cancelTxUser)
	}
	if orderRepo.cancelTxTx != tx {
		t.Fatal("CancelTx must use the cancel transaction")
	}
	if usage.deleteCalls != 1 || usage.deleteID != 42 {
		t.Fatalf("coupon reverse calls=%d id=%d; want 1/42", usage.deleteCalls, usage.deleteID)
	}
	if usage.deleteTx != tx {
		t.Fatal("coupon reverse must use the cancel transaction")
	}
	if len(invRepo.releases) != 1 {
		t.Fatalf("Release calls = %d; want 1", len(invRepo.releases))
	}
	rel := invRepo.releases[0]
	if rel.tx != tx || rel.orderID != 42 || rel.variantID != 7 || rel.quantity != 2 {
		t.Fatalf("release = %+v; want tx/order 42/variant 7/qty 2", rel)
	}
	if !tx.Committed {
		t.Fatal("cancel tx must commit")
	}
	if tx.RolledBack {
		t.Fatal("committed cancel must not roll back")
	}
}

func TestCancelOrder_ReleaseErrorRollsBack(t *testing.T) {
	tx := &fakeTx{}
	orderRepo := &orderRepoStub{
		tx: tx,
		itemsFn: func(context.Context, int64) ([]OrderItemResponse, error) {
			return []OrderItemResponse{{VariantID: 3, Quantity: 1}}, nil
		},
	}
	usage := &couponUsageStub{}
	invRepo := &invRepoStub{
		releaseFn: func(context.Context, pgx.Tx, int64, int, int64) error {
			return errors.New("release failed")
		},
	}
	svc := newCancelService(orderRepo, usage, invRepo)

	err := svc.CancelOrder(context.Background(), 42, 9)
	if err == nil {
		t.Fatal("CancelOrder err = nil; want release error")
	}
	if !strings.Contains(err.Error(), "release") {
		t.Fatalf("err = %v; want release context", err)
	}
	if tx.Committed {
		t.Fatal("must not commit when release fails")
	}
	if !tx.RolledBack {
		t.Fatal("must roll back status + coupon when release fails")
	}
	if usage.deleteCalls != 1 {
		t.Fatal("coupon reverse runs before release; rollback undoes it")
	}
}

func TestCancelOrder_AlreadyCancelledIs409(t *testing.T) {
	tx := &fakeTx{}
	orderRepo := &orderRepoStub{
		tx: tx,
		cancelTxFn: func(context.Context, pgx.Tx, int64, int64) error {
			return apperr.ErrOrderCancelled
		},
		itemsFn: func(context.Context, int64) ([]OrderItemResponse, error) {
			return []OrderItemResponse{{VariantID: 1, Quantity: 1}}, nil
		},
	}
	usage := &couponUsageStub{}
	invRepo := &invRepoStub{}
	svc := newCancelService(orderRepo, usage, invRepo)

	err := svc.CancelOrder(context.Background(), 42, 9)
	if !errors.Is(err, apperr.ErrOrderCancelled) {
		t.Fatalf("err = %v; want ErrOrderCancelled", err)
	}
	if usage.deleteCalls != 0 {
		t.Fatal("must not reverse coupon on already-cancelled")
	}
	if len(invRepo.releases) != 0 {
		t.Fatal("must not release on already-cancelled")
	}
	if tx.Committed {
		t.Fatal("409 must not commit")
	}
}

func TestCancelOrder_AlreadyPaidIs409(t *testing.T) {
	tx := &fakeTx{}
	orderRepo := &orderRepoStub{
		tx: tx,
		cancelTxFn: func(context.Context, pgx.Tx, int64, int64) error {
			return apperr.ErrOrderAlreadyPaid
		},
	}
	usage := &couponUsageStub{}
	invRepo := &invRepoStub{}
	svc := newCancelService(orderRepo, usage, invRepo)

	err := svc.CancelOrder(context.Background(), 42, 9)
	if !errors.Is(err, apperr.ErrOrderAlreadyPaid) {
		t.Fatalf("err = %v; want ErrOrderAlreadyPaid", err)
	}
	if usage.deleteCalls != 0 || len(invRepo.releases) != 0 {
		t.Fatal("paid cancel must not reverse coupon or release")
	}
}

func TestCancelOrder_NotFound(t *testing.T) {
	tx := &fakeTx{}
	orderRepo := &orderRepoStub{
		tx: tx,
		cancelTxFn: func(context.Context, pgx.Tx, int64, int64) error {
			return models.ErrNotFound
		},
	}
	svc := newCancelService(orderRepo, &couponUsageStub{}, &invRepoStub{})

	err := svc.CancelOrder(context.Background(), 42, 9)
	if !errors.Is(err, models.ErrNotFound) {
		t.Fatalf("err = %v; want ErrNotFound", err)
	}
}

func TestAdminCancelOrder_SkipsOwnerCheck(t *testing.T) {
	tx := &fakeTx{}
	orderRepo := &orderRepoStub{
		tx: tx,
		itemsFn: func(context.Context, int64) ([]OrderItemResponse, error) {
			return []OrderItemResponse{{VariantID: 4, Quantity: 1}}, nil
		},
	}
	usage := &couponUsageStub{}
	invRepo := &invRepoStub{}
	svc := newCancelService(orderRepo, usage, invRepo)

	if err := svc.AdminCancelOrder(context.Background(), 77); err != nil {
		t.Fatalf("AdminCancelOrder err = %v; want nil", err)
	}
	if orderRepo.cancelTxUser != 0 {
		t.Fatalf("admin CancelTx owner = %d; want 0", orderRepo.cancelTxUser)
	}
	if usage.deleteCalls != 1 || usage.deleteID != 77 {
		t.Fatalf("admin coupon reverse = calls %d id %d; want 1/77", usage.deleteCalls, usage.deleteID)
	}
	if len(invRepo.releases) != 1 || invRepo.releases[0].tx != tx {
		t.Fatal("admin cancel must release on the same tx")
	}
	if !tx.Committed {
		t.Fatal("admin cancel tx must commit")
	}
}

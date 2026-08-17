package orders

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/tiredbooy/internal/models"
)

func TestMarkAsPaymentFailedSQL_PendingOnly(t *testing.T) {
	q := compactSQL(markAsPaymentFailedSQL)
	if !strings.Contains(q, "status = 'payment_failed'") {
		t.Fatal("must set status='payment_failed'")
	}
	if !strings.Contains(q, "and status = 'pending'") {
		t.Fatal("must only transition pending → payment_failed")
	}
}

func TestMarkOrderPaymentFailedRequiresConcreteRepo(t *testing.T) {
	svc := &orderService{orderRepo: &orderRepoStub{}}
	err := svc.MarkOrderPaymentFailed(context.Background(), 1)
	if err == nil || !strings.Contains(err.Error(), "cannot mark payment_failed") {
		t.Fatalf("err = %v", err)
	}
}

type paymentFailedRepoStub struct {
	Repository
	calls  int
	lastID int64
	err    error
}

func (r *paymentFailedRepoStub) MarkAsPaymentFailed(_ context.Context, orderID int64) error {
	r.calls++
	r.lastID = orderID
	return r.err
}

func TestOrderService_MarkOrderPaymentFailed_Delegates(t *testing.T) {
	repo := &paymentFailedRepoStub{}
	svc := &orderService{orderRepo: repo}
	if err := svc.MarkOrderPaymentFailed(context.Background(), 42); err != nil {
		t.Fatalf("MarkOrderPaymentFailed: %v", err)
	}
	if repo.calls != 1 || repo.lastID != 42 {
		t.Fatalf("calls=%d last=%d; want 1/42", repo.calls, repo.lastID)
	}
}

func TestOrderService_MarkOrderPaymentFailed_NotPending(t *testing.T) {
	repo := &paymentFailedRepoStub{err: models.ErrNotFound}
	svc := &orderService{orderRepo: repo}
	err := svc.MarkOrderPaymentFailed(context.Background(), 7)
	if !errors.Is(err, models.ErrNotFound) {
		t.Fatalf("err = %v; want ErrNotFound", err)
	}
}

//go:build integration

package integration

import (
	"context"
	"sync"
	"testing"

	"github.com/tiredbooy/internal/repositories"
)

// TestCouponUsageLimit_HoldsUnderConcurrency proves the Epic-E TOCTOU fix: two
// orders redeeming a single-use coupon at the same time must not both succeed.
// It exercises the exact primitives order creation now uses inside its tx —
// CouponRepository.LockByID (row lock) + CountUsagesTx (locked re-check) +
// CouponUsageRepository.Record — under genuine concurrency. Before the fix, both
// goroutines read "0 uses" and both recorded, blowing past max_uses=1.
func TestCouponUsageLimit_HoldsUnderConcurrency(t *testing.T) {
	requireDB(t)
	resetTables(t, "users", "products", "coupons")
	ctx := context.Background()

	uid := seedUser(t)
	cid := seedCoupon(t, "SINGLEUSE", 1)
	o1 := seedOrder(t, uid)
	o2 := seedOrder(t, uid)
	orders := []int64{o1, o2}

	couponRepo := repositories.NewCouponRepository(testPool)
	usageRepo := repositories.NewCouponUsageRepository(testPool)

	// redeem mirrors enforceCouponLimitsTx + Record inside one transaction.
	redeem := func(orderID int64) (bool, error) {
		tx, err := testPool.Begin(ctx)
		if err != nil {
			return false, err
		}
		defer tx.Rollback(ctx)

		if err := couponRepo.LockByID(ctx, tx, cid); err != nil {
			return false, err
		}
		used, err := couponRepo.CountUsagesTx(ctx, tx, cid)
		if err != nil {
			return false, err
		}
		if used >= 1 { // max_uses
			return false, nil // correctly rejected
		}
		if err := usageRepo.Record(ctx, tx, cid, uid, orderID, 0); err != nil {
			return false, err
		}
		if err := tx.Commit(ctx); err != nil {
			return false, err
		}
		return true, nil
	}

	// Fire both redemptions concurrently, released from a common barrier.
	var (
		wg      sync.WaitGroup
		start   = make(chan struct{})
		mu      sync.Mutex
		success int
	)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(orderID int64) {
			defer wg.Done()
			<-start
			ok, err := redeem(orderID)
			if err != nil {
				t.Errorf("redeem order %d: %v", orderID, err)
				return
			}
			if ok {
				mu.Lock()
				success++
				mu.Unlock()
			}
		}(orders[i])
	}
	close(start)
	wg.Wait()

	if success != 1 {
		t.Fatalf("successful redemptions = %d; want exactly 1 (max_uses=1)", success)
	}

	var total int
	if err := testPool.QueryRow(ctx,
		`SELECT COUNT(*) FROM coupon_usages WHERE coupon_id = $1`, cid).Scan(&total); err != nil {
		t.Fatalf("count usages: %v", err)
	}
	if total != 1 {
		t.Fatalf("recorded usages = %d; want 1", total)
	}
}

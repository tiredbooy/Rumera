//go:build integration

package integration

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/tiredbooy/internal/features/coupons"
	"github.com/tiredbooy/internal/models"
)

func TestCouponRepository_CRUDAndNullableUpdates(t *testing.T) {
	requireDB(t)
	resetTables(t, "coupons")
	ctx := context.Background()
	repo := coupons.NewRepository(testPool)
	description := "launch offer"
	maxDiscount := 25.0
	maxUses := 10
	expires := time.Now().Add(24 * time.Hour).UTC().Truncate(time.Microsecond)
	active := true

	created, err := repo.Create(ctx, coupons.CreateCouponReq{
		Code:              "CRUDTEST",
		Description:       &description,
		DiscountType:      coupons.DiscountTypePercentage,
		DiscountValue:     20,
		MaxDiscountAmount: &maxDiscount,
		MaxUses:           &maxUses,
		MaxUsesPerUser:    2,
		ApplicableTo:      &coupons.ApplicableTo{ProductIDs: []int64{1, 2}},
		IsActive:          &active,
		ExpiresAt:         &expires,
	})
	if err != nil {
		t.Fatalf("create coupon: %v", err)
	}

	byID, err := repo.GetByID(ctx, created.ID)
	if err != nil || byID.Code != "CRUDTEST" {
		t.Fatalf("get by id = %+v, %v", byID, err)
	}
	byCode, err := repo.GetByCode(ctx, "CRUDTEST")
	if err != nil || byCode.ID != created.ID {
		t.Fatalf("get by code = %+v, %v", byCode, err)
	}

	filter := coupons.CouponFilter{BaseFilter: models.BaseFilter{
		PaginationParams: models.PaginationParams{Page: 1, Limit: 20},
		SortBy:           "created_at",
		OrderBy:          "desc",
	}}
	rows, total, err := repo.GetAll(ctx, filter)
	if err != nil {
		t.Fatalf("list coupons: %v", err)
	}
	if total != 1 || len(rows) != 1 || rows[0].ID != created.ID {
		t.Fatalf("list = %+v, total %d; want created coupon", rows, total)
	}
	if rows[0].ApplicableTo == nil || len(rows[0].ApplicableTo.ProductIDs) != 2 {
		t.Fatalf("listed applicability = %+v; want two products", rows[0].ApplicableTo)
	}
	if _, err := repo.Create(ctx, coupons.CreateCouponReq{
		Code:           "CRUDTEST",
		DiscountType:   coupons.DiscountTypePercentage,
		DiscountValue:  10,
		MaxUsesPerUser: 1,
	}); !errors.Is(err, models.ErrConflict) {
		t.Fatalf("duplicate create error = %v; want ErrConflict", err)
	}

	firstDescription := "first edit"
	firstUpdate := coupons.UpdateCouponReq{
		Description:       models.NullablePatch[string]{Set: true, Value: &firstDescription},
		ExpectedUpdatedAt: created.UpdatedAt,
	}
	time.Sleep(time.Millisecond)
	if _, err := repo.Update(ctx, created.ID, firstUpdate); err != nil {
		t.Fatalf("first optimistic update: %v", err)
	}
	staleDescription := "stale edit"
	staleUpdate := coupons.UpdateCouponReq{
		Description:       models.NullablePatch[string]{Set: true, Value: &staleDescription},
		ExpectedUpdatedAt: created.UpdatedAt,
	}
	if _, err := repo.Update(ctx, created.ID, staleUpdate); !errors.Is(err, models.ErrConflict) {
		t.Fatalf("stale update error = %v; want ErrConflict", err)
	}

	filter = coupons.CouponFilter{BaseFilter: models.BaseFilter{
		PaginationParams: models.PaginationParams{Page: 99, Limit: 1},
		SortBy:           "created_at",
		OrderBy:          "desc",
	}}
	rows, total, err = repo.GetAll(ctx, filter)
	if err != nil {
		t.Fatalf("list coupons: %v", err)
	}
	if total != 1 || len(rows) != 0 {
		t.Fatalf("out-of-range list = %d rows, total %d; want 0 rows, total 1", len(rows), total)
	}

	update := coupons.UpdateCouponReq{}
	update.Description.Set = true
	update.MaxDiscountAmount.Set = true
	update.MaxUses.Set = true
	update.ApplicableTo.Set = true
	update.ExpiresAt.Set = true
	updated, err := repo.Update(ctx, created.ID, update)
	if err != nil {
		t.Fatalf("clear nullable fields: %v", err)
	}
	if updated.Description != nil || updated.MaxDiscountAmount != nil || updated.MaxUses != nil || updated.ApplicableTo != nil || updated.ExpiresAt != nil {
		t.Fatalf("nullable fields were not cleared: %+v", updated)
	}
}

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

	couponRepo := coupons.NewRepository(testPool)
	usageRepo := coupons.NewUsageRepository(testPool)

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

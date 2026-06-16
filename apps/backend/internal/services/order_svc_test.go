package services

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/tiredbooy/internal/mocks"
	"github.com/tiredbooy/internal/models"
)

// buildOrderService wires an orderService over the supplied mocks, with real
// inventory and payment services backed by their own mocks (the order saga calls
// into them). Returned mocks are the ones a test typically configures/inspects.
func buildOrderService(orderRepo *mocks.OrderRepo, cartRepo *mocks.CartRepo, couponRepo *mocks.CouponRepo, shipRepo *mocks.ShippingMethodRepo, invRepo *mocks.InventoryRepo) OrderService {
	inv := NewInventoryService(invRepo, &mocks.MovementRepo{})
	pay := NewPaymentService(&mocks.PaymentRepo{}, &mocks.OrderRepo{}, inv, nil, nil)
	return NewOrderService(orderRepo, &mocks.OrderItemRepo{}, cartRepo, couponRepo,
		&mocks.CouponUsageRepo{}, shipRepo, inv, pay)
}

func nonEmptyCart() *mocks.CartRepo {
	return &mocks.CartRepo{
		GetItemsFn: func(context.Context, int64) ([]models.CartItemResponse, error) {
			return []models.CartItemResponse{{VariantID: 10, Quantity: 2, UnitPriceSnapshot: 25}}, nil
		},
	}
}

func strptr(s string) *string { return &s }

func TestCreateOrder_EmptyCart(t *testing.T) {
	svc := buildOrderService(&mocks.OrderRepo{}, &mocks.CartRepo{}, &mocks.CouponRepo{}, &mocks.ShippingMethodRepo{}, &mocks.InventoryRepo{})

	_, err := svc.CreateOrder(context.Background(), 1, models.CreateOrderReq{ShippingMethodID: 1})
	if !errors.Is(err, models.ErrCartEmpty) {
		t.Fatalf("err = %v; want ErrCartEmpty", err)
	}
}

func TestCreateOrder_InvalidShipping(t *testing.T) {
	shipRepo := &mocks.ShippingMethodRepo{
		GetByIDFn: func(context.Context, int64) (*models.ShippingMethod, error) {
			return nil, models.ErrNotFound
		},
	}
	svc := buildOrderService(&mocks.OrderRepo{}, nonEmptyCart(), &mocks.CouponRepo{}, shipRepo, &mocks.InventoryRepo{})

	_, err := svc.CreateOrder(context.Background(), 1, models.CreateOrderReq{ShippingMethodID: 99})
	if !errors.Is(err, models.ErrInvalidShippingMethod) {
		t.Fatalf("err = %v; want ErrInvalidShippingMethod", err)
	}
}

func TestCreateOrder_InvalidCoupon(t *testing.T) {
	couponRepo := &mocks.CouponRepo{
		GetByCodeFn: func(context.Context, string) (*models.Coupon, error) {
			return nil, models.ErrNotFound
		},
	}
	svc := buildOrderService(&mocks.OrderRepo{}, nonEmptyCart(), couponRepo, &mocks.ShippingMethodRepo{}, &mocks.InventoryRepo{})

	req := models.CreateOrderReq{ShippingMethodID: 1, CouponCode: strptr("BAD")}
	_, err := svc.CreateOrder(context.Background(), 1, req)
	if !errors.Is(err, models.ErrInvalidCoupon) {
		t.Fatalf("err = %v; want ErrInvalidCoupon", err)
	}
}

func TestCreateOrder_ExpiredCoupon(t *testing.T) {
	now := time.Now()
	couponRepo := &mocks.CouponRepo{
		GetByCodeFn: func(context.Context, string) (*models.Coupon, error) {
			return &models.Coupon{
				ID:        7,
				IsActive:  true,
				StartsAt:  now.Add(-48 * time.Hour),
				ExpiresAt: timePtr(now.Add(-24 * time.Hour)),
			}, nil
		},
	}
	svc := buildOrderService(&mocks.OrderRepo{}, nonEmptyCart(), couponRepo, &mocks.ShippingMethodRepo{}, &mocks.InventoryRepo{})

	req := models.CreateOrderReq{ShippingMethodID: 1, CouponCode: strptr("OLD")}
	_, err := svc.CreateOrder(context.Background(), 1, req)
	if !errors.Is(err, models.ErrCouponExpired) {
		t.Fatalf("err = %v; want ErrCouponExpired", err)
	}
}

func TestCreateOrder_HappyPath(t *testing.T) {
	tx := &mocks.FakeTx{}
	orderRepo := &mocks.OrderRepo{
		Tx: tx,
		CreateFn: func(context.Context, pgx.Tx, models.CreateOrderReq, int64, float64, float64, float64, float64, *int64) (*models.Order, error) {
			return &models.Order{ID: 100, TotalAmount: 59}, nil
		},
		GetItemsFn: func(context.Context, int64) ([]models.OrderItemResponse, error) {
			return []models.OrderItemResponse{{VariantID: 10, Quantity: 2}}, nil
		},
	}
	reserved := false
	invRepo := &mocks.InventoryRepo{
		ReserveFn: func(context.Context, pgx.Tx, int64, int, int64) error { reserved = true; return nil },
	}
	svc := buildOrderService(orderRepo, nonEmptyCart(), &mocks.CouponRepo{}, &mocks.ShippingMethodRepo{}, invRepo)

	order, err := svc.CreateOrder(context.Background(), 1, models.CreateOrderReq{
		ShippingMethodID: 1, PaymentMethod: models.PaymentMethodCard,
	})
	if err != nil {
		t.Fatalf("CreateOrder err = %v; want nil", err)
	}
	if order.ID != 100 {
		t.Fatalf("order.ID = %d; want 100", order.ID)
	}
	if !reserved {
		t.Fatal("inventory was not reserved on the happy path")
	}
	if !tx.Committed {
		t.Fatal("order tx was not committed")
	}
}

// Stock reservation now runs inside the order transaction, so a shortfall must
// roll the whole order back — nothing is committed and no compensating cancel is
// needed (the order never became durable).
func TestCreateOrder_InsufficientStockRollsBack(t *testing.T) {
	tx := &mocks.FakeTx{}
	cancelled := false
	orderRepo := &mocks.OrderRepo{
		Tx: tx,
		CreateFn: func(context.Context, pgx.Tx, models.CreateOrderReq, int64, float64, float64, float64, float64, *int64) (*models.Order, error) {
			return &models.Order{ID: 100, TotalAmount: 59}, nil
		},
		CancelFn: func(context.Context, int64, int64) error { cancelled = true; return nil },
	}
	invRepo := &mocks.InventoryRepo{
		ReserveFn: func(context.Context, pgx.Tx, int64, int, int64) error {
			return models.ErrInsufficientStock
		},
	}
	svc := buildOrderService(orderRepo, nonEmptyCart(), &mocks.CouponRepo{}, &mocks.ShippingMethodRepo{}, invRepo)

	_, err := svc.CreateOrder(context.Background(), 1, models.CreateOrderReq{
		ShippingMethodID: 1, PaymentMethod: models.PaymentMethodCard,
	})
	if !errors.Is(err, models.ErrInsufficientStock) {
		t.Fatalf("err = %v; want ErrInsufficientStock", err)
	}
	if tx.Committed {
		t.Fatal("tx must NOT commit when stock reservation fails")
	}
	if !tx.RolledBack {
		t.Fatal("tx should roll back on stock failure")
	}
	if cancelled {
		t.Fatal("no compensating cancel expected — the rollback already undid the order")
	}
}

func timePtr(t time.Time) *time.Time { return &t }

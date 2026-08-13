package orders

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/tiredbooy/internal/features/addresses"
	"github.com/tiredbooy/internal/features/cart"
	"github.com/tiredbooy/internal/features/coupons"
	"github.com/tiredbooy/internal/features/inventory"
	"github.com/tiredbooy/internal/features/payments"
	"github.com/tiredbooy/internal/features/shipping"
	"github.com/tiredbooy/internal/models"
)

// Local stubs — tests must not import mocks (cycle via orders.Repository).

type fakeTx struct {
	Committed  bool
	RolledBack bool
}

func (t *fakeTx) Begin(context.Context) (pgx.Tx, error) { return t, nil }
func (t *fakeTx) Commit(context.Context) error          { t.Committed = true; return nil }
func (t *fakeTx) Rollback(context.Context) error        { t.RolledBack = true; return nil }
func (t *fakeTx) CopyFrom(context.Context, pgx.Identifier, []string, pgx.CopyFromSource) (int64, error) {
	return 0, nil
}
func (t *fakeTx) SendBatch(context.Context, *pgx.Batch) pgx.BatchResults { return nil }
func (t *fakeTx) LargeObjects() pgx.LargeObjects                         { return pgx.LargeObjects{} }
func (t *fakeTx) Prepare(context.Context, string, string) (*pgconn.StatementDescription, error) {
	return nil, nil
}
func (t *fakeTx) Exec(context.Context, string, ...any) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, nil
}
func (t *fakeTx) Query(context.Context, string, ...any) (pgx.Rows, error) { return nil, nil }
func (t *fakeTx) QueryRow(context.Context, string, ...any) pgx.Row        { return nil }
func (t *fakeTx) Conn() *pgx.Conn                                         { return nil }

type orderRepoStub struct {
	Repository
	tx       *fakeTx
	createFn func(context.Context, pgx.Tx, CreateOrderReq, int64, float64, float64, float64, float64, float64, []byte, bool, *int64) (*Order, error)
	cancelFn func(context.Context, int64, int64) error
	itemsFn  func(context.Context, int64) ([]OrderItemResponse, error)
}

func (r *orderRepoStub) BeginTx(context.Context) (pgx.Tx, error) {
	if r.tx == nil {
		r.tx = &fakeTx{}
	}
	return r.tx, nil
}
func (r *orderRepoStub) Create(ctx context.Context, tx pgx.Tx, req CreateOrderReq, userID int64, subtotal, discount, shipping, tax, giftFee float64, giftJSON []byte, giftWrap bool, couponID *int64) (*Order, error) {
	if r.createFn != nil {
		return r.createFn(ctx, tx, req, userID, subtotal, discount, shipping, tax, giftFee, giftJSON, giftWrap, couponID)
	}
	return &Order{}, nil
}
func (r *orderRepoStub) Cancel(ctx context.Context, id, userID int64) error {
	if r.cancelFn != nil {
		return r.cancelFn(ctx, id, userID)
	}
	return nil
}
func (r *orderRepoStub) GetItems(ctx context.Context, orderID int64) ([]OrderItemResponse, error) {
	if r.itemsFn != nil {
		return r.itemsFn(ctx, orderID)
	}
	return nil, nil
}
func (r *orderRepoStub) GetStockLines(ctx context.Context, orderID int64) ([]inventory.StockLine, error) {
	items, err := r.GetItems(ctx, orderID)
	if err != nil {
		return nil, err
	}
	lines := make([]inventory.StockLine, len(items))
	for i, item := range items {
		lines[i] = inventory.StockLine{VariantID: item.VariantID, Quantity: item.Quantity}
	}
	return lines, nil
}
func (r *orderRepoStub) MarkAsPaid(context.Context, pgx.Tx, int64) error { return nil }

type itemRepoStub struct{ ItemRepository }

func (itemRepoStub) BulkCreate(context.Context, pgx.Tx, int64, []cart.CartItemResponse) error {
	return nil
}

type cartRepoStub struct {
	cart.Repository
	items []cart.CartItemResponse
}

func (c *cartRepoStub) GetOrCreate(context.Context, int64) (*cart.Cart, error) {
	return &cart.Cart{ID: 1}, nil
}
func (c *cartRepoStub) GetItems(context.Context, int64) ([]cart.CartItemResponse, error) {
	return c.items, nil
}
func (c *cartRepoStub) Clear(context.Context, pgx.Tx, int64) error { return nil }

type couponRepoStub struct {
	coupons.Repository
	getByCodeFn func(context.Context, string) (*coupons.Coupon, error)
}

func (c *couponRepoStub) GetByCode(ctx context.Context, code string) (*coupons.Coupon, error) {
	if c.getByCodeFn != nil {
		return c.getByCodeFn(ctx, code)
	}
	return nil, models.ErrNotFound
}

type couponUsageStub struct{ coupons.UsageRepository }

func (couponUsageStub) Record(context.Context, pgx.Tx, int64, int64, int64, float64) error {
	return nil
}

type invRepoStub struct {
	inventory.Repository
	tx        *fakeTx
	reserveFn func(context.Context, pgx.Tx, int64, int, int64) error
}

func (r *invRepoStub) BeginTx(context.Context) (pgx.Tx, error) {
	if r.tx == nil {
		r.tx = &fakeTx{}
	}
	return r.tx, nil
}
func (r *invRepoStub) Reserve(ctx context.Context, tx pgx.Tx, variantID int64, quantity int, orderID int64) error {
	if r.reserveFn != nil {
		return r.reserveFn(ctx, tx, variantID, quantity, orderID)
	}
	return nil
}
func (r *invRepoStub) Release(context.Context, pgx.Tx, int64, int, int64) error { return nil }
func (r *invRepoStub) Deduct(context.Context, pgx.Tx, int64, int, int64) error  { return nil }
func (r *invRepoStub) EnsureForVariant(context.Context, int64) error            { return nil }
func (r *invRepoStub) EnsureForVariantTx(context.Context, pgx.Tx, int64) error  { return nil }
func (r *invRepoStub) GetByVariantID(context.Context, int64) (*inventory.Inventory, error) {
	return nil, nil
}
func (r *invRepoStub) GetAll(context.Context, inventory.InventoryFilter) ([]*inventory.Inventory, int64, error) {
	return nil, 0, nil
}
func (r *invRepoStub) GetLowStock(context.Context) ([]*inventory.Inventory, error) { return nil, nil }
func (r *invRepoStub) Adjust(context.Context, pgx.Tx, int64, inventory.AdjustStockReq, *int64) error {
	return nil
}
func (r *invRepoStub) UpdateReorder(context.Context, int64, inventory.UpdateReorderReq) (*inventory.Inventory, error) {
	return nil, nil
}

type movementStub struct{ inventory.MovementRepository }

func (movementStub) GetAll(context.Context, inventory.MovementFilter) ([]*inventory.InventoryMovement, int64, error) {
	return nil, 0, nil
}
func (movementStub) GetByVariantID(context.Context, int64) ([]*inventory.InventoryMovement, error) {
	return nil, nil
}

type paymentRepoStub struct{ payments.Repository }

func (paymentRepoStub) BeginTx(context.Context) (pgx.Tx, error) { return &fakeTx{}, nil }
func (paymentRepoStub) Create(context.Context, pgx.Tx, payments.CreatePaymentTransactionReq) (*payments.PaymentTransaction, error) {
	return &payments.PaymentTransaction{}, nil
}
func (paymentRepoStub) GetByID(context.Context, int64) (*payments.PaymentTransaction, error) {
	return nil, nil
}
func (paymentRepoStub) GetByTransactionID(context.Context, string) (*payments.PaymentTransaction, error) {
	return nil, nil
}
func (paymentRepoStub) GetAll(context.Context, payments.PaymentTransactionFilter) ([]*payments.PaymentTransaction, int64, error) {
	return nil, 0, nil
}
func (paymentRepoStub) Confirm(context.Context, pgx.Tx, payments.ConfirmPaymentReq) (*payments.PaymentTransaction, error) {
	return nil, nil
}
func (paymentRepoStub) Fail(context.Context, payments.FailPaymentReq) (*payments.PaymentTransaction, error) {
	return nil, nil
}

type stubShippingAuthorizer struct {
	cost float64
	err  error
}

func (s stubShippingAuthorizer) AuthorizeCheckoutMethod(
	context.Context, int64, string, float64, float64,
) (*shipping.ShippingMethod, float64, error) {
	if s.err != nil {
		return nil, 0, s.err
	}
	return &shipping.ShippingMethod{ID: 1, ShippingZoneID: 1, IsActive: true, BaseRate: s.cost}, s.cost, nil
}

type stubAddressLookup struct {
	country string
	err     error
}

func (s stubAddressLookup) GetByID(context.Context, int64, int64) (*addresses.Address, error) {
	if s.err != nil {
		return nil, s.err
	}
	country := s.country
	if country == "" {
		country = "IR"
	}
	return &addresses.Address{ID: 1, UserID: 1, Country: country}, nil
}

func buildOrderService(orderRepo *orderRepoStub, cartRepo *cartRepoStub, couponRepo *couponRepoStub, ship shippingAuthorizer, invRepo *invRepoStub) Service {
	if invRepo == nil {
		invRepo = &invRepoStub{}
	}
	inv := inventory.NewService(invRepo, movementStub{})
	pay := payments.NewService(paymentRepoStub{}, orderRepo, inv, nil, nil, nil, nil)
	if ship == nil {
		ship = stubShippingAuthorizer{cost: 9}
	}
	if cartRepo == nil {
		cartRepo = &cartRepoStub{}
	}
	if couponRepo == nil {
		couponRepo = &couponRepoStub{}
	}
	if orderRepo == nil {
		orderRepo = &orderRepoStub{}
	}
	return NewService(orderRepo, itemRepoStub{}, cartRepo, couponRepo, couponUsageStub{}, ship, stubAddressLookup{}, inv, pay, nil)
}

func nonEmptyCart() *cartRepoStub {
	return &cartRepoStub{
		items: []cart.CartItemResponse{{VariantID: 10, Quantity: 2, UnitPriceSnapshot: 25}},
	}
}

func strptr(s string) *string { return &s }

func TestCreateOrder_EmptyCart(t *testing.T) {
	svc := buildOrderService(&orderRepoStub{}, &cartRepoStub{}, &couponRepoStub{}, nil, &invRepoStub{})

	_, err := svc.CreateOrder(context.Background(), 1, CreateOrderReq{ShippingMethodID: 1, AddressID: 1})
	if !errors.Is(err, models.ErrCartEmpty) {
		t.Fatalf("err = %v; want ErrCartEmpty", err)
	}
}

func TestCreateOrder_InvalidShipping(t *testing.T) {
	ship := stubShippingAuthorizer{err: models.ErrInvalidShippingMethod}
	svc := buildOrderService(&orderRepoStub{}, nonEmptyCart(), &couponRepoStub{}, ship, &invRepoStub{})

	_, err := svc.CreateOrder(context.Background(), 1, CreateOrderReq{ShippingMethodID: 99, AddressID: 1})
	if !errors.Is(err, models.ErrInvalidShippingMethod) {
		t.Fatalf("err = %v; want ErrInvalidShippingMethod", err)
	}
}

func TestCreateOrder_InvalidCoupon(t *testing.T) {
	couponRepo := &couponRepoStub{
		getByCodeFn: func(context.Context, string) (*coupons.Coupon, error) {
			return nil, models.ErrNotFound
		},
	}
	svc := buildOrderService(&orderRepoStub{}, nonEmptyCart(), couponRepo, nil, &invRepoStub{})

	req := CreateOrderReq{ShippingMethodID: 1, AddressID: 1, CouponCode: strptr("BAD")}
	_, err := svc.CreateOrder(context.Background(), 1, req)
	if !errors.Is(err, models.ErrInvalidCoupon) {
		t.Fatalf("err = %v; want ErrInvalidCoupon", err)
	}
}

func TestCreateOrder_ExpiredCoupon(t *testing.T) {
	now := time.Now()
	couponRepo := &couponRepoStub{
		getByCodeFn: func(context.Context, string) (*coupons.Coupon, error) {
			return &coupons.Coupon{
				ID:        7,
				IsActive:  true,
				StartsAt:  now.Add(-48 * time.Hour),
				ExpiresAt: timePtr(now.Add(-24 * time.Hour)),
			}, nil
		},
	}
	svc := buildOrderService(&orderRepoStub{}, nonEmptyCart(), couponRepo, nil, &invRepoStub{})

	req := CreateOrderReq{ShippingMethodID: 1, AddressID: 1, CouponCode: strptr("OLD")}
	_, err := svc.CreateOrder(context.Background(), 1, req)
	if !errors.Is(err, models.ErrCouponExpired) {
		t.Fatalf("err = %v; want ErrCouponExpired", err)
	}
}

func TestCreateOrder_HappyPath(t *testing.T) {
	tx := &fakeTx{}
	orderRepo := &orderRepoStub{
		tx: tx,
		createFn: func(context.Context, pgx.Tx, CreateOrderReq, int64, float64, float64, float64, float64, float64, []byte, bool, *int64) (*Order, error) {
			return &Order{ID: 100, TotalAmount: 59}, nil
		},
		itemsFn: func(context.Context, int64) ([]OrderItemResponse, error) {
			return []OrderItemResponse{{VariantID: 10, Quantity: 2}}, nil
		},
	}
	reserved := false
	invRepo := &invRepoStub{
		reserveFn: func(context.Context, pgx.Tx, int64, int, int64) error { reserved = true; return nil },
	}
	svc := buildOrderService(orderRepo, nonEmptyCart(), &couponRepoStub{}, nil, invRepo)

	order, err := svc.CreateOrder(context.Background(), 1, CreateOrderReq{
		ShippingMethodID: 1, AddressID: 1, PaymentMethod: models.PaymentMethodCard,
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

// Stock reservation runs inside the order transaction, so a shortfall rolls the whole order back.
func TestCreateOrder_InsufficientStockRollsBack(t *testing.T) {
	tx := &fakeTx{}
	cancelled := false
	orderRepo := &orderRepoStub{
		tx: tx,
		createFn: func(context.Context, pgx.Tx, CreateOrderReq, int64, float64, float64, float64, float64, float64, []byte, bool, *int64) (*Order, error) {
			return &Order{ID: 100, TotalAmount: 59}, nil
		},
		cancelFn: func(context.Context, int64, int64) error { cancelled = true; return nil },
	}
	invRepo := &invRepoStub{
		reserveFn: func(context.Context, pgx.Tx, int64, int, int64) error {
			return models.ErrInsufficientStock
		},
	}
	svc := buildOrderService(orderRepo, nonEmptyCart(), &couponRepoStub{}, nil, invRepo)

	_, err := svc.CreateOrder(context.Background(), 1, CreateOrderReq{
		ShippingMethodID: 1, AddressID: 1, PaymentMethod: models.PaymentMethodCard,
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

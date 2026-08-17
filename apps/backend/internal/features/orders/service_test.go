package orders

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/tiredbooy/internal/features/addresses"
	"github.com/tiredbooy/internal/features/cart"
	"github.com/tiredbooy/internal/features/coupons"
	"github.com/tiredbooy/internal/features/inventory"
	"github.com/tiredbooy/internal/features/payments"
	"github.com/tiredbooy/internal/features/shipping"
	"github.com/tiredbooy/internal/features/site_settings"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
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
	tx             *fakeTx
	createFn       func(context.Context, pgx.Tx, CreateOrderReq, int64, float64, float64, float64, float64, float64, []byte, bool, *int64) (*Order, error)
	cancelFn       func(context.Context, int64, int64) error
	cancelTxFn     func(context.Context, pgx.Tx, int64, int64) error
	cancelTxCalls  int
	cancelTxUser   int64
	cancelTxTx     pgx.Tx
	getByIDFn      func(context.Context, int64) (*Order, error)
	itemsFn        func(context.Context, int64) ([]OrderItemResponse, error)
	updateStatusFn func(context.Context, int64, UpdateOrderStatusReq) (*Order, error)
	markPaidFn     func(context.Context, pgx.Tx, int64) error
	markPaidCalls  int
	statusWrites   int
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
func (r *orderRepoStub) CancelTx(ctx context.Context, tx pgx.Tx, id, ownerUserID int64) error {
	r.cancelTxCalls++
	r.cancelTxTx = tx
	r.cancelTxUser = ownerUserID
	if r.cancelTxFn != nil {
		return r.cancelTxFn(ctx, tx, id, ownerUserID)
	}
	if r.cancelFn != nil {
		return r.cancelFn(ctx, id, ownerUserID)
	}
	return nil
}
func (r *orderRepoStub) GetByID(ctx context.Context, id int64) (*Order, error) {
	if r.getByIDFn != nil {
		return r.getByIDFn(ctx, id)
	}
	return nil, models.ErrNotFound
}
func (r *orderRepoStub) GetByIDAndUserID(ctx context.Context, id, userID int64) (*Order, error) {
	order, err := r.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if order.UserID != 0 && order.UserID != userID {
		return nil, models.ErrNotFound
	}
	return order, nil
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
func (r *orderRepoStub) MarkAsPaid(ctx context.Context, tx pgx.Tx, orderID int64) error {
	r.markPaidCalls++
	if r.markPaidFn != nil {
		return r.markPaidFn(ctx, tx, orderID)
	}
	return nil
}

func (r *orderRepoStub) UpdateStatus(ctx context.Context, id int64, req UpdateOrderStatusReq) (*Order, error) {
	r.statusWrites++
	if r.updateStatusFn != nil {
		return r.updateStatusFn(ctx, id, req)
	}
	return &Order{ID: id, Status: req.Status}, nil
}

type clawbackStub struct {
	calls [][2]int64
	err   error
}

func (c *clawbackStub) ClawbackOrderEarn(_ context.Context, userID, orderID int64) error {
	c.calls = append(c.calls, [2]int64{userID, orderID})
	return c.err
}

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
	coupon      *coupons.Coupon
	getByCodeFn func(context.Context, string) (*coupons.Coupon, error)
}

func (c *couponRepoStub) GetByCode(ctx context.Context, code string) (*coupons.Coupon, error) {
	if c.getByCodeFn != nil {
		return c.getByCodeFn(ctx, code)
	}
	if c.coupon != nil {
		return c.coupon, nil
	}
	return nil, models.ErrNotFound
}

func (c *couponRepoStub) GetByIDForUpdate(_ context.Context, _ pgx.Tx, id int64) (*coupons.Coupon, error) {
	if c.coupon != nil && (id == 0 || c.coupon.ID == id) {
		return c.coupon, nil
	}
	if c.getByCodeFn != nil {
		return c.getByCodeFn(context.Background(), "")
	}
	return nil, models.ErrNotFound
}

func (couponRepoStub) CountUsagesTx(context.Context, pgx.Tx, int64) (int, error) {
	return 0, nil
}
func (couponRepoStub) CountUsagesByUserTx(context.Context, pgx.Tx, int64, int64) (int, error) {
	return 0, nil
}

type couponUsageStub struct {
	coupons.UsageRepository
	deleteFn    func(context.Context, pgx.Tx, int64) error
	deleteCalls int
	deleteTx    pgx.Tx
	deleteID    int64
}

func (couponUsageStub) Record(context.Context, pgx.Tx, int64, int64, int64, float64) error {
	return nil
}

func (c *couponUsageStub) DeleteByOrderTx(ctx context.Context, tx pgx.Tx, orderID int64) error {
	c.deleteCalls++
	c.deleteTx = tx
	c.deleteID = orderID
	if c.deleteFn != nil {
		return c.deleteFn(ctx, tx, orderID)
	}
	return nil
}

type invAdjustCall struct {
	variantID int64
	req       inventory.AdjustStockReq
	orderID   *int64
}

type invRepoStub struct {
	inventory.Repository
	tx          *fakeTx
	reserveFn   func(context.Context, pgx.Tx, int64, int, int64) error
	releaseFn   func(context.Context, pgx.Tx, int64, int, int64) error
	deductFn    func(context.Context, pgx.Tx, int64, int, int64) error
	adjustFn    func(context.Context, pgx.Tx, int64, inventory.AdjustStockReq, *int64) error
	deducts     int
	releases    []invReleaseCall
	adjustCalls []invAdjustCall
}

type invReleaseCall struct {
	tx        pgx.Tx
	variantID int64
	quantity  int
	orderID   int64
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
func (r *invRepoStub) Release(ctx context.Context, tx pgx.Tx, variantID int64, quantity int, orderID int64) error {
	r.releases = append(r.releases, invReleaseCall{tx: tx, variantID: variantID, quantity: quantity, orderID: orderID})
	if r.releaseFn != nil {
		return r.releaseFn(ctx, tx, variantID, quantity, orderID)
	}
	return nil
}
func (r *invRepoStub) Deduct(ctx context.Context, tx pgx.Tx, variantID int64, quantity int, orderID int64) error {
	r.deducts++
	if r.deductFn != nil {
		return r.deductFn(ctx, tx, variantID, quantity, orderID)
	}
	return nil
}
func (r *invRepoStub) EnsureForVariant(context.Context, int64) error           { return nil }
func (r *invRepoStub) EnsureForVariantTx(context.Context, pgx.Tx, int64) error { return nil }
func (r *invRepoStub) GetByVariantID(context.Context, int64) (*inventory.Inventory, error) {
	return nil, nil
}
func (r *invRepoStub) GetAll(context.Context, inventory.InventoryFilter) ([]*inventory.Inventory, int64, error) {
	return nil, 0, nil
}
func (r *invRepoStub) GetLowStock(context.Context) ([]*inventory.Inventory, error) { return nil, nil }
func (r *invRepoStub) Adjust(ctx context.Context, tx pgx.Tx, variantID int64, req inventory.AdjustStockReq, orderID *int64) error {
	r.adjustCalls = append(r.adjustCalls, invAdjustCall{variantID: variantID, req: req, orderID: orderID})
	if r.adjustFn != nil {
		return r.adjustFn(ctx, tx, variantID, req, orderID)
	}
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

type paymentRepoStub struct {
	payments.Repository
	creates   int
	begins    int
	createErr error
	createTx  pgx.Tx
	lastReq   payments.CreatePaymentTransactionReq
	all       []*payments.PaymentTransaction
}

func (p *paymentRepoStub) BeginTx(context.Context) (pgx.Tx, error) {
	p.begins++
	return &fakeTx{}, nil
}
func (p *paymentRepoStub) Create(_ context.Context, tx pgx.Tx, req payments.CreatePaymentTransactionReq) (*payments.PaymentTransaction, error) {
	p.creates++
	p.createTx = tx
	p.lastReq = req
	if p.createErr != nil {
		return nil, p.createErr
	}
	uid := req.UserID
	pt := &payments.PaymentTransaction{
		ID:            int64(100 + p.creates),
		OrderID:       req.OrderID,
		UserID:        &uid,
		Amount:        req.Amount,
		Currency:      req.Currency,
		Status:        payments.PaymentStatusPending,
		PaymentMethod: req.PaymentMethod,
		TransactionID: req.TransactionID,
	}
	p.all = append(p.all, pt)
	return pt, nil
}
func (paymentRepoStub) GetByID(context.Context, int64) (*payments.PaymentTransaction, error) {
	return nil, nil
}
func (paymentRepoStub) GetByTransactionID(context.Context, string) (*payments.PaymentTransaction, error) {
	return nil, nil
}
func (p *paymentRepoStub) GetAll(_ context.Context, f payments.PaymentTransactionFilter) ([]*payments.PaymentTransaction, int64, error) {
	var out []*payments.PaymentTransaction
	for _, pt := range p.all {
		if f.OrderID != nil && (pt.OrderID == nil || *pt.OrderID != *f.OrderID) {
			continue
		}
		if f.Status != nil && pt.Status != *f.Status {
			continue
		}
		out = append(out, pt)
	}
	return out, int64(len(out)), nil
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
	return &shipping.ShippingMethod{
		ID: 1, ShippingZoneID: 1, IsActive: true, BaseRate: s.cost,
		Name: "Standard", Carrier: strptr("Post"),
	}, s.cost, nil
}

type stubAddressLookup struct {
	country string
	addr    *addresses.Address
	err     error
}

func (s stubAddressLookup) GetByID(context.Context, int64, int64) (*addresses.Address, error) {
	if s.err != nil {
		return nil, s.err
	}
	if s.addr != nil {
		return s.addr, nil
	}
	country := s.country
	if country == "" {
		country = "IR"
	}
	return &addresses.Address{
		ID:            1,
		UserID:        1,
		FullName:      "Ada Lovelace",
		PhoneNumber:   strptr("09120000000"),
		AddressLine1:  "1 Main St",
		City:          "Tehran",
		StateProvince: strptr("Tehran"),
		PostalCode:    "12345",
		Country:       country,
	}, nil
}

func buildOrderService(orderRepo *orderRepoStub, cartRepo *cartRepoStub, couponRepo *couponRepoStub, ship shippingAuthorizer, invRepo *invRepoStub) Service {
	svc, _ := buildOrderServiceWired(orderRepo, cartRepo, couponRepo, ship, invRepo, nil)
	return svc
}

func buildOrderServiceWired(
	orderRepo *orderRepoStub,
	cartRepo *cartRepoStub,
	couponRepo *couponRepoStub,
	ship shippingAuthorizer,
	invRepo *invRepoStub,
	wallet WalletPurchaser,
) (Service, *paymentRepoStub) {
	if invRepo == nil {
		invRepo = &invRepoStub{}
	}
	inv := inventory.NewService(invRepo, movementStub{})
	payRepo := &paymentRepoStub{}
	pay := payments.NewService(payRepo, orderRepo, inv, nil, nil, nil, nil).
		WithStartBaseURL("https://pay.example/start")
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
	return NewService(orderRepo, itemRepoStub{}, cartRepo, couponRepo, &couponUsageStub{}, ship, stubAddressLookup{}, inv, pay, nil, nil, wallet), payRepo
}

func buildOrderServiceWithClawback(orderRepo *orderRepoStub, clawback orderEarnClawback) Service {
	if orderRepo == nil {
		orderRepo = &orderRepoStub{}
	}
	inv := inventory.NewService(&invRepoStub{}, movementStub{})
	pay := payments.NewService(&paymentRepoStub{}, orderRepo, inv, nil, nil, nil, nil)
	return NewService(orderRepo, itemRepoStub{}, &cartRepoStub{}, &couponRepoStub{}, &couponUsageStub{}, stubShippingAuthorizer{cost: 9}, stubAddressLookup{}, inv, pay, nil, clawback, nil)
}

type walletPurchaserStub struct {
	purchaseFn func(ctx context.Context, tx pgx.Tx, userID int64, amount float64, orderID int64) error
	calls      int
	lastTx     pgx.Tx
	lastUser   int64
	lastAmount float64
	lastOrder  int64
}

func (w *walletPurchaserStub) PurchaseTx(ctx context.Context, tx pgx.Tx, userID int64, amount float64, orderID int64) error {
	w.calls++
	w.lastTx = tx
	w.lastUser = userID
	w.lastAmount = amount
	w.lastOrder = orderID
	if w.purchaseFn != nil {
		return w.purchaseFn(ctx, tx, userID, amount, orderID)
	}
	return nil
}

type walletWithBalanceStub struct {
	walletPurchaserStub
	balance float64
}

func (w *walletWithBalanceStub) AvailableBalance(context.Context, int64) (float64, error) {
	return w.balance, nil
}

type giftConfigStub struct {
	cfg site_settings.GiftCheckoutSettings
	err error
}

func (g giftConfigStub) GiftCheckout(context.Context) (site_settings.GiftCheckoutSettings, error) {
	if g.err != nil {
		return site_settings.GiftCheckoutSettings{}, g.err
	}
	return g.cfg, nil
}

func buildOrderServiceGift(
	orderRepo *orderRepoStub,
	cartRepo *cartRepoStub,
	couponRepo *couponRepoStub,
	gift giftConfigLookup,
) Service {
	if orderRepo == nil {
		orderRepo = &orderRepoStub{}
	}
	if cartRepo == nil {
		cartRepo = &cartRepoStub{}
	}
	if couponRepo == nil {
		couponRepo = &couponRepoStub{}
	}
	inv := inventory.NewService(&invRepoStub{}, movementStub{})
	pay := payments.NewService(&paymentRepoStub{}, orderRepo, inv, nil, nil, nil, nil)
	return NewService(
		orderRepo, itemRepoStub{}, cartRepo, couponRepo, &couponUsageStub{},
		stubShippingAuthorizer{cost: 9}, stubAddressLookup{}, inv, pay, gift, nil, nil,
	)
}

func pricedGiftConfig(fee float64) giftConfigStub {
	return giftConfigStub{
		cfg: site_settings.GiftCheckoutSettings{
			Enabled:          true,
			MessageEnabled:   true,
			MessageMaxLength: 500,
			HidePriceEnabled: true,
			Options: []site_settings.GiftCheckoutOption{
				{ID: "gift_wrap", Label: "Wrap", Price: fee, Enabled: true},
			},
		},
	}
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

func TestCreateOrder_WalletSettlesInSameTx(t *testing.T) {
	tx := &fakeTx{}
	orderRepo := &orderRepoStub{
		tx: tx,
		createFn: func(context.Context, pgx.Tx, CreateOrderReq, int64, float64, float64, float64, float64, float64, []byte, bool, *int64) (*Order, error) {
			return &Order{ID: 100, TotalAmount: 59, Status: OrderStatusPending}, nil
		},
	}
	invRepo := &invRepoStub{}
	wallet := &walletPurchaserStub{}
	svc, payRepo := buildOrderServiceWired(orderRepo, nonEmptyCart(), &couponRepoStub{}, nil, invRepo, wallet)

	order, err := svc.CreateOrder(context.Background(), 7, CreateOrderReq{
		ShippingMethodID: 1, AddressID: 1, PaymentMethod: models.PaymentMethodWallet,
	})
	if err != nil {
		t.Fatalf("CreateOrder err = %v; want nil", err)
	}
	if order.Status != OrderStatusPaid {
		t.Fatalf("status = %s; want paid", order.Status)
	}
	if order.PaidAt == nil {
		t.Fatal("PaidAt must be set on wallet checkout")
	}
	if wallet.calls != 1 {
		t.Fatalf("PurchaseTx calls = %d; want 1", wallet.calls)
	}
	if wallet.lastTx != tx {
		t.Fatal("PurchaseTx must use the order TX")
	}
	if wallet.lastUser != 7 || wallet.lastAmount != 59 || wallet.lastOrder != 100 {
		t.Fatalf("PurchaseTx args user=%d amount=%v order=%d", wallet.lastUser, wallet.lastAmount, wallet.lastOrder)
	}
	if orderRepo.markPaidCalls != 1 {
		t.Fatalf("MarkAsPaid calls = %d; want 1", orderRepo.markPaidCalls)
	}
	if invRepo.deducts != 1 {
		t.Fatalf("Deduct calls = %d; want 1 (same reserved lines)", invRepo.deducts)
	}
	if payRepo.creates != 0 {
		t.Fatalf("pending payment creates = %d; want 0 for wallet", payRepo.creates)
	}
	if !tx.Committed {
		t.Fatal("wallet settle must commit the order TX")
	}
}

func TestCreateOrder_WalletInsufficientFundsRollsBack(t *testing.T) {
	tx := &fakeTx{}
	orderRepo := &orderRepoStub{
		tx: tx,
		createFn: func(context.Context, pgx.Tx, CreateOrderReq, int64, float64, float64, float64, float64, float64, []byte, bool, *int64) (*Order, error) {
			return &Order{ID: 100, TotalAmount: 59, Status: OrderStatusPending}, nil
		},
	}
	invRepo := &invRepoStub{}
	wallet := &walletPurchaserStub{
		purchaseFn: func(context.Context, pgx.Tx, int64, float64, int64) error {
			return apperr.ErrInsufficientFunds
		},
	}
	svc, payRepo := buildOrderServiceWired(orderRepo, nonEmptyCart(), &couponRepoStub{}, nil, invRepo, wallet)

	_, err := svc.CreateOrder(context.Background(), 1, CreateOrderReq{
		ShippingMethodID: 1, AddressID: 1, PaymentMethod: models.PaymentMethodWallet,
	})
	if !errors.Is(err, apperr.ErrInsufficientFunds) {
		t.Fatalf("err = %v; want apperr.ErrInsufficientFunds", err)
	}
	if tx.Committed {
		t.Fatal("tx must NOT commit when wallet funds are short")
	}
	if !tx.RolledBack {
		t.Fatal("tx should roll back on insufficient funds")
	}
	if orderRepo.markPaidCalls != 0 {
		t.Fatal("must not mark paid after a short wallet")
	}
	if invRepo.deducts != 0 {
		t.Fatal("must not deduct stock after a short wallet")
	}
	if payRepo.creates != 0 {
		t.Fatal("must not create a pending payment after a short wallet")
	}
}

func TestCreateOrder_WalletCheapBalanceRejectsBeforeDebit(t *testing.T) {
	tx := &fakeTx{}
	orderRepo := &orderRepoStub{
		tx: tx,
		createFn: func(context.Context, pgx.Tx, CreateOrderReq, int64, float64, float64, float64, float64, float64, []byte, bool, *int64) (*Order, error) {
			return &Order{ID: 100, TotalAmount: 59, Status: OrderStatusPending}, nil
		},
	}
	wallet := &walletWithBalanceStub{balance: 10}
	svc, _ := buildOrderServiceWired(orderRepo, nonEmptyCart(), &couponRepoStub{}, nil, &invRepoStub{}, wallet)

	_, err := svc.CreateOrder(context.Background(), 1, CreateOrderReq{
		ShippingMethodID: 1, AddressID: 1, PaymentMethod: models.PaymentMethodWallet,
	})
	if !errors.Is(err, apperr.ErrInsufficientFunds) {
		t.Fatalf("err = %v; want apperr.ErrInsufficientFunds", err)
	}
	if wallet.calls != 0 {
		t.Fatal("cheap balance check must reject before PurchaseTx")
	}
	if tx.Committed {
		t.Fatal("tx must NOT commit when cheap balance check fails")
	}
	if !tx.RolledBack {
		t.Fatal("tx should roll back so the reserve is not committed")
	}
}

func TestCreateOrder_NonWalletStillCreatesPendingPayment(t *testing.T) {
	tx := &fakeTx{}
	orderRepo := &orderRepoStub{
		tx: tx,
		createFn: func(context.Context, pgx.Tx, CreateOrderReq, int64, float64, float64, float64, float64, float64, []byte, bool, *int64) (*Order, error) {
			return &Order{ID: 100, TotalAmount: 59, Status: OrderStatusPending}, nil
		},
	}
	wallet := &walletPurchaserStub{}
	svc, payRepo := buildOrderServiceWired(orderRepo, nonEmptyCart(), &couponRepoStub{}, nil, &invRepoStub{}, wallet)

	order, err := svc.CreateOrder(context.Background(), 1, CreateOrderReq{
		ShippingMethodID: 1, AddressID: 1, PaymentMethod: models.PaymentMethodCard,
	})
	if err != nil {
		t.Fatalf("CreateOrder err = %v; want nil", err)
	}
	if order.Status != OrderStatusPending {
		t.Fatalf("status = %s; want pending", order.Status)
	}
	if wallet.calls != 0 {
		t.Fatal("card checkout must not debit the wallet")
	}
	if orderRepo.markPaidCalls != 0 {
		t.Fatal("card checkout must not mark paid")
	}
	if payRepo.creates != 1 {
		t.Fatalf("pending payment creates = %d; want 1", payRepo.creates)
	}
	if payRepo.begins != 0 {
		t.Fatal("pending payment must insert on the order TX, not a nested payment TX")
	}
	if payRepo.createTx != tx {
		t.Fatal("pending payment must use the order TX")
	}
	if payRepo.lastReq.Currency != "IRT" {
		t.Fatalf("currency = %q; want IRT", payRepo.lastReq.Currency)
	}
	if order.PaymentID == 0 || order.TransactionID == "" {
		t.Fatalf("order missing payment fields id=%d tx=%q", order.PaymentID, order.TransactionID)
	}
}

func TestCreateOrder_PendingPaymentFailureRollsBack(t *testing.T) {
	tx := &fakeTx{}
	orderRepo := &orderRepoStub{
		tx: tx,
		createFn: func(context.Context, pgx.Tx, CreateOrderReq, int64, float64, float64, float64, float64, float64, []byte, bool, *int64) (*Order, error) {
			return &Order{ID: 100, TotalAmount: 59, Status: OrderStatusPending}, nil
		},
	}
	svc, payRepo := buildOrderServiceWired(orderRepo, nonEmptyCart(), &couponRepoStub{}, nil, &invRepoStub{}, nil)
	payRepo.createErr = errors.New("payment insert failed")

	_, err := svc.CreateOrder(context.Background(), 1, CreateOrderReq{
		ShippingMethodID: 1, AddressID: 1, PaymentMethod: models.PaymentMethodCard,
	})
	if err == nil {
		t.Fatal("CreateOrder must fail when pending payment insert fails")
	}
	if tx.Committed {
		t.Fatal("tx must NOT commit when pending payment insert fails")
	}
	if !tx.RolledBack {
		t.Fatal("tx should roll back so the order is not kept without a payment")
	}
}

func TestPayOrder_CreatesWhenNoneOrFailed(t *testing.T) {
	oid := int64(100)
	failed := &payments.PaymentTransaction{
		ID:            50,
		OrderID:       &oid,
		Status:        payments.PaymentStatusFailed,
		TransactionID: "old-failed",
	}
	orderRepo := &orderRepoStub{
		getByIDFn: func(context.Context, int64) (*Order, error) {
			return &Order{
				ID: oid, UserID: 7, Status: OrderStatusPaymentFailed,
				TotalAmount: 59, PaymentMethod: models.PaymentMethodCard,
			}, nil
		},
	}
	svc, payRepo := buildOrderServiceWired(orderRepo, nonEmptyCart(), &couponRepoStub{}, nil, &invRepoStub{}, nil)
	payRepo.all = []*payments.PaymentTransaction{failed}

	order, err := svc.PayOrder(context.Background(), oid, 7)
	if err != nil {
		t.Fatalf("PayOrder err = %v; want nil", err)
	}
	if payRepo.creates != 1 {
		t.Fatalf("creates = %d; want 1 new pending after fail", payRepo.creates)
	}
	if order.PaymentID == 0 || order.TransactionID == "" || order.TransactionID == "old-failed" {
		t.Fatalf("expected new intent, got id=%d tx=%q", order.PaymentID, order.TransactionID)
	}
	if payRepo.lastReq.Currency != "IRT" {
		t.Fatalf("currency = %q; want IRT", payRepo.lastReq.Currency)
	}
}

func TestPayOrder_ReturnsExistingPending(t *testing.T) {
	oid := int64(100)
	pending := &payments.PaymentTransaction{
		ID:            77,
		OrderID:       &oid,
		Status:        payments.PaymentStatusPending,
		TransactionID: "still-open",
		PaymentURL:    "https://pay.example.com/start?transaction_id=still-open",
	}
	orderRepo := &orderRepoStub{
		getByIDFn: func(context.Context, int64) (*Order, error) {
			return &Order{
				ID: oid, UserID: 7, Status: OrderStatusPending,
				TotalAmount: 59, PaymentMethod: models.PaymentMethodGateway,
			}, nil
		},
	}
	svc, payRepo := buildOrderServiceWired(orderRepo, nonEmptyCart(), &couponRepoStub{}, nil, &invRepoStub{}, nil)
	payRepo.all = []*payments.PaymentTransaction{pending}

	order, err := svc.PayOrder(context.Background(), oid, 7)
	if err != nil {
		t.Fatalf("PayOrder err = %v; want nil", err)
	}
	if payRepo.creates != 0 {
		t.Fatalf("creates = %d; want 0 when pending already exists", payRepo.creates)
	}
	if order.PaymentID != 77 || order.TransactionID != "still-open" {
		t.Fatalf("got id=%d tx=%q; want existing pending", order.PaymentID, order.TransactionID)
	}
}

func TestPayOrder_RefusesAlreadyPaid(t *testing.T) {
	orderRepo := &orderRepoStub{
		getByIDFn: func(context.Context, int64) (*Order, error) {
			return &Order{
				ID: 100, UserID: 7, Status: OrderStatusPaid,
				TotalAmount: 59, PaymentMethod: models.PaymentMethodCard,
			}, nil
		},
	}
	svc, payRepo := buildOrderServiceWired(orderRepo, nonEmptyCart(), &couponRepoStub{}, nil, &invRepoStub{}, nil)

	_, err := svc.PayOrder(context.Background(), 100, 7)
	if !errors.Is(err, apperr.ErrOrderAlreadyPaid) {
		t.Fatalf("err = %v; want ErrOrderAlreadyPaid", err)
	}
	if payRepo.creates != 0 {
		t.Fatal("must not create a payment for an already-paid order")
	}
}

func timePtr(t time.Time) *time.Time { return &t }

func statusOrderRepo(userID, orderID int64) *orderRepoStub {
	return statusOrderRepoAt(userID, orderID, OrderStatusReadyToShip)
}

func statusOrderRepoAt(userID, orderID int64, current OrderStatus) *orderRepoStub {
	return &orderRepoStub{
		getByIDFn: func(_ context.Context, id int64) (*Order, error) {
			if id != orderID {
				return nil, models.ErrNotFound
			}
			return &Order{ID: orderID, UserID: userID, Status: current}, nil
		},
		updateStatusFn: func(_ context.Context, id int64, req UpdateOrderStatusReq) (*Order, error) {
			return &Order{
				ID:             orderID,
				UserID:         userID,
				Status:         req.Status,
				TrackingNumber: req.TrackingNumber,
				ParcelCarrier:  req.ParcelCarrier,
			}, nil
		},
	}
}

func TestUpdateOrderStatus_RefundStatusesRejected(t *testing.T) {
	for _, status := range []OrderStatus{
		OrderStatusRefunded,
		OrderStatusPartiallyRefunded,
		OrderStatusRefundApproved,
		OrderStatusRefundRequested,
	} {
		t.Run(string(status), func(t *testing.T) {
			repo := statusOrderRepo(42, 99)
			cb := &clawbackStub{}
			svc := buildOrderServiceWithClawback(repo, cb)

			_, err := svc.UpdateOrderStatus(context.Background(), 99, UpdateOrderStatusReq{Status: status})
			if !errors.Is(err, errUseRefundEndpoint) {
				t.Fatalf("err = %v; want errUseRefundEndpoint", err)
			}
			if repo.statusWrites != 0 {
				t.Fatal("PATCH must not write a refund status")
			}
			if len(cb.calls) != 0 {
				t.Fatal("PATCH must not clawback; use POST /admin/orders/:id/refund")
			}
		})
	}
}

func TestUpdateOrderStatus_NonRefundStillWrites(t *testing.T) {
	cb := &clawbackStub{}
	repo := statusOrderRepoAt(42, 7, OrderStatusReadyToShip)
	svc := buildOrderServiceWithClawback(repo, cb)

	got, err := svc.UpdateOrderStatus(context.Background(), 7, UpdateOrderStatusReq{Status: OrderStatusShipped})
	if err != nil {
		t.Fatalf("UpdateOrderStatus err = %v; want nil", err)
	}
	if got.Status != OrderStatusShipped {
		t.Fatalf("status = %s; want shipped", got.Status)
	}
	if repo.statusWrites != 1 {
		t.Fatalf("status writes = %d; want 1", repo.statusWrites)
	}
	if len(cb.calls) != 0 {
		t.Fatal("clawback must not run on a non-refund status write")
	}
}

func TestCanPatchTransition(t *testing.T) {
	allowed := [][2]OrderStatus{
		{OrderStatusPaid, OrderStatusProcessing},
		{OrderStatusProcessing, OrderStatusReadyToShip},
		{OrderStatusProcessing, OrderStatusShipped},
		{OrderStatusReadyToShip, OrderStatusShipped},
		{OrderStatusShipped, OrderStatusOutForDelivery},
		{OrderStatusShipped, OrderStatusDelivered},
		{OrderStatusOutForDelivery, OrderStatusDelivered},
	}
	for _, pair := range allowed {
		if !canPatchTransition(pair[0], pair[1]) {
			t.Errorf("canPatchTransition(%s, %s) = false; want true", pair[0], pair[1])
		}
	}

	denied := [][2]OrderStatus{
		{OrderStatusPending, OrderStatusProcessing},
		{OrderStatusPending, OrderStatusDelivered},
		{OrderStatusPending, OrderStatusPaid},
		{OrderStatusPaymentFailed, OrderStatusProcessing},
		{OrderStatusPaid, OrderStatusShipped},
		{OrderStatusPaid, OrderStatusDelivered},
		{OrderStatusProcessing, OrderStatusDelivered},
		{OrderStatusReadyToShip, OrderStatusProcessing},
		{OrderStatusDelivered, OrderStatusShipped},
		{OrderStatusCancelled, OrderStatusProcessing},
		{OrderStatusRefunded, OrderStatusProcessing},
		{OrderStatusShipped, OrderStatusShipped},
	}
	for _, pair := range denied {
		if canPatchTransition(pair[0], pair[1]) {
			t.Errorf("canPatchTransition(%s, %s) = true; want false", pair[0], pair[1])
		}
	}
}

func TestUpdateOrderStatus_PaidRejected(t *testing.T) {
	repo := statusOrderRepoAt(42, 99, OrderStatusPending)
	svc := buildOrderServiceWithClawback(repo, &clawbackStub{})

	_, err := svc.UpdateOrderStatus(context.Background(), 99, UpdateOrderStatusReq{Status: OrderStatusPaid})
	if !errors.Is(err, errUsePayCommand) {
		t.Fatalf("err = %v; want errUsePayCommand", err)
	}
	if repo.statusWrites != 0 {
		t.Fatal("PATCH paid must not write status")
	}
}

func TestUpdateOrderStatus_CancelledRejected(t *testing.T) {
	repo := statusOrderRepoAt(42, 99, OrderStatusPending)
	svc := buildOrderServiceWithClawback(repo, &clawbackStub{})

	_, err := svc.UpdateOrderStatus(context.Background(), 99, UpdateOrderStatusReq{Status: OrderStatusCancelled})
	if !errors.Is(err, errUseCancelEndpoint) {
		t.Fatalf("err = %v; want errUseCancelEndpoint", err)
	}
	if repo.statusWrites != 0 {
		t.Fatal("PATCH cancelled must not write status")
	}
}

func TestUpdateOrderStatus_IllegalJumpRejected(t *testing.T) {
	cases := []struct {
		name    string
		current OrderStatus
		target  OrderStatus
	}{
		{"pending to processing", OrderStatusPending, OrderStatusProcessing},
		{"pending to delivered", OrderStatusPending, OrderStatusDelivered},
		{"paid to delivered", OrderStatusPaid, OrderStatusDelivered},
		{"processing to delivered", OrderStatusProcessing, OrderStatusDelivered},
		{"delivered to processing", OrderStatusDelivered, OrderStatusProcessing},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			repo := statusOrderRepoAt(42, 7, tc.current)
			svc := buildOrderServiceWithClawback(repo, &clawbackStub{})

			_, err := svc.UpdateOrderStatus(context.Background(), 7, UpdateOrderStatusReq{Status: tc.target})
			if !errors.Is(err, errInvalidStatusTransition) {
				t.Fatalf("err = %v; want errInvalidStatusTransition", err)
			}
			if repo.statusWrites != 0 {
				t.Fatal("illegal PATCH must not write status")
			}
		})
	}
}

func TestUpdateOrderStatus_WarehouseFlowWrites(t *testing.T) {
	cases := []struct {
		current OrderStatus
		target  OrderStatus
	}{
		{OrderStatusPaid, OrderStatusProcessing},
		{OrderStatusProcessing, OrderStatusReadyToShip},
		{OrderStatusProcessing, OrderStatusShipped},
		{OrderStatusReadyToShip, OrderStatusShipped},
		{OrderStatusShipped, OrderStatusOutForDelivery},
		{OrderStatusShipped, OrderStatusDelivered},
		{OrderStatusOutForDelivery, OrderStatusDelivered},
	}
	for _, tc := range cases {
		t.Run(string(tc.current)+"→"+string(tc.target), func(t *testing.T) {
			repo := statusOrderRepoAt(42, 7, tc.current)
			svc := buildOrderServiceWithClawback(repo, &clawbackStub{})

			got, err := svc.UpdateOrderStatus(context.Background(), 7, UpdateOrderStatusReq{Status: tc.target})
			if err != nil {
				t.Fatalf("UpdateOrderStatus err = %v; want nil", err)
			}
			if got.Status != tc.target {
				t.Fatalf("status = %s; want %s", got.Status, tc.target)
			}
			if repo.statusWrites != 1 {
				t.Fatalf("status writes = %d; want 1", repo.statusWrites)
			}
		})
	}
}

func TestUpdateOrderStatus_MissingOrder(t *testing.T) {
	svc := buildOrderServiceWithClawback(&orderRepoStub{}, &clawbackStub{})
	_, err := svc.UpdateOrderStatus(context.Background(), 404, UpdateOrderStatusReq{Status: OrderStatusProcessing})
	if !errors.Is(err, models.ErrNotFound) {
		t.Fatalf("err = %v; want ErrNotFound", err)
	}
}

func TestCanPersistParcelTracking(t *testing.T) {
	if !canPersistParcelTracking(OrderStatusShipped) || !canPersistParcelTracking(OrderStatusOutForDelivery) {
		t.Fatal("ship / out_for_delivery must persist optional tracking")
	}
	for _, status := range []OrderStatus{
		OrderStatusPending,
		OrderStatusPaid,
		OrderStatusProcessing,
		OrderStatusReadyToShip,
		OrderStatusDelivered,
		OrderStatusCancelled,
		OrderStatusRefunded,
	} {
		if canPersistParcelTracking(status) {
			t.Errorf("canPersistParcelTracking(%s) = true; want false", status)
		}
	}
}

func TestUpdateOrderStatus_ShipForwardsOptionalTracking(t *testing.T) {
	repo := statusOrderRepoAt(42, 7, OrderStatusReadyToShip)
	var gotReq UpdateOrderStatusReq
	repo.updateStatusFn = func(_ context.Context, id int64, req UpdateOrderStatusReq) (*Order, error) {
		gotReq = req
		return &Order{
			ID:             id,
			Status:         req.Status,
			TrackingNumber: req.TrackingNumber,
			ParcelCarrier:  req.ParcelCarrier,
		}, nil
	}
	svc := buildOrderServiceWithClawback(repo, &clawbackStub{})

	tn := " RR123456789IR "
	carrier := "Post"
	got, err := svc.UpdateOrderStatus(context.Background(), 7, UpdateOrderStatusReq{
		Status:         OrderStatusShipped,
		TrackingNumber: &tn,
		ParcelCarrier:  &carrier,
	})
	if err != nil {
		t.Fatalf("UpdateOrderStatus err = %v; want nil", err)
	}
	if gotReq.TrackingNumber == nil || *gotReq.TrackingNumber != tn {
		t.Fatalf("repo tracking = %v; want %q", gotReq.TrackingNumber, tn)
	}
	if gotReq.ParcelCarrier == nil || *gotReq.ParcelCarrier != carrier {
		t.Fatalf("repo carrier = %v; want %q", gotReq.ParcelCarrier, carrier)
	}
	if got.TrackingNumber == nil || *got.TrackingNumber != tn {
		t.Fatalf("returned tracking = %v; want %q", got.TrackingNumber, tn)
	}
	if got.ParcelCarrier == nil || *got.ParcelCarrier != carrier {
		t.Fatalf("returned carrier = %v; want %q", got.ParcelCarrier, carrier)
	}
}

func TestUpdateOrderStatus_ShipWithoutTrackingStillWrites(t *testing.T) {
	repo := statusOrderRepoAt(42, 7, OrderStatusReadyToShip)
	svc := buildOrderServiceWithClawback(repo, &clawbackStub{})

	got, err := svc.UpdateOrderStatus(context.Background(), 7, UpdateOrderStatusReq{Status: OrderStatusShipped})
	if err != nil {
		t.Fatalf("UpdateOrderStatus err = %v; want nil", err)
	}
	if got.Status != OrderStatusShipped {
		t.Fatalf("status = %s; want shipped", got.Status)
	}
	if got.TrackingNumber != nil || got.ParcelCarrier != nil {
		t.Fatalf("tracking must stay optional; got %v / %v", got.TrackingNumber, got.ParcelCarrier)
	}
}

func TestToOrderResponse_IncludesParcelTracking(t *testing.T) {
	tn := "RR123456789IR"
	carrier := "Tipax"
	resp := ToOrderResponse(&Order{
		ID:             7,
		Status:         OrderStatusShipped,
		TrackingNumber: &tn,
		ParcelCarrier:  &carrier,
	}, nil)
	if resp.TrackingNumber == nil || *resp.TrackingNumber != tn {
		t.Fatalf("tracking = %v; want %q", resp.TrackingNumber, tn)
	}
	if resp.ParcelCarrier == nil || *resp.ParcelCarrier != carrier {
		t.Fatalf("carrier = %v; want %q", resp.ParcelCarrier, carrier)
	}

	item := ToOrderListItem(&Order{
		ID:             7,
		Status:         OrderStatusShipped,
		TrackingNumber: &tn,
		ParcelCarrier:  &carrier,
	}, 3)
	if item.ItemCount != 3 {
		t.Fatalf("item_count = %d; want 3", item.ItemCount)
	}
	if item.TrackingNumber == nil || *item.TrackingNumber != tn {
		t.Fatalf("list tracking = %v; want %q", item.TrackingNumber, tn)
	}
}

func TestOptionalTextArg(t *testing.T) {
	if got := optionalTextArg(nil); got != nil {
		t.Fatalf("nil pointer = %v; want nil", got)
	}
	empty := "  "
	if got := optionalTextArg(&empty); got != nil {
		t.Fatalf("blank = %v; want nil", got)
	}
	raw := "  RR1  "
	got := optionalTextArg(&raw)
	s, ok := got.(string)
	if !ok || s != "RR1" {
		t.Fatalf("trimmed = %#v; want \"RR1\"", got)
	}
}

func TestCreateOrder_SnapshotsShipToAndFulfillment(t *testing.T) {
	tx := &fakeTx{}
	var got CreateOrderReq
	var gotCouponID *int64
	orderRepo := &orderRepoStub{
		tx: tx,
		createFn: func(_ context.Context, _ pgx.Tx, req CreateOrderReq, _ int64, _, _, _, _, _ float64, _ []byte, _ bool, couponID *int64) (*Order, error) {
			got = req
			gotCouponID = couponID
			return &Order{ID: 100, TotalAmount: 59, Status: OrderStatusPending}, nil
		},
	}
	coupon := &coupons.Coupon{
		ID: 8, Code: "WELCOME10", IsActive: true,
		StartsAt:     time.Now().Add(-time.Hour),
		DiscountType: coupons.DiscountTypeFixedAmount, DiscountValue: 5,
	}
	svc := buildOrderService(orderRepo, nonEmptyCart(), &couponRepoStub{coupon: coupon}, nil, &invRepoStub{})

	_, err := svc.CreateOrder(context.Background(), 1, CreateOrderReq{
		ShippingMethodID: 3, AddressID: 9, PaymentMethod: models.PaymentMethodCard,
		CouponCode: strptr("welcome10"),
	})
	if err != nil {
		t.Fatalf("CreateOrder err = %v; want nil", err)
	}
	snap := decodeShipTo(got.shipToJSON)
	if snap == nil {
		t.Fatal("expected ship-to JSON snapshot on create")
	}
	if snap.FullName != "Ada Lovelace" || snap.AddressLine1 != "1 Main St" || snap.City != "Tehran" || snap.Country != "IR" {
		t.Fatalf("ship-to snapshot = %+v", snap)
	}
	if snap.PhoneNumber == nil || *snap.PhoneNumber != "09120000000" {
		t.Fatalf("ship-to phone = %v", snap.PhoneNumber)
	}
	if snap.StateProvince == nil || *snap.StateProvince != "Tehran" || snap.PostalCode != "12345" {
		t.Fatalf("ship-to province/postal = %+v", snap)
	}
	if got.ShippingMethodName != "Standard" {
		t.Fatalf("shipping method name = %q; want Standard", got.ShippingMethodName)
	}
	if got.ShippingMethodCarrier == nil || *got.ShippingMethodCarrier != "Post" {
		t.Fatalf("shipping carrier = %v; want Post", got.ShippingMethodCarrier)
	}
	if got.AppliedCouponCode == nil || *got.AppliedCouponCode != "WELCOME10" {
		t.Fatalf("coupon snapshot = %v; want WELCOME10", got.AppliedCouponCode)
	}
	if gotCouponID == nil || *gotCouponID != 8 {
		t.Fatalf("coupon_id = %v; want 8", gotCouponID)
	}
}

func TestToOrderResponse_IncludesFulfillment(t *testing.T) {
	addrID := int64(12)
	methodID := int64(3)
	couponID := int64(8)
	buyerUUID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	o := &Order{
		ID: 1042, UserID: 7, Status: OrderStatusPending,
		PaymentMethod: models.PaymentMethodGateway,
		AddressID:     &addrID, ShippingMethodID: &methodID, CouponID: &couponID,
		CouponCode:            strptr("WELCOME10"),
		ShippingMethodName:    strptr("Express"),
		ShippingMethodCarrier: strptr("Tipax"),
		ShipTo: encodeShipTo(&addresses.Address{
			FullName: "Ada Lovelace", PhoneNumber: strptr("0912"),
			AddressLine1: "1 Main", AddressLine2: strptr("Apt 2"),
			City: "Tehran", StateProvince: strptr("Tehran"),
			PostalCode: "12345", Country: "IR",
		}),
		Buyer: OrderUserIdentity{
			ID: 7, UserID: buyerUUID, FirstName: strptr("Ada"),
			LastName: strptr("Lovelace"), Email: "ada@example.com", Phone: strptr("0912"),
		},
		PaymentID: 901, TransactionID: "abc123", PaymentURL: "https://pay.example/start?transaction_id=abc123",
		PaymentStatus: string(payments.PaymentStatusPending),
		CreatedAt:     time.Date(2026, 6, 11, 10, 0, 0, 0, time.UTC),
	}

	resp := ToOrderResponse(o, nil)
	if resp.UserID != 7 || resp.AddressID == nil || *resp.AddressID != 12 {
		t.Fatalf("ids user=%d address=%v", resp.UserID, resp.AddressID)
	}
	if resp.User == nil || resp.User.Email != "ada@example.com" || resp.User.UserID != buyerUUID {
		t.Fatalf("user = %+v", resp.User)
	}
	if resp.Address == nil || resp.Address.FullName != "Ada Lovelace" || resp.Address.City != "Tehran" {
		t.Fatalf("address = %+v", resp.Address)
	}
	if resp.ShipTo == nil || resp.ShipTo.AddressLine1 != "1 Main" || resp.ShipTo.PostalCode != "12345" {
		t.Fatalf("ship_to = %+v", resp.ShipTo)
	}
	if resp.ShippingMethod == nil || resp.ShippingMethod.ID != 3 || resp.ShippingMethod.Name != "Express" {
		t.Fatalf("shipping_method = %+v", resp.ShippingMethod)
	}
	if resp.CouponCode == nil || *resp.CouponCode != "WELCOME10" || resp.Coupon == nil || resp.Coupon.ID != 8 {
		t.Fatalf("coupon code=%v summary=%+v", resp.CouponCode, resp.Coupon)
	}
	if resp.Payment == nil || resp.Payment.ID != 901 || resp.Payment.TransactionID != "abc123" || resp.Payment.Status != "pending" {
		t.Fatalf("payment = %+v", resp.Payment)
	}
	if resp.PaymentID != 901 || resp.TransactionID != "abc123" {
		t.Fatal("top-level PR-020f payment fields must stay on the DTO")
	}
}

func TestGetOrder_AttachesPaymentSummary(t *testing.T) {
	oid := int64(100)
	pending := &payments.PaymentTransaction{
		ID: 77, OrderID: &oid, Status: payments.PaymentStatusPending,
		TransactionID: "still-open", PaymentURL: "https://pay.example/start?transaction_id=still-open",
	}
	orderRepo := &orderRepoStub{
		getByIDFn: func(context.Context, int64) (*Order, error) {
			return &Order{
				ID: oid, UserID: 7, Status: OrderStatusPending,
				TotalAmount: 59, PaymentMethod: models.PaymentMethodCard,
			}, nil
		},
	}
	svc, payRepo := buildOrderServiceWired(orderRepo, nonEmptyCart(), &couponRepoStub{}, nil, &invRepoStub{}, nil)
	payRepo.all = []*payments.PaymentTransaction{pending}

	order, err := svc.GetOrder(context.Background(), oid)
	if err != nil {
		t.Fatalf("GetOrder err = %v; want nil", err)
	}
	if order.PaymentID != 77 || order.TransactionID != "still-open" || order.PaymentStatus != "pending" {
		t.Fatalf("payment attach id=%d tx=%q status=%q", order.PaymentID, order.TransactionID, order.PaymentStatus)
	}
	resp := ToOrderResponse(order, nil)
	if resp.Payment == nil || resp.Payment.ID != 77 || resp.Payment.TransactionID != "still-open" || resp.Payment.Status != "pending" {
		t.Fatalf("payment summary = %+v", resp.Payment)
	}
}

func TestCreateOrder_TaxIncludesGiftAddonFee(t *testing.T) {
	const (
		giftFee  = 25.0
		shipping = 9.0
	)
	coupon := &coupons.Coupon{
		ID: 8, Code: "SAVE10", IsActive: true,
		StartsAt:     time.Now().Add(-time.Hour),
		DiscountType: coupons.DiscountTypeFixedAmount, DiscountValue: 10,
	}
	var gotSub, gotDisc, gotShip, gotTax, gotGift float64
	orderRepo := &orderRepoStub{
		tx: &fakeTx{},
		createFn: func(_ context.Context, _ pgx.Tx, _ CreateOrderReq, _ int64, sub, disc, ship, tax, fee float64, _ []byte, _ bool, _ *int64) (*Order, error) {
			gotSub, gotDisc, gotShip, gotTax, gotGift = sub, disc, ship, tax, fee
			return &Order{ID: 100, TotalAmount: sub - disc + ship + tax + fee, Status: OrderStatusPending}, nil
		},
	}
	svc := buildOrderServiceGift(orderRepo, nonEmptyCart(), &couponRepoStub{coupon: coupon}, pricedGiftConfig(giftFee))

	_, err := svc.CreateOrder(context.Background(), 1, CreateOrderReq{
		ShippingMethodID: 1, AddressID: 1, PaymentMethod: models.PaymentMethodCard,
		CouponCode: strptr("SAVE10"), IsGift: true, GiftOptionIDs: []string{"gift_wrap"},
	})
	if err != nil {
		t.Fatalf("CreateOrder err = %v; want nil", err)
	}
	if gotSub != 50 || gotDisc != 10 || gotShip != shipping || gotGift != giftFee {
		t.Fatalf("amounts sub=%v disc=%v ship=%v gift=%v; want 50/10/%v/%v",
			gotSub, gotDisc, gotShip, gotGift, shipping, giftFee)
	}
	wantTax := (gotSub - gotDisc + gotGift) * models.TaxRate
	if gotTax != wantTax {
		t.Fatalf("tax = %v; want %v (post-discount merchandise + gift fee)", gotTax, wantTax)
	}
	// Generated total identity: tax + gift + subtotal − discount + shipping.
	total := gotSub - gotDisc + gotShip + gotTax + gotGift
	if total != wantTax+gotGift+gotSub-gotDisc+gotShip {
		t.Fatalf("total identity broken: %v", total)
	}
	if gotTax == (gotSub-gotDisc)*models.TaxRate {
		t.Fatal("tax must include gift add-on fee, not merchandise-only")
	}
	if gotTax == (gotSub-gotDisc+gotShip+gotGift)*models.TaxRate {
		t.Fatal("tax must not include shipping")
	}
}

func TestCreateOrder_TaxWithoutGiftIsPostDiscountMerchandise(t *testing.T) {
	var gotSub, gotDisc, gotShip, gotTax, gotGift float64
	orderRepo := &orderRepoStub{
		tx: &fakeTx{},
		createFn: func(_ context.Context, _ pgx.Tx, _ CreateOrderReq, _ int64, sub, disc, ship, tax, fee float64, _ []byte, _ bool, _ *int64) (*Order, error) {
			gotSub, gotDisc, gotShip, gotTax, gotGift = sub, disc, ship, tax, fee
			return &Order{ID: 100, TotalAmount: sub - disc + ship + tax + fee, Status: OrderStatusPending}, nil
		},
	}
	svc := buildOrderService(orderRepo, nonEmptyCart(), &couponRepoStub{}, nil, &invRepoStub{})

	_, err := svc.CreateOrder(context.Background(), 1, CreateOrderReq{
		ShippingMethodID: 1, AddressID: 1, PaymentMethod: models.PaymentMethodCard,
	})
	if err != nil {
		t.Fatalf("CreateOrder err = %v; want nil", err)
	}
	if gotGift != 0 {
		t.Fatalf("gift fee = %v; want 0", gotGift)
	}
	wantTax := (gotSub - gotDisc) * models.TaxRate
	if gotTax != wantTax {
		t.Fatalf("tax = %v; want %v", gotTax, wantTax)
	}
	if gotShip != 9 {
		t.Fatalf("shipping = %v; want 9", gotShip)
	}
	if gotTax == (gotSub-gotDisc+gotShip)*models.TaxRate {
		t.Fatal("tax must not include shipping")
	}
}

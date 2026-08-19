// internal/services/order_service.go
package orders

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/tiredbooy/internal/events"
	"github.com/tiredbooy/internal/features/addresses"
	"github.com/tiredbooy/internal/features/cart"
	"github.com/tiredbooy/internal/features/coupons"
	"github.com/tiredbooy/internal/features/inventory"
	"github.com/tiredbooy/internal/features/payments"
	"github.com/tiredbooy/internal/features/shipping"
	"github.com/tiredbooy/internal/features/site_settings"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
	"github.com/tiredbooy/pkg/crypto"
	"github.com/tiredbooy/pkg/metrics"
	"github.com/tiredbooy/pkg/tracing"
	"github.com/tiredbooy/pkg/utils"
)

// defaultCurrency is the settlement currency for new payment transactions until
// multi-currency checkout is introduced.
const defaultCurrency = "IRT"

type Service interface {
	CreateOrder(ctx context.Context, userID int64, req CreateOrderReq) (*Order, error)
	GetOrder(ctx context.Context, id int64) (*Order, error)
	GetUserOrder(ctx context.Context, id int64, userID int64) (*Order, error)
	GetAllOrders(ctx context.Context, filter OrderFilter) ([]OrderListItem, int64, error)
	GetOrderItems(ctx context.Context, orderID int64) ([]OrderItemResponse, error)
	GetOrderStockLines(ctx context.Context, orderID int64) ([]inventory.StockLine, error)
	UpdateOrderStatus(ctx context.Context, id int64, req UpdateOrderStatusReq) (*Order, error)
	RefundOrder(ctx context.Context, id int64) (*Order, error)
	PayOrder(ctx context.Context, id int64, userID int64) (*Order, error)
	CancelOrder(ctx context.Context, id int64, userID int64) error
	AdminCancelOrder(ctx context.Context, id int64) error
}

// shippingAuthorizer prices and validates checkout shipping methods. Implemented
// by shipping.Service so quote preview and order persistence share one policy.
type shippingAuthorizer interface {
	AuthorizeCheckoutMethod(
		ctx context.Context,
		methodID int64,
		regionCode string,
		weightKg, subtotal float64,
	) (*shipping.ShippingMethod, float64, error)
}

// addressLookup loads the buyer's address for region resolution.
type addressLookup interface {
	GetByID(ctx context.Context, id int64, userID int64) (*addresses.Address, error)
}

// giftConfigLookup loads admin modular gift checkout options (site settings).
type giftConfigLookup interface {
	GiftCheckout(ctx context.Context) (site_settings.GiftCheckoutSettings, error)
}

// orderEarnClawback reverses loyalty points granted for a paid order.
// Implemented by *loyalty.Service. Nil means skip (unit tests).
type orderEarnClawback interface {
	ClawbackOrderEarn(ctx context.Context, userID, orderID int64) error
}

// WalletPurchaser debits a wallet inside a caller-owned transaction.
// Implemented by *wallet.Service.PurchaseTx. Admin refund type-asserts this
// value to WalletRefunder (*wallet.Service.Refund) — do not edit wallet.
type WalletPurchaser interface {
	PurchaseTx(ctx context.Context, tx pgx.Tx, userID int64, amount float64, orderID int64) error
}

// walletBalanceReader is an optional cheap peek on WalletPurchaser.
type walletBalanceReader interface {
	AvailableBalance(ctx context.Context, userID int64) (float64, error)
}

type orderService struct {
	orderRepo       Repository
	orderItemRepo   ItemRepository
	cartRepo        cart.Repository
	couponRepo      coupons.Repository
	couponUsageRepo coupons.UsageRepository
	shipping        shippingAuthorizer
	addresses       addressLookup
	inventory       inventory.Service
	payment         *payments.Service
	giftConfig      giftConfigLookup
	clawback        orderEarnClawback
	wallet          WalletPurchaser
	// events writes order.paid.v1 on the wallet-settle transaction.
	events OrderPaidEmitter
}

// OrderPaidEmitter writes the order.paid fact on the caller's transaction.
// Implemented by events.Emitter. Nil keeps the legacy behaviour.
type OrderPaidEmitter interface {
	OrderPaidTx(ctx context.Context, tx pgx.Tx, data events.OrderPaidData) error
	Enabled() bool
}

// AttachEventPublisher wires the domain-fact emitter onto a service built by
// NewService.
//
// A setter rather than a 13th constructor parameter or a new method on the
// Service interface: both of those would ripple through every existing caller
// and through the compile-time interface assertions in internal/mocks, for a
// dependency that is optional by design.
func AttachEventPublisher(s Service, e OrderPaidEmitter) {
	if impl, ok := s.(*orderService); ok {
		impl.events = e
	}
}

func NewService(
	orderRepo Repository,
	orderItemRepo ItemRepository,
	cartRepo cart.Repository,
	couponRepo coupons.Repository,
	couponUsageRepo coupons.UsageRepository,
	shipping shippingAuthorizer,
	addresses addressLookup,
	inventory inventory.Service,
	payment *payments.Service,
	giftConfig giftConfigLookup,
	clawback orderEarnClawback,
	wallet WalletPurchaser,
) Service {
	return &orderService{
		orderRepo:       orderRepo,
		orderItemRepo:   orderItemRepo,
		cartRepo:        cartRepo,
		couponRepo:      couponRepo,
		couponUsageRepo: couponUsageRepo,
		shipping:        shipping,
		addresses:       addresses,
		inventory:       inventory,
		payment:         payment,
		giftConfig:      giftConfig,
		clawback:        clawback,
		wallet:          wallet,
	}
}

// ── CreateOrder ──────────────────────────────────────────────────────────────

func (s *orderService) CreateOrder(ctx context.Context, userID int64, req CreateOrderReq) (order *Order, err error) {
	start := time.Now()
	ctx, endSpan := tracing.Start(ctx, "orders.CreateOrder", tracing.Int64("user.id", userID))
	defer func() {
		metrics.ObserveOrderCreate(time.Since(start))
		if err != nil {
			metrics.IncOrderCreate(metrics.ResultError)
		} else {
			metrics.IncOrderCreate(metrics.ResultOK)
		}
		endSpan(err)
	}()

	// Resolve the user's cart first — cart_items are keyed by cart_id, not
	// user_id, so we must translate through the carts table.
	cart, err := s.cartRepo.GetOrCreate(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("orderService.CreateOrder: resolve cart: %w", err)
	}

	cartItems, err := s.cartRepo.GetItems(ctx, cart.ID)
	if err != nil {
		return nil, fmt.Errorf("orderService.CreateOrder: fetch cart: %w", err)
	}
	if len(cartItems) == 0 {
		return nil, models.ErrCartEmpty
	}

	var subtotal float64
	var packageWeightKg float64
	for _, item := range cartItems {
		subtotal += item.UnitPriceSnapshot * float64(item.Quantity)
		unitWeight := 0.0
		if item.WeightKg != nil && *item.WeightKg > 0 {
			unitWeight = *item.WeightKg
		}
		packageWeightKg += unitWeight * float64(item.Quantity)
	}

	// Region comes from the selected address country (ISO-style region codes on
	// shipping zones). The client cannot override it.
	address, err := s.addresses.GetByID(ctx, req.AddressID, userID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("orderService.CreateOrder: fetch address: %w", err)
	}
	regionCode := strings.ToUpper(strings.TrimSpace(address.Country))
	if regionCode == "" {
		return nil, models.ErrInvalidShippingMethod
	}
	req.shipToJSON = encodeShipTo(address)

	shippingMethod, shippingCost, err := s.shipping.AuthorizeCheckoutMethod(
		ctx, req.ShippingMethodID, regionCode, packageWeightKg, subtotal,
	)
	if err != nil {
		if errors.Is(err, models.ErrInvalidShippingMethod) || errors.Is(err, models.ErrNotFound) {
			return nil, models.ErrInvalidShippingMethod
		}
		return nil, fmt.Errorf("orderService.CreateOrder: authorize shipping: %w", err)
	}
	req.ShippingMethodName = shippingMethod.Name
	req.ShippingMethodCarrier = shippingMethod.Carrier

	var (
		discountAmount float64
		couponID       *int64
		appliedCoupon  *coupons.Coupon
		freeShipping   bool
	)
	if req.CouponCode != nil {
		// Pre-flight without a lock so obvious failures fail fast before a tx.
		coupon, discount, err := s.validateAndComputeDiscount(ctx, *req.CouponCode, userID, subtotal, cartItems)
		if err != nil {
			return nil, err
		}
		discountAmount = discount
		couponID = &coupon.ID
		appliedCoupon = coupon

		// Free shipping coupon zeroes the shipping cost
		if coupon.DiscountType == coupons.DiscountTypeFreeShipping {
			shippingCost = 0
			freeShipping = true
		}
	}

	tx, err := s.orderRepo.BeginTx(ctx)
	if err != nil {
		return nil, fmt.Errorf("orderService.CreateOrder: begin tx: %w", err)
	}
	defer utils.RollbackOnErr(ctx, tx, &err)

	// Authoritative coupon re-validation under FOR UPDATE happens before the
	// order row is written so amounts match the locked definition.
	if appliedCoupon != nil {
		locked, err := s.revalidateCouponUnderLock(ctx, tx, appliedCoupon.ID, userID, subtotal, cartItems)
		if err != nil {
			return nil, err
		}
		appliedCoupon = locked
		couponID = &locked.ID
		discountAmount = computeDiscount(locked, subtotal)
		if locked.DiscountType == coupons.DiscountTypeFreeShipping {
			shippingCost = 0
			freeShipping = true
		} else if freeShipping {
			// Definition may have changed away from free shipping under the lock.
			_, shippingCost, err = s.shipping.AuthorizeCheckoutMethod(
				ctx, req.ShippingMethodID, regionCode, packageWeightKg, subtotal,
			)
			if err != nil {
				return nil, models.ErrInvalidShippingMethod
			}
			freeShipping = false
		}
	}

	// Modular gift add-ons (packaging, card, …) — server-priced from site settings.
	// Resolved before tax so the paid add-on is in the tax base (PR-020p).
	var giftFee float64
	var giftWrap bool
	giftAddonsJSON := []byte("[]")
	if req.IsGift {
		cfg := site_settings.DefaultGiftCheckout()
		if s.giftConfig != nil {
			if g, gErr := s.giftConfig.GiftCheckout(ctx); gErr == nil {
				cfg = g
			}
		}
		snaps, fee, wrap, gErr := resolveGiftAddons(cfg, true, req.GiftWrap, req.GiftOptionIDs)
		if gErr != nil {
			return nil, gErr
		}
		giftFee = fee
		giftWrap = wrap
		if raw, jErr := json.Marshal(snaps); jErr == nil {
			giftAddonsJSON = raw
		}
		// When gift messaging disabled by admin, drop message.
		if !cfg.MessageEnabled {
			req.GiftMessage = nil
		}
		if !cfg.HidePriceEnabled {
			req.HidePrice = false
		}
	}

	// TaxRate (0.08) applies to post-discount merchandise plus selected gift
	// add-on fees (IR VAT-style on the paid add-on). Shipping is not taxed.
	taxAmount := (subtotal - discountAmount + giftFee) * models.TaxRate

	if appliedCoupon != nil {
		code := appliedCoupon.Code
		req.AppliedCouponCode = &code
	}

	order, err = s.orderRepo.Create(ctx, tx, req, userID, subtotal, discountAmount, shippingCost, taxAmount, giftFee, giftAddonsJSON, giftWrap, couponID)
	if err != nil {
		return nil, fmt.Errorf("orderService.CreateOrder: create order: %w", err)
	}

	if err = s.orderItemRepo.BulkCreate(ctx, tx, order.ID, cartItems); err != nil {
		return nil, fmt.Errorf("orderService.CreateOrder: bulk create items: %w", err)
	}

	if appliedCoupon != nil {
		if err = s.couponUsageRepo.Record(ctx, tx, appliedCoupon.ID, userID, order.ID, discountAmount); err != nil {
			return nil, fmt.Errorf("orderService.CreateOrder: record coupon usage: %w", err)
		}
	}

	// Reserve stock INSIDE the same transaction as the order + items + coupon
	// usage, so they all commit (or roll back) together. This closes the previous
	// oversell window (order committed, then reserved separately) and means a
	// crash mid-flight leaves nothing behind — no dangling pending order. The
	// reservation list is built from the in-memory cart since the order items are
	// not yet visible outside this uncommitted tx.
	reservation := make([]inventory.StockLine, len(cartItems))
	for i, ci := range cartItems {
		reservation[i] = inventory.StockLine{VariantID: ci.VariantID, Quantity: ci.Quantity}
	}
	if err = s.inventory.ReserveForOrderTx(ctx, tx, order.ID, reservation); err != nil {
		// ErrInsufficientStock (and friends) bubble up for a clean 409; the
		// deferred RollbackOnErr undoes the order entirely — no compensation needed.
		return nil, err
	}

	// Wallet rail settles inside this TX: debit + mark paid + deduct. A shortfall
	// rolls back the reserve so nothing is committed. Non-wallet stays pending
	// and inserts the gateway payment on the same TX (fail-closed).
	if req.PaymentMethod == models.PaymentMethodWallet {
		if err = s.settleWalletInTx(ctx, tx, userID, order, reservation); err != nil {
			return nil, err
		}
		// The wallet rail is a first-class paid rail, so it emits the SAME fact
		// as gateway Confirm. Before this it emitted nothing at all: wallet
		// buyers earned no loyalty points, fired no referral credit and left no
		// recommendation signal.
		//
		// Assigned to the named `err` deliberately — the deferred RollbackOnErr
		// only unwinds when *err is non-nil, so a `:=` here would leave the
		// transaction open.
		if err = s.emitOrderPaid(ctx, tx, userID, order); err != nil {
			return nil, err
		}
		// With the bus off there are no consumers, and the legacy lever is the
		// payment_loyalty_awards row Confirm writes — which the wallet rail never
		// went through. Without this, pulling EVENTS_ENABLED=false stopped wallet
		// buyers earning anything at all (A-11).
		if !s.eventsOwnSideEffects() && s.payment != nil {
			if err = s.payment.InsertEarnIntentTx(ctx, tx, payments.OrderEarnIntent{
				OrderID: order.ID,
				UserID:  userID,
				Amount:  order.TotalAmount,
			}); err != nil {
				return nil, fmt.Errorf("orderService.CreateOrder: earn intent: %w", err)
			}
		}
	} else if err = s.insertPendingPaymentTx(ctx, tx, order, userID, req.PaymentMethod); err != nil {
		return nil, err
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("orderService.CreateOrder: commit: %w", err)
	}

	// ── Post-commit ──────────────────────────────────────────────────────────
	// Order + stock (+ pending payment) are durable. Empty the cart (non-fatal).
	_ = s.clearCart(ctx, cart.ID)
	if req.PaymentMethod == models.PaymentMethodWallet && s.payment != nil {
		// No-op with the bus on; the order.paid.v1 consumers own these.
		s.payment.RunLegacyPaidSideEffects(ctx, userID, order.ID, order.TotalAmount)
	}
	return order, nil
}

// settleWalletInTx debits the wallet, marks the order paid, and deducts the
// reserved lines on the same TX. Cheap balance peek (when available) fails
// before PurchaseTx so a short wallet still rolls the reserve back.
func (s *orderService) settleWalletInTx(
	ctx context.Context,
	tx pgx.Tx,
	userID int64,
	order *Order,
	lines []inventory.StockLine,
) error {
	if s.wallet == nil {
		return apperr.ErrInsufficientFunds
	}
	if reader, ok := s.wallet.(walletBalanceReader); ok {
		bal, berr := reader.AvailableBalance(ctx, userID)
		if berr != nil {
			if errors.Is(berr, apperr.ErrNotFound) || errors.Is(berr, apperr.ErrInsufficientFunds) {
				return apperr.ErrInsufficientFunds
			}
			return berr
		}
		if bal < order.TotalAmount {
			return apperr.ErrInsufficientFunds
		}
	}
	if order.TotalAmount > 0 {
		if err := s.wallet.PurchaseTx(ctx, tx, userID, order.TotalAmount, order.ID); err != nil {
			if errors.Is(err, apperr.ErrNotFound) {
				return apperr.ErrInsufficientFunds
			}
			return err
		}
	}
	if err := s.orderRepo.MarkAsPaid(ctx, tx, order.ID); err != nil {
		return fmt.Errorf("orderService.CreateOrder: mark paid: %w", err)
	}
	if err := s.inventory.DeductForOrderTx(ctx, tx, order.ID, lines); err != nil {
		return err
	}
	order.Status = OrderStatusPaid
	now := time.Now()
	order.PaidAt = &now
	return nil
}

// IsOrderStillPaid reports whether the order is currently in a paid-like state.
//
// Used by the order.paid loyalty consumer. Awarding is asynchronous now, so a
// refund can overtake it: the clawback runs before any points exist, finds
// nothing to reverse, and the award then lands on an order that was already
// refunded. Re-reading the status at award time closes that window.
func (s *orderService) IsOrderStillPaid(ctx context.Context, orderID int64) (bool, error) {
	order, err := s.orderRepo.GetByID(ctx, orderID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return false, nil
		}
		return false, err
	}
	return isRefundableStatus(order.Status), nil
}

// emitOrderPaid writes the order.paid fact for a wallet checkout, on the same
// transaction that debited the wallet and marked the order paid.
func (s *orderService) emitOrderPaid(ctx context.Context, tx pgx.Tx, userID int64, order *Order) error {
	if s.events == nil {
		return nil
	}
	return s.events.OrderPaidTx(ctx, tx, events.OrderPaidData{
		OrderID: order.ID,
		UserID:  userID,
		Amount:  order.TotalAmount,
		Rail:    "wallet",
		PaidAt:  time.Now().UTC(),
	})
}

// eventsOwnSideEffects reports whether order.paid consumers own the receipt.
func (s *orderService) eventsOwnSideEffects() bool {
	return s != nil && s.events != nil && s.events.Enabled()
}

// clearCart empties a cart in its own short transaction.
func (s *orderService) clearCart(ctx context.Context, cartID int64) (err error) {
	tx, err := s.orderRepo.BeginTx(ctx)
	if err != nil {
		return err
	}
	defer utils.RollbackOnErr(ctx, tx, &err)

	if err = s.cartRepo.Clear(ctx, tx, cartID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func applyPaymentIntent(order *Order, pt *payments.PaymentTransaction) {
	if order == nil || pt == nil {
		return
	}
	order.PaymentID = pt.ID
	order.TransactionID = pt.TransactionID
	order.PaymentURL = pt.PaymentURL
	order.PaymentStatus = string(pt.Status)
}

// insertPendingPaymentTx records a pending payment on the order create TX.
// Fail-closed: a missing payment row must not leave reserved stock unpaid.
func (s *orderService) insertPendingPaymentTx(
	ctx context.Context,
	tx pgx.Tx,
	order *Order,
	userID int64,
	method models.PaymentMethod,
) error {
	pt, err := s.createPendingIntent(ctx, tx, order, userID, method)
	if err != nil {
		return err
	}
	applyPaymentIntent(order, pt)
	return nil
}

var errWalletPayNotSupported = apperr.New(
	"INVALID_STATE",
	"wallet orders settle at checkout and cannot start a gateway payment",
)

func isPayableStatus(s OrderStatus) bool {
	return s == OrderStatusPending || s == OrderStatusPaymentFailed
}

// PayOrder starts (or returns) a pending gateway intent for the owner.
// Existing pending is returned as-is. A failed / missing intent creates a new
// one. Paid-like and wallet-settled orders are refused.
func (s *orderService) PayOrder(ctx context.Context, id int64, userID int64) (*Order, error) {
	order, err := s.orderRepo.GetByIDAndUserID(ctx, id, userID)
	if err != nil {
		return nil, fmt.Errorf("orderService.PayOrder: %w", err)
	}
	if order.PaymentMethod == models.PaymentMethodWallet {
		return nil, errWalletPayNotSupported
	}
	if order.Status == OrderStatusCancelled {
		return nil, apperr.ErrOrderCancelled
	}
	if !isPayableStatus(order.Status) {
		return nil, apperr.ErrOrderAlreadyPaid
	}

	existing, err := s.listOrderPayments(ctx, order.ID)
	if err != nil {
		return nil, err
	}
	for _, pt := range existing {
		if pt.Status == payments.PaymentStatusSucceeded {
			return nil, apperr.ErrOrderAlreadyPaid
		}
	}
	for _, pt := range existing {
		if pt.Status == payments.PaymentStatusPending {
			applyPaymentIntent(order, pt)
			return order, nil
		}
	}

	pt, err := s.createPendingIntent(ctx, nil, order, userID, order.PaymentMethod)
	if err != nil {
		if errors.Is(err, apperr.ErrConflict) {
			if pending, lerr := s.findPendingPayment(ctx, order.ID); lerr == nil && pending != nil {
				applyPaymentIntent(order, pending)
				return order, nil
			}
		}
		return nil, err
	}
	applyPaymentIntent(order, pt)
	return order, nil
}

func (s *orderService) createPendingIntent(
	ctx context.Context,
	tx pgx.Tx,
	order *Order,
	userID int64,
	method models.PaymentMethod,
) (*payments.PaymentTransaction, error) {
	if s.payment == nil {
		return nil, apperr.ErrInternal
	}
	txnID, err := crypto.GenerateSecureToken(16)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	oid := order.ID
	req := payments.CreatePaymentTransactionReq{
		OrderID:       &oid,
		UserID:        userID,
		Amount:        order.TotalAmount,
		Currency:      defaultCurrency,
		PaymentMethod: method,
		TransactionID: txnID,
	}
	if tx != nil {
		return s.payment.CreateTx(ctx, tx, req)
	}
	return s.payment.Create(ctx, req)
}

func (s *orderService) listOrderPayments(ctx context.Context, orderID int64) ([]*payments.PaymentTransaction, error) {
	if s.payment == nil {
		return nil, nil
	}
	filter := payments.PaymentTransactionFilter{OrderID: &orderID}
	filter.Limit = 20
	filter.SortBy = "created_at"
	filter.OrderBy = "DESC"
	pts, _, err := s.payment.GetAll(ctx, filter)
	if err != nil {
		return nil, err
	}
	return pts, nil
}

func (s *orderService) findPendingPayment(ctx context.Context, orderID int64) (*payments.PaymentTransaction, error) {
	pts, err := s.listOrderPayments(ctx, orderID)
	if err != nil {
		return nil, err
	}
	for _, pt := range pts {
		if pt.Status == payments.PaymentStatusPending {
			return pt, nil
		}
	}
	return nil, nil
}

func (s *orderService) attachPaymentIntent(ctx context.Context, order *Order) {
	if order == nil || order.PaymentMethod == models.PaymentMethodWallet {
		return
	}
	pts, err := s.listOrderPayments(ctx, order.ID)
	if err != nil || len(pts) == 0 {
		return
	}
	for _, pt := range pts {
		if pt.Status == payments.PaymentStatusPending {
			applyPaymentIntent(order, pt)
			return
		}
	}
	applyPaymentIntent(order, pts[0])
}

func (s *orderService) validateAndComputeDiscount(
	ctx context.Context,
	code string,
	userID int64,
	subtotal float64,
	cartItems []cart.CartItemResponse,
) (*coupons.Coupon, float64, error) {
	normalized := coupons.NormalizeCouponCode(code)
	if normalized == "" {
		return nil, 0, models.ErrInvalidCoupon
	}
	coupon, err := s.couponRepo.GetByCode(ctx, normalized)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, 0, models.ErrInvalidCoupon
		}
		return nil, 0, fmt.Errorf("orderService: fetch coupon: %w", err)
	}

	if err := assertCouponRedeemable(coupon, subtotal, cartItems); err != nil {
		return nil, 0, err
	}

	// NOTE: usage-limit (MaxUses / MaxUsesPerUser) checks are intentionally NOT
	// done here. They run later under a row lock inside the order transaction
	// to avoid a TOCTOU race.

	discount := computeDiscount(coupon, subtotal)
	return coupon, discount, nil
}

// revalidateCouponUnderLock reloads the coupon under FOR UPDATE, re-checks the
// full redeemability rules (including product/category applicability), and
// enforces usage caps using the locked definition.
func (s *orderService) revalidateCouponUnderLock(
	ctx context.Context,
	tx pgx.Tx,
	couponID int64,
	userID int64,
	subtotal float64,
	cartItems []cart.CartItemResponse,
) (*coupons.Coupon, error) {
	coupon, err := s.couponRepo.GetByIDForUpdate(ctx, tx, couponID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, models.ErrInvalidCoupon
		}
		return nil, fmt.Errorf("orderService: lock coupon: %w", err)
	}
	if err := assertCouponRedeemable(coupon, subtotal, cartItems); err != nil {
		return nil, err
	}
	if coupon.MaxUses != nil {
		used, err := s.couponRepo.CountUsagesTx(ctx, tx, coupon.ID)
		if err != nil {
			return nil, fmt.Errorf("orderService: count coupon usages: %w", err)
		}
		if used >= *coupon.MaxUses {
			return nil, models.ErrCouponUsageLimitReached
		}
	}
	if coupon.MaxUsesPerUser > 0 {
		usedByUser, err := s.couponRepo.CountUsagesByUserTx(ctx, tx, coupon.ID, userID)
		if err != nil {
			return nil, fmt.Errorf("orderService: count coupon usages by user: %w", err)
		}
		if usedByUser >= coupon.MaxUsesPerUser {
			return nil, models.ErrCouponUserLimitReached
		}
	}
	return coupon, nil
}

func assertCouponRedeemable(
	coupon *coupons.Coupon,
	subtotal float64,
	cartItems []cart.CartItemResponse,
) error {
	now := time.Now()
	if !coupon.IsActive || coupon.StartsAt.After(now) {
		return models.ErrCouponNotActive
	}
	if coupon.ExpiresAt != nil && coupon.ExpiresAt.Before(now) {
		return models.ErrCouponExpired
	}
	if subtotal < coupon.MinOrderAmount {
		return models.ErrOrderBelowMinimum
	}

	productIDs := make([]int64, 0, len(cartItems))
	categoryIDs := make([]int64, 0, len(cartItems))
	seenCat := make(map[int64]struct{})
	for _, item := range cartItems {
		if item.ProductID > 0 {
			productIDs = append(productIDs, item.ProductID)
		}
		if item.CategoryID != nil && *item.CategoryID > 0 {
			if _, ok := seenCat[*item.CategoryID]; !ok {
				seenCat[*item.CategoryID] = struct{}{}
				categoryIDs = append(categoryIDs, *item.CategoryID)
			}
		}
	}
	req := coupons.ValidateCouponReq{
		OrderSubtotal: subtotal,
		ProductIDs:    productIDs,
		CategoryIDs:   categoryIDs,
	}
	if !coupons.CouponAppliesToBasket(coupon, req) {
		return models.ErrInvalidCoupon
	}
	return nil
}

func computeDiscount(coupon *coupons.Coupon, subtotal float64) float64 {
	var discount float64

	switch coupon.DiscountType {
	case coupons.DiscountTypeFixedAmount:
		discount = coupon.DiscountValue
	case coupons.DiscountTypePercentage:
		discount = subtotal * (coupon.DiscountValue / 100)
	case coupons.DiscountTypeFreeShipping:
		// Free shipping is handled as a flag at the order level —
		// no subtotal discount, shipping cost is zeroed separately.
		return 0
	}

	if coupon.MaxDiscountAmount != nil && discount > *coupon.MaxDiscountAmount {
		discount = *coupon.MaxDiscountAmount
	}
	if discount > subtotal {
		discount = subtotal
	}
	return discount
}

// ── Read operations ───────────────────────────────────────────────────────────

func (s *orderService) GetOrder(ctx context.Context, id int64) (*Order, error) {
	order, err := s.orderRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("orderService.GetOrder: %w", err)
	}
	s.attachPaymentIntent(ctx, order)
	return order, nil
}

func (s *orderService) GetUserOrder(ctx context.Context, id int64, userID int64) (*Order, error) {
	order, err := s.orderRepo.GetByIDAndUserID(ctx, id, userID)
	if err != nil {
		return nil, fmt.Errorf("orderService.GetUserOrder: %w", err)
	}
	s.attachPaymentIntent(ctx, order)
	return order, nil
}

func (s *orderService) GetAllOrders(ctx context.Context, filter OrderFilter) ([]OrderListItem, int64, error) {
	orders, total, err := s.orderRepo.GetAll(ctx, filter)
	if err != nil {
		return nil, 0, fmt.Errorf("orderService.GetAllOrders: %w", err)
	}
	return orders, total, nil
}

func (s *orderService) GetOrderItems(ctx context.Context, orderID int64) ([]OrderItemResponse, error) {
	items, err := s.orderRepo.GetItems(ctx, orderID)
	if err != nil {
		return nil, fmt.Errorf("orderService.GetOrderItems: %w", err)
	}
	return items, nil
}

// GetOrderStockLines adapts items for inventory release (payments webhook).
func (s *orderService) GetOrderStockLines(ctx context.Context, orderID int64) ([]inventory.StockLine, error) {
	return s.orderRepo.GetStockLines(ctx, orderID)
}

// ── Write operations ──────────────────────────────────────────────────────────

var (
	errUsePayCommand = apperr.New(
		"INVALID_STATE",
		"use payment settlement to mark an order paid",
	)
	errUseCancelEndpoint = apperr.New(
		"INVALID_STATE",
		"use POST /orders/:id/cancel or POST /admin/orders/:id/cancel to cancel an order",
	)
	errInvalidStatusTransition = apperr.New(
		"INVALID_STATE",
		"order status transition is not allowed",
	)
)

func rejectCommandOnlyPatchStatus(status OrderStatus) error {
	switch status {
	case OrderStatusPaid:
		return errUsePayCommand
	case OrderStatusCancelled:
		return errUseCancelEndpoint
	default:
		if isRefundCommandStatus(status) {
			return errUseRefundEndpoint
		}
		return nil
	}
}

func (s *orderService) UpdateOrderStatus(ctx context.Context, id int64, req UpdateOrderStatusReq) (*Order, error) {
	if err := rejectCommandOnlyPatchStatus(req.Status); err != nil {
		return nil, err
	}
	current, err := s.orderRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("orderService.UpdateOrderStatus: %w", err)
	}
	if !canPatchTransition(current.Status, req.Status) {
		return nil, errInvalidStatusTransition
	}
	order, err := s.orderRepo.UpdateStatus(ctx, id, req)
	if err != nil {
		return nil, fmt.Errorf("orderService.UpdateOrderStatus: %w", err)
	}
	return order, nil
}

func (s *orderService) CancelOrder(ctx context.Context, id int64, userID int64) error {
	return s.cancelOrder(ctx, id, userID)
}

func (s *orderService) AdminCancelOrder(ctx context.Context, id int64) error {
	return s.cancelOrder(ctx, id, 0)
}

// cancelOrder CAS-cancels pending|payment_failed, reverses coupon usage, and
// releases reserved stock on one TX. ownerUserID 0 is admin (any owner).
// Release errors are not swallowed — the deferred rollback undoes status + coupon.
func (s *orderService) cancelOrder(ctx context.Context, id, ownerUserID int64) (err error) {
	tx, err := s.orderRepo.BeginTx(ctx)
	if err != nil {
		return fmt.Errorf("orderService.CancelOrder: begin tx: %w", err)
	}
	defer utils.RollbackOnErr(ctx, tx, &err)

	if err = s.orderRepo.CancelTx(ctx, tx, id, ownerUserID); err != nil {
		return err
	}
	if s.couponUsageRepo != nil {
		if err = s.couponUsageRepo.DeleteByOrderTx(ctx, tx, id); err != nil {
			return fmt.Errorf("orderService.CancelOrder: coupon reverse: %w", err)
		}
	}
	lines, err := s.orderRepo.GetStockLines(ctx, id)
	if err != nil {
		return fmt.Errorf("orderService.CancelOrder: load lines: %w", err)
	}
	if s.inventory != nil && len(lines) > 0 {
		if err = s.inventory.ReleaseForOrderTx(ctx, tx, id, lines); err != nil {
			return fmt.Errorf("orderService.CancelOrder: release: %w", err)
		}
	}
	if err = tx.Commit(ctx); err != nil {
		return fmt.Errorf("orderService.CancelOrder: commit: %w", err)
	}
	return nil
}

// MarkOrderAsPaid was deleted (A-11): an unrouted third paid path that marked the
// order paid with no payment row, no stock deduction and no order.paid.v1 fact.
// order.paid.v1 is the only paid signal — the gateway rail emits it in
// payments.Confirm, the wallet rail in settleWalletInTx. Do not add a third.

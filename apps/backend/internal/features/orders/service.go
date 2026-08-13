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
	"github.com/tiredbooy/internal/features/addresses"
	"github.com/tiredbooy/internal/features/cart"
	"github.com/tiredbooy/internal/features/coupons"
	"github.com/tiredbooy/internal/features/inventory"
	"github.com/tiredbooy/internal/features/payments"
	"github.com/tiredbooy/internal/features/shipping"
	"github.com/tiredbooy/internal/features/site_settings"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/crypto"
	"github.com/tiredbooy/pkg/metrics"
	"github.com/tiredbooy/pkg/tracing"
	"github.com/tiredbooy/pkg/utils"
)

// defaultCurrency is the settlement currency for new payment transactions until
// multi-currency checkout is introduced.
const defaultCurrency = "USD"

type Service interface {
	CreateOrder(ctx context.Context, userID int64, req CreateOrderReq) (*Order, error)
	GetOrder(ctx context.Context, id int64) (*Order, error)
	GetUserOrder(ctx context.Context, id int64, userID int64) (*Order, error)
	GetAllOrders(ctx context.Context, filter OrderFilter) ([]OrderListItem, int64, error)
	GetOrderItems(ctx context.Context, orderID int64) ([]OrderItemResponse, error)
	GetOrderStockLines(ctx context.Context, orderID int64) ([]inventory.StockLine, error)
	UpdateOrderStatus(ctx context.Context, id int64, req UpdateOrderStatusReq) (*Order, error)
	CancelOrder(ctx context.Context, id int64, userID int64) error
	MarkOrderAsPaid(ctx context.Context, orderID int64) error
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

	shippingMethod, shippingCost, err := s.shipping.AuthorizeCheckoutMethod(
		ctx, req.ShippingMethodID, regionCode, packageWeightKg, subtotal,
	)
	if err != nil {
		if errors.Is(err, models.ErrInvalidShippingMethod) || errors.Is(err, models.ErrNotFound) {
			return nil, models.ErrInvalidShippingMethod
		}
		return nil, fmt.Errorf("orderService.CreateOrder: authorize shipping: %w", err)
	}
	_ = shippingMethod

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

	taxAmount := (subtotal - discountAmount) * models.TaxRate

	// Modular gift add-ons (packaging, card, …) — server-priced from site settings.
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

	if err = tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("orderService.CreateOrder: commit: %w", err)
	}

	// ── Post-commit ──────────────────────────────────────────────────────────
	// Order + stock are durable. Empty the cart (non-fatal on error — a stale
	// cart is recoverable) and open a pending payment for the gateway/webhook.
	_ = s.clearCart(ctx, cart.ID)
	s.createPendingPayment(ctx, order, userID, req.PaymentMethod)

	return order, nil
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

// createPendingPayment records a pending payment transaction for an order. It is
// best-effort: the gateway flow is the source of truth for payment state, so a
// failure here doesn't fail order creation.
func (s *orderService) createPendingPayment(ctx context.Context, order *Order, userID int64, method models.PaymentMethod) {
	txnID, err := crypto.GenerateSecureToken(16)
	if err != nil {
		return
	}
	oid := order.ID
	_, _ = s.payment.Create(ctx, payments.CreatePaymentTransactionReq{
		OrderID:       &oid,
		UserID:        userID,
		Amount:        order.TotalAmount,
		Currency:      defaultCurrency,
		PaymentMethod: method,
		TransactionID: txnID,
	})
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
	return order, nil
}

func (s *orderService) GetUserOrder(ctx context.Context, id int64, userID int64) (*Order, error) {
	order, err := s.orderRepo.GetByIDAndUserID(ctx, id, userID)
	if err != nil {
		return nil, fmt.Errorf("orderService.GetUserOrder: %w", err)
	}
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

func (s *orderService) UpdateOrderStatus(ctx context.Context, id int64, req UpdateOrderStatusReq) (*Order, error) {
	order, err := s.orderRepo.UpdateStatus(ctx, id, req)
	if err != nil {
		return nil, fmt.Errorf("orderService.UpdateOrderStatus: %w", err)
	}
	return order, nil
}

func (s *orderService) CancelOrder(ctx context.Context, id int64, userID int64) error {
	// Capture the lines before cancelling so we can release their reserved stock.
	items, err := s.orderRepo.GetItems(ctx, id)
	if err != nil {
		return fmt.Errorf("orderService.CancelOrder: load items: %w", err)
	}

	// Cancel only succeeds for orders in a pre-fulfilment state, which is exactly
	// when stock is reserved-but-not-deducted — so releasing it afterwards is
	// always the correct compensating action.
	if err := s.orderRepo.Cancel(ctx, id, userID); err != nil {
		return fmt.Errorf("orderService.CancelOrder: %w", err)
	}

	if len(items) > 0 {
		lines := make([]inventory.StockLine, len(items))
		for i, item := range items {
			lines[i] = inventory.StockLine{VariantID: item.VariantID, Quantity: item.Quantity}
		}
		_ = s.inventory.ReleaseForOrder(ctx, id, lines)
	}
	return nil
}

func (s *orderService) MarkOrderAsPaid(ctx context.Context, orderID int64) error {
	tx, err := s.orderRepo.BeginTx(ctx)
	if err != nil {
		return fmt.Errorf("orderService.MarkOrderAsPaid: begin tx: %w", err)
	}
	defer utils.RollbackOnErr(ctx, tx, &err)

	if err = s.orderRepo.MarkAsPaid(ctx, tx, orderID); err != nil {
		return fmt.Errorf("orderService.MarkOrderAsPaid: %w", err)
	}

	if err = tx.Commit(ctx); err != nil {
		return fmt.Errorf("orderService.MarkOrderAsPaid: commit: %w", err)
	}
	return nil
}

// internal/services/order_service.go
package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/crypto"
	"github.com/tiredbooy/pkg/utils"
)

// defaultCurrency is the settlement currency for new payment transactions until
// multi-currency checkout is introduced.
const defaultCurrency = "USD"

type OrderService interface {
	CreateOrder(ctx context.Context, userID int64, req models.CreateOrderReq) (*models.Order, error)
	GetOrder(ctx context.Context, id int64) (*models.Order, error)
	GetUserOrder(ctx context.Context, id int64, userID int64) (*models.Order, error)
	GetAllOrders(ctx context.Context, filter models.OrderFilter) ([]*models.Order, int64, error)
	GetOrderItems(ctx context.Context, orderID int64) ([]models.OrderItemResponse, error)
	UpdateOrderStatus(ctx context.Context, id int64, req models.UpdateOrderStatusReq) (*models.Order, error)
	CancelOrder(ctx context.Context, id int64, userID int64) error
	MarkOrderAsPaid(ctx context.Context, orderID int64) error
}

type orderService struct {
	orderRepo       repositories.OrderRepository
	orderItemRepo   repositories.OrderItemRepository
	cartRepo        repositories.CartRepository
	couponRepo      repositories.CouponRepository
	couponUsageRepo repositories.CouponUsageRepository
	shippingRepo    repositories.ShippingMethodRepository
	inventory       InventoryService
	payment         *PaymentService
}

func NewOrderService(
	orderRepo repositories.OrderRepository,
	orderItemRepo repositories.OrderItemRepository,
	cartRepo repositories.CartRepository,
	couponRepo repositories.CouponRepository,
	couponUsageRepo repositories.CouponUsageRepository,
	shippingRepo repositories.ShippingMethodRepository,
	inventory InventoryService,
	payment *PaymentService,
) OrderService {
	return &orderService{
		orderRepo:       orderRepo,
		orderItemRepo:   orderItemRepo,
		cartRepo:        cartRepo,
		couponRepo:      couponRepo,
		couponUsageRepo: couponUsageRepo,
		shippingRepo:    shippingRepo,
		inventory:       inventory,
		payment:         payment,
	}
}

// ── CreateOrder ──────────────────────────────────────────────────────────────

func (s *orderService) CreateOrder(ctx context.Context, userID int64, req models.CreateOrderReq) (*models.Order, error) {
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
	for _, item := range cartItems {
		subtotal += item.UnitPriceSnapshot * float64(item.Quantity)
	}

	shippingMethod, err := s.shippingRepo.GetByID(ctx, req.ShippingMethodID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, models.ErrInvalidShippingMethod
		}
		return nil, fmt.Errorf("orderService.CreateOrder: fetch shipping: %w", err)
	}
	shippingCost := shippingMethod.BaseRate // ← correct field

	var (
		discountAmount float64
		couponID       *int64
		appliedCoupon  *models.Coupon
	)
	if req.CouponCode != nil {
		coupon, discount, err := s.validateAndComputeDiscount(ctx, *req.CouponCode, userID, subtotal)
		if err != nil {
			return nil, err
		}
		discountAmount = discount
		couponID = &coupon.ID
		appliedCoupon = coupon

		// Free shipping coupon zeroes the shipping cost
		if coupon.DiscountType == models.DiscountTypeFreeShipping {
			shippingCost = 0
		}
	}

	taxAmount := (subtotal - discountAmount) * models.TaxRate

	tx, err := s.orderRepo.BeginTx(ctx)
	if err != nil {
		return nil, fmt.Errorf("orderService.CreateOrder: begin tx: %w", err)
	}
	defer utils.RollbackOnErr(ctx, tx, &err)

	order, err := s.orderRepo.Create(ctx, tx, req, userID, subtotal, discountAmount, shippingCost, taxAmount, couponID)
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

	if err = tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("orderService.CreateOrder: commit: %w", err)
	}

	// ── Post-commit saga ─────────────────────────────────────────────────────
	// The order now exists in 'pending'. Reserve stock; if any line is short,
	// compensate by cancelling the order. The cart is intentionally left intact
	// until reservation succeeds, so a stock failure never loses the basket.
	items, err := s.orderRepo.GetItems(ctx, order.ID)
	if err != nil {
		return nil, fmt.Errorf("orderService.CreateOrder: load items: %w", err)
	}

	if err = s.inventory.ReserveForOrder(ctx, order.ID, items); err != nil {
		// Compensating action — best-effort cancel so we never leave a dangling
		// pending order holding no stock. The reservation error (e.g.
		// ErrInsufficientStock) bubbles up for a clean 409.
		_ = s.orderRepo.Cancel(ctx, order.ID, userID)
		return nil, err
	}

	// Stock is now committed — safe to empty the cart. A failure here is
	// non-fatal: the order is placed, and a stale cart is recoverable.
	_ = s.clearCart(ctx, cart.ID)

	// Open a pending payment record for the gateway/webhook to later confirm.
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
func (s *orderService) createPendingPayment(ctx context.Context, order *models.Order, userID int64, method models.PaymentMethod) {
	txnID, err := crypto.GenerateSecureToken(16)
	if err != nil {
		return
	}
	_, _ = s.payment.Create(ctx, models.CreatePaymentTransactionReq{
		OrderID:       order.ID,
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
) (*models.Coupon, float64, error) {
	coupon, err := s.couponRepo.GetByCode(ctx, code)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, 0, models.ErrInvalidCoupon
		}
		return nil, 0, fmt.Errorf("orderService: fetch coupon: %w", err)
	}

	now := time.Now()
	if !coupon.IsActive || coupon.StartsAt.After(now) {
		return nil, 0, models.ErrCouponNotActive
	}
	if coupon.ExpiresAt != nil && coupon.ExpiresAt.Before(now) {
		return nil, 0, models.ErrCouponExpired
	}

	// MinOrderAmount is a plain float64, not a pointer
	if subtotal < coupon.MinOrderAmount {
		return nil, 0, models.ErrOrderBelowMinimum
	}

	if coupon.MaxUses != nil {
		used, err := s.couponRepo.CountUsages(ctx, coupon.ID)
		if err != nil {
			return nil, 0, fmt.Errorf("orderService: count coupon usages: %w", err)
		}
		if used >= *coupon.MaxUses {
			return nil, 0, models.ErrCouponUsageLimitReached
		}
	}

	// MaxUsesPerUser is a plain int, not a pointer
	if coupon.MaxUsesPerUser > 0 {
		usedByUser, err := s.couponRepo.CountUsagesByUser(ctx, coupon.ID, userID)
		if err != nil {
			return nil, 0, fmt.Errorf("orderService: count coupon usages by user: %w", err)
		}
		if usedByUser >= coupon.MaxUsesPerUser {
			return nil, 0, models.ErrCouponUserLimitReached
		}
	}

	discount := computeDiscount(coupon, subtotal)
	return coupon, discount, nil
}

func computeDiscount(coupon *models.Coupon, subtotal float64) float64 {
	var discount float64

	switch coupon.DiscountType {
	case models.DiscountTypeFixedAmount:
		discount = coupon.DiscountValue
	case models.DiscountTypePercentage:
		discount = subtotal * (coupon.DiscountValue / 100)
	case models.DiscountTypeFreeShipping:
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

func (s *orderService) GetOrder(ctx context.Context, id int64) (*models.Order, error) {
	order, err := s.orderRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("orderService.GetOrder: %w", err)
	}
	return order, nil
}

func (s *orderService) GetUserOrder(ctx context.Context, id int64, userID int64) (*models.Order, error) {
	order, err := s.orderRepo.GetByIDAndUserID(ctx, id, userID)
	if err != nil {
		return nil, fmt.Errorf("orderService.GetUserOrder: %w", err)
	}
	return order, nil
}

func (s *orderService) GetAllOrders(ctx context.Context, filter models.OrderFilter) ([]*models.Order, int64, error) {
	orders, total, err := s.orderRepo.GetAll(ctx, filter)
	if err != nil {
		return nil, 0, fmt.Errorf("orderService.GetAllOrders: %w", err)
	}
	return orders, total, nil
}

func (s *orderService) GetOrderItems(ctx context.Context, orderID int64) ([]models.OrderItemResponse, error) {
	items, err := s.orderRepo.GetItems(ctx, orderID)
	if err != nil {
		return nil, fmt.Errorf("orderService.GetOrderItems: %w", err)
	}
	return items, nil
}

// ── Write operations ──────────────────────────────────────────────────────────

func (s *orderService) UpdateOrderStatus(ctx context.Context, id int64, req models.UpdateOrderStatusReq) (*models.Order, error) {
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
		_ = s.inventory.ReleaseForOrder(ctx, id, items)
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

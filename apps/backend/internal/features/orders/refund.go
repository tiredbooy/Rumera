package orders

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/tiredbooy/internal/features/inventory"
	"github.com/tiredbooy/internal/features/wallet"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

// WalletRefunder credits a wallet for an order refund.
// Implemented by *wallet.Service.Refund. Orders type-asserts WalletPurchaser.
type WalletRefunder interface {
	Refund(ctx context.Context, userID int64, amount float64, orderID int64) (*wallet.Transaction, error)
}

var (
	errUseRefundEndpoint = apperr.New(
		"INVALID_STATE",
		"use POST /admin/orders/:id/refund to refund an order",
	)
	errAlreadyRefunded = apperr.New(
		"CONFLICT",
		"order is already refunded",
	)
	errOrderNotRefundable = apperr.New(
		"INVALID_STATE",
		"order is not in a refundable state",
	)
	errWalletRefundUnavailable = apperr.New(
		"INVALID_STATE",
		"wallet refund is unavailable",
	)
)

func isRefundCommandStatus(s OrderStatus) bool {
	switch s {
	case OrderStatusRefunded, OrderStatusPartiallyRefunded,
		OrderStatusRefundApproved, OrderStatusRefundRequested:
		return true
	default:
		return false
	}
}

func isRefundableStatus(s OrderStatus) bool {
	switch s {
	case OrderStatusPaid, OrderStatusProcessing, OrderStatusReadyToShip,
		OrderStatusShipped, OrderStatusDelivered:
		return true
	default:
		return false
	}
}

// RefundOrder is the admin refund command (PR-020d).
// Ordered fail-closed steps (wallet.Refund and inventory.AdjustStock each own
// their TX — no shared collaborator Tx methods we can join without editing
// those packages): wallet credit (wallet rail only) → restock → clawback →
// status=refunded. Already-refunded is a 409 with no second wallet credit.
// Coupon uses are not restored on refund (unpaid cancel restores them, PR-020j).
// Non-wallet tenders do not call a PSP.
func (s *orderService) RefundOrder(ctx context.Context, id int64) (*Order, error) {
	order, err := s.orderRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("orderService.RefundOrder: %w", err)
	}
	if order.Status == OrderStatusRefunded {
		return nil, errAlreadyRefunded
	}
	if !isRefundableStatus(order.Status) {
		return nil, errOrderNotRefundable
	}

	if order.PaymentMethod == models.PaymentMethodWallet && order.TotalAmount > 0 {
		if err := s.creditWalletRefund(ctx, order); err != nil {
			return nil, err
		}
	}

	if err := s.restockRefundLines(ctx, order.ID); err != nil {
		return nil, err
	}

	if s.clawback != nil {
		if err := s.clawback.ClawbackOrderEarn(ctx, order.UserID, order.ID); err != nil {
			slog.Error("orders: clawback earn after refund",
				"order_id", order.ID,
				"user_id", order.UserID,
				"err", err)
			return nil, fmt.Errorf("orderService.RefundOrder: clawback earn: %w", err)
		}
	}

	updated, err := s.orderRepo.UpdateStatus(ctx, id, UpdateOrderStatusReq{Status: OrderStatusRefunded})
	if err != nil {
		return nil, fmt.Errorf("orderService.RefundOrder: set refunded: %w", err)
	}
	return updated, nil
}

func (s *orderService) creditWalletRefund(ctx context.Context, order *Order) error {
	if s.wallet == nil {
		return errWalletRefundUnavailable
	}
	refunder, ok := s.wallet.(WalletRefunder)
	if !ok {
		return errWalletRefundUnavailable
	}
	if _, err := refunder.Refund(ctx, order.UserID, order.TotalAmount, order.ID); err != nil {
		return fmt.Errorf("orderService.RefundOrder: wallet refund: %w", err)
	}
	return nil
}

func (s *orderService) restockRefundLines(ctx context.Context, orderID int64) error {
	lines, err := s.orderRepo.GetStockLines(ctx, orderID)
	if err != nil {
		return fmt.Errorf("orderService.RefundOrder: load stock lines: %w", err)
	}
	note := fmt.Sprintf("admin refund order %d", orderID)
	oid := orderID
	for _, line := range lines {
		if line.Quantity <= 0 || line.VariantID <= 0 {
			continue
		}
		req := inventory.AdjustStockReq{
			Quantity: line.Quantity,
			Type:     inventory.MovementTypeRefund,
			Note:     &note,
		}
		if err := s.inventory.AdjustStock(ctx, line.VariantID, req, &oid); err != nil {
			return fmt.Errorf("orderService.RefundOrder: restock variant %d: %w", line.VariantID, err)
		}
	}
	return nil
}

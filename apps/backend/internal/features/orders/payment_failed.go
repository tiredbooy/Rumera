package orders

import (
	"context"
	"fmt"

	"github.com/tiredbooy/internal/models"
)

// markAsPaymentFailedSQL is pending → payment_failed. Extra method on the
// concrete repo (not the Repository interface) so service.go can keep its
// Service / Repository contracts unchanged.
const markAsPaymentFailedSQL = `
		UPDATE orders
		SET status = 'payment_failed', updated_at = NOW()
		WHERE id = $1
		  AND status = 'pending'`

// MarkAsPaymentFailed is pending → payment_failed. Extra method on the
// concrete repo (not the Repository interface).
func (r *orderRepository) MarkAsPaymentFailed(ctx context.Context, orderID int64) error {
	tag, err := r.db.Exec(ctx, markAsPaymentFailedSQL, orderID)
	if err != nil {
		return fmt.Errorf("orderRepository.MarkAsPaymentFailed: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}

// MarkOrderPaymentFailed flips a pending order after a failed webhook so
// MarkAsPaid (pending-only) cannot settle a late success.
func (s *orderService) MarkOrderPaymentFailed(ctx context.Context, orderID int64) error {
	marker, ok := s.orderRepo.(interface {
		MarkAsPaymentFailed(context.Context, int64) error
	})
	if !ok {
		return fmt.Errorf("orderService.MarkOrderPaymentFailed: repository cannot mark payment_failed")
	}
	if err := marker.MarkAsPaymentFailed(ctx, orderID); err != nil {
		return fmt.Errorf("orderService.MarkOrderPaymentFailed: %w", err)
	}
	return nil
}

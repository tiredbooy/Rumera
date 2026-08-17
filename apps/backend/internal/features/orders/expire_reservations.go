package orders

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/tiredbooy/internal/features/inventory"
)

// ReservationTTL is how long an unpaid pending order may hold committed stock.
// Wallet/bank_transfer often never send a webhook; without a sweeper the
// reservation lives forever. Hardcoded — no CRON_* / TTL env (sibling owns config.go).
const ReservationTTL = 30 * time.Minute

const reservationExpireBatch = 200

// Coupon usage is not reversed here. payment_failed can still pay via PR-020f,
// so burning the usage row would let the code be reused before settle.
// Customer/admin cancel reverses via UsageRepository.DeleteByOrderTx (PR-020j).

const listStalePendingSQL = `
		SELECT id
		FROM orders
		WHERE status = 'pending'
		  AND created_at < $1
		ORDER BY created_at ASC
		LIMIT $2`

// pending → payment_failed (not cancelled): customer may still pay via PR-020f.
// CAS on status=pending so a concurrent MarkAsPaid wins or we do — never both.
const markPaymentFailedIfPendingSQL = `
		UPDATE orders
		SET status = 'payment_failed'
		WHERE id = $1
		  AND status = 'pending'`

const failPendingPaymentsSQL = `
		UPDATE payment_transactions
		SET status        = 'failed',
		    error_message = 'reservation TTL expired'
		WHERE order_id = $1
		  AND status   = 'pending'`

var (
	_ reservationExpireStore = (*orderRepository)(nil)
	_ interface {
		ExpireStaleReservations(context.Context) (int, error)
	} = (*orderService)(nil)
)

// reservationExpireStore is the extra repo surface used by the TTL sweeper.
// Not added to Repository — repository.go is sibling-owned.
type reservationExpireStore interface {
	ListStalePending(ctx context.Context, olderThan time.Time, limit int) ([]int64, error)
	MarkPaymentFailedIfPending(ctx context.Context, id int64) (bool, error)
	FailPendingPayments(ctx context.Context, orderID int64) (int64, error)
	GetStockLines(ctx context.Context, orderID int64) ([]inventory.StockLine, error)
}

func reservationCutoff(now time.Time, ttl time.Duration) time.Time {
	return now.Add(-ttl)
}

func expireStoreOf(repo Repository) reservationExpireStore {
	if repo == nil {
		return nil
	}
	s, _ := repo.(reservationExpireStore)
	return s
}

func (r *orderRepository) ListStalePending(ctx context.Context, olderThan time.Time, limit int) ([]int64, error) {
	if limit <= 0 {
		limit = reservationExpireBatch
	}
	rows, err := r.db.Query(ctx, listStalePendingSQL, olderThan, limit)
	if err != nil {
		return nil, fmt.Errorf("orderRepository.ListStalePending: %w", err)
	}
	defer rows.Close()

	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("orderRepository.ListStalePending scan: %w", err)
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("orderRepository.ListStalePending rows: %w", err)
	}
	return ids, nil
}

func (r *orderRepository) MarkPaymentFailedIfPending(ctx context.Context, id int64) (bool, error) {
	tag, err := r.db.Exec(ctx, markPaymentFailedIfPendingSQL, id)
	if err != nil {
		return false, fmt.Errorf("orderRepository.MarkPaymentFailedIfPending: %w", err)
	}
	return tag.RowsAffected() == 1, nil
}

func (r *orderRepository) FailPendingPayments(ctx context.Context, orderID int64) (int64, error) {
	tag, err := r.db.Exec(ctx, failPendingPaymentsSQL, orderID)
	if err != nil {
		return 0, fmt.Errorf("orderRepository.FailPendingPayments: %w", err)
	}
	return tag.RowsAffected(), nil
}

// ExpireStaleReservations flips unpaid pending orders older than ReservationTTL
// to payment_failed, releases committed stock, and fails dangling pending
// payment_transactions. Coupon usage is kept (customer may still pay via PR-020f).
//
// Not on the Service interface (service.go is sibling-owned). Cron type-asserts
// the concrete *orderService.
func (s *orderService) ExpireStaleReservations(ctx context.Context) (int, error) {
	return s.expireStaleReservationsAt(ctx, time.Now())
}

func (s *orderService) expireStaleReservationsAt(ctx context.Context, now time.Time) (int, error) {
	if s == nil {
		return 0, fmt.Errorf("orders.ExpireStaleReservations: nil service")
	}
	store := expireStoreOf(s.orderRepo)
	if store == nil {
		return 0, fmt.Errorf("orders.ExpireStaleReservations: repo does not support expire")
	}
	if s.inventory == nil {
		return 0, fmt.Errorf("orders.ExpireStaleReservations: inventory not configured")
	}

	stale, err := store.ListStalePending(ctx, reservationCutoff(now, ReservationTTL), reservationExpireBatch)
	if err != nil {
		return 0, err
	}

	expired := 0
	for _, id := range stale {
		if err := ctx.Err(); err != nil {
			return expired, err
		}
		if err := s.expireOne(ctx, store, id); err != nil {
			if errors.Is(err, errAlreadySettled) {
				continue
			}
			slog.Error("orders: expire reservation", "order_id", id, "err", err)
			continue
		}
		expired++
	}
	return expired, nil
}

func (s *orderService) expireOne(ctx context.Context, store reservationExpireStore, id int64) error {
	claimed, err := store.MarkPaymentFailedIfPending(ctx, id)
	if err != nil {
		return err
	}
	if !claimed {
		// Paid, cancelled, or another tick already flipped it — do not release.
		return errAlreadySettled
	}

	lines, err := store.GetStockLines(ctx, id)
	if err != nil {
		slog.Error("orders: expire reservation: stock lines (status already payment_failed; stock may remain committed)",
			"order_id", id, "err", err)
	} else if len(lines) > 0 {
		if err := s.inventory.ReleaseForOrder(ctx, id, lines); err != nil {
			slog.Error("orders: expire reservation: release stock (status already payment_failed; stock may remain committed)",
				"order_id", id, "err", err)
		}
	}

	if _, err := store.FailPendingPayments(ctx, id); err != nil {
		slog.Error("orders: expire reservation: fail payments",
			"order_id", id, "err", err)
	}
	return nil
}

// errAlreadySettled is an internal skip: CAS missed because the order left pending.
var errAlreadySettled = fmt.Errorf("order no longer pending")

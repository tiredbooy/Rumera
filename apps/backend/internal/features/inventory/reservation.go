package inventory

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/tiredbooy/internal/models"
)

const (
	reservationActive   = "active"
	reservationReleased = "released"
	reservationDeducted = "deducted"
)

// activateReservationSQL inserts an active row or reactivates a released one.
// Deducted rows must not match — a paid sale is not a reusable hold.
const activateReservationSQL = `
		INSERT INTO inventory_reservations (
			order_id, product_variant_id, quantity, status
		) VALUES ($1, $2, $3, 'active')
		ON CONFLICT (order_id, product_variant_id) DO UPDATE
		SET quantity   = EXCLUDED.quantity,
		    status     = 'active',
		    updated_at = NOW()
		WHERE inventory_reservations.status = 'released'`

const closeReservationSQL = `
		UPDATE inventory_reservations
		SET status = $4, updated_at = NOW()
		WHERE order_id = $1
		  AND product_variant_id = $2
		  AND quantity = $3
		  AND status = 'active'`

const loadReservationSQL = `
		SELECT status, quantity
		FROM inventory_reservations
		WHERE order_id = $1
		  AND product_variant_id = $2`

// activateReservation inserts or reactivates the per-order reservation row.
// Returns true when this call newly owns the units (caller must increment
// committed_stock). False means the order already has an active row — idempotent
// reserve, do not increment again.
func activateReservation(ctx context.Context, tx pgx.Tx, orderID, variantID int64, quantity int) (bool, error) {
	tag, err := tx.Exec(ctx, activateReservationSQL, orderID, variantID, quantity)
	if err != nil {
		return false, fmt.Errorf("inventory.activateReservation: %w", err)
	}
	if tag.RowsAffected() == 1 {
		return true, nil
	}

	status, qty, err := loadReservation(ctx, tx, orderID, variantID)
	if err != nil {
		return false, err
	}
	if status == reservationActive && qty == quantity {
		return false, nil
	}
	return false, models.ErrInvalidState
}

// closeReservation flips an active row to released or deducted.
// true → caller must move committed_stock. false → already closed or never
// ours (do not touch the global counter).
func closeReservation(ctx context.Context, tx pgx.Tx, orderID, variantID int64, quantity int, next string) (bool, error) {
	tag, err := tx.Exec(ctx, closeReservationSQL, orderID, variantID, quantity, next)
	if err != nil {
		return false, fmt.Errorf("inventory.closeReservation: %w", err)
	}
	return tag.RowsAffected() == 1, nil
}

func loadReservation(ctx context.Context, tx pgx.Tx, orderID, variantID int64) (string, int, error) {
	var status string
	var qty int
	err := tx.QueryRow(ctx, loadReservationSQL, orderID, variantID).Scan(&status, &qty)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", 0, models.ErrNotFound
		}
		return "", 0, fmt.Errorf("inventory.loadReservation: %w", err)
	}
	return status, qty, nil
}

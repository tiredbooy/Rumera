// internal/repositories/order_repository.go
package repositories

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
)

type OrderRepository interface {
	Create(ctx context.Context, tx pgx.Tx, req models.CreateOrderReq, userID int64, subtotal, discountAmount, shippingCost, taxAmount float64, couponID *int64) (*models.Order, error)
	GetByID(ctx context.Context, id int64) (*models.Order, error)
	GetByIDAndUserID(ctx context.Context, id int64, userID int64) (*models.Order, error)
	GetAll(ctx context.Context, filter models.OrderFilter) ([]*models.Order, int64, error)
	UpdateStatus(ctx context.Context, id int64, req models.UpdateOrderStatusReq) (*models.Order, error)
	Cancel(ctx context.Context, id int64, userID int64) error
	GetItems(ctx context.Context, orderID int64) ([]models.OrderItemResponse, error)
	BeginTx(ctx context.Context) (pgx.Tx, error)
	MarkAsPaid(ctx context.Context, tx pgx.Tx, orderID int64) error
}

type orderRepository struct {
	db *pgxpool.Pool
}

func NewOrderRepository(db *pgxpool.Pool) OrderRepository {
	return &orderRepository{db: db}
}

func (r *orderRepository) BeginTx(ctx context.Context) (pgx.Tx, error) {
	return r.db.Begin(ctx)
}

func (r *orderRepository) Create(
	ctx context.Context,
	tx pgx.Tx,
	req models.CreateOrderReq,
	userID int64,
	subtotal, discountAmount, shippingCost, taxAmount float64,
	couponID *int64,
) (*models.Order, error) {
	const q = `
		INSERT INTO orders (
			user_id, address_id, status, payment_method,
			subtotal, discount_amount, shipping_cost, tax_amount,
			coupon_id, shipping_method_id, notes,
			is_gift, gift_message, gift_wrap, hide_price, scheduled_delivery_date
		) VALUES (
			@user_id, @address_id, 'pending', @payment_method,
			@subtotal, @discount_amount, @shipping_cost, @tax_amount,
			@coupon_id, @shipping_method_id, @notes,
			@is_gift, @gift_message, @gift_wrap, @hide_price, @scheduled_delivery_date
		)
		RETURNING *`

	args := pgx.NamedArgs{
		"user_id":            userID,
		"address_id":         req.AddressID,
		"payment_method":     req.PaymentMethod,
		"subtotal":           subtotal,
		"discount_amount":    discountAmount,
		"shipping_cost":      shippingCost,
		"tax_amount":         taxAmount,
		"coupon_id":          couponID,
		"shipping_method_id": req.ShippingMethodID,
		"notes":              req.Notes,

		"is_gift":                 req.IsGift,
		"gift_message":            req.GiftMessage,
		"gift_wrap":               req.GiftWrap,
		"hide_price":              req.HidePrice,
		"scheduled_delivery_date": req.ScheduledDeliveryDate,
	}

	rows, err := tx.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("orderRepository.Create: %w", err)
	}

	order, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.Order])
	if err != nil {
		return nil, fmt.Errorf("orderRepository.Create scan: %w", err)
	}
	return &order, nil
}

func (r *orderRepository) GetByID(ctx context.Context, id int64) (*models.Order, error) {
	const q = `SELECT * FROM orders WHERE id = $1`

	rows, err := r.db.Query(ctx, q, id)
	if err != nil {
		return nil, fmt.Errorf("orderRepository.GetByID: %w", err)
	}

	order, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.Order])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("orderRepository.GetByID scan: %w", err)
	}
	return &order, nil
}

func (r *orderRepository) GetByIDAndUserID(ctx context.Context, id int64, userID int64) (*models.Order, error) {
	const q = `SELECT * FROM orders WHERE id = $1 AND user_id = $2`

	rows, err := r.db.Query(ctx, q, id, userID)
	if err != nil {
		return nil, fmt.Errorf("orderRepository.GetByIDAndUserID: %w", err)
	}

	order, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.Order])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("orderRepository.GetByIDAndUserID scan: %w", err)
	}
	return &order, nil
}

func (r *orderRepository) GetAll(ctx context.Context, f models.OrderFilter) ([]*models.Order, int64, error) {
	where := []string{"1=1"}
	args := pgx.NamedArgs{}

	if f.UserID != nil {
		where = append(where, "user_id = @user_id")
		args["user_id"] = *f.UserID
	}
	if f.Status != nil {
		where = append(where, "status = @status")
		args["status"] = *f.Status
	}
	if f.PaidFrom != nil {
		where = append(where, "paid_at >= @paid_from")
		args["paid_from"] = *f.PaidFrom
	}
	if f.PaidTo != nil {
		where = append(where, "paid_at <= @paid_to")
		args["paid_to"] = *f.PaidTo
	}

	allowed := map[string]bool{
		"created_at":   true,
		"total_amount": true,
		"status":       true,
	}
	sortBy := "created_at"
	if allowed[f.SortBy] {
		sortBy = f.SortBy
	}
	order := "DESC"
	if strings.ToUpper(f.OrderBy) == "ASC" {
		order = "ASC"
	}

	args["limit"] = f.Limit
	args["offset"] = f.Offset()

	q := fmt.Sprintf(`
		SELECT *, COUNT(*) OVER() AS total_count
		FROM orders
		WHERE %s
		ORDER BY %s %s
		LIMIT @limit OFFSET @offset`,
		strings.Join(where, " AND "), sortBy, order,
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, 0, fmt.Errorf("orderRepository.GetAll: %w", err)
	}
	defer rows.Close()

	var (
		orders []*models.Order
		total  int64
	)

	for rows.Next() {
		var o models.Order
		if err := rows.Scan(
			&o.ID, &o.UserID, &o.AddressID,
			&o.Status, &o.PaymentMethod,
			&o.Subtotal, &o.DiscountAmount, &o.ShippingCost,
			&o.TaxAmount, &o.TotalAmount,
			&o.CouponID, &o.ShippingMethodID, &o.Notes,
			&o.PaidAt, &o.ShippedAt, &o.DeliveredAt, &o.CancelledAt,
			&o.CreatedAt, &o.UpdatedAt,
			&total,
		); err != nil {
			return nil, 0, fmt.Errorf("orderRepository.GetAll scan: %w", err)
		}
		orders = append(orders, &o)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("orderRepository.GetAll rows: %w", err)
	}

	return orders, total, nil
}

func (r *orderRepository) UpdateStatus(ctx context.Context, id int64, req models.UpdateOrderStatusReq) (*models.Order, error) {
	sets := []string{"status = @status"}
	args := pgx.NamedArgs{
		"id":     id,
		"status": req.Status,
	}

	switch req.Status {
	case models.OrderStatusPaid:
		sets = append(sets, "paid_at = @paid_at")
		args["paid_at"] = time.Now()
	case models.OrderStatusShipped:
		sets = append(sets, "shipped_at = @shipped_at")
		args["shipped_at"] = time.Now()
	case models.OrderStatusDelivered:
		sets = append(sets, "delivered_at = @delivered_at")
		args["delivered_at"] = time.Now()
	case models.OrderStatusCancelled:
		sets = append(sets, "cancelled_at = @cancelled_at")
		args["cancelled_at"] = time.Now()
	}

	q := fmt.Sprintf(`
		UPDATE orders SET %s
		WHERE id = @id
		RETURNING *`,
		strings.Join(sets, ", "),
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("orderRepository.UpdateStatus: %w", err)
	}

	order, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.Order])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("orderRepository.UpdateStatus scan: %w", err)
	}
	return &order, nil
}

func (r *orderRepository) Cancel(ctx context.Context, id int64, userID int64) error {
	const q = `
		UPDATE orders
		SET status = 'cancelled', cancelled_at = NOW()
		WHERE id = $1
		  AND user_id = $2
		  AND status IN ('pending', 'payment_failed')`

	res, err := r.db.Exec(ctx, q, id, userID)
	if err != nil {
		return fmt.Errorf("orderRepository.Cancel: %w", err)
	}
	if res.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}

func (r *orderRepository) GetItems(ctx context.Context, orderID int64) ([]models.OrderItemResponse, error) {
	const q = `
		SELECT
			oi.id,
			oi.product_id,
			oi.product_variant_id,
			p.title   AS product_title,
			img.image_url,
			oi.quantity,
			oi.unit_price,
			oi.total_price
		FROM order_items oi
		INNER JOIN products p ON p.id = oi.product_id
		LEFT JOIN LATERAL (
			SELECT pi.image_url
			FROM   product_images pi
			WHERE  pi.product_id = p.id
			  AND  pi.is_primary = true
			LIMIT  1
		) img ON TRUE
		WHERE oi.order_id = $1
		ORDER BY oi.id ASC`

	rows, err := r.db.Query(ctx, q, orderID)
	if err != nil {
		return nil, fmt.Errorf("orderRepository.GetItems: %w", err)
	}
	defer rows.Close()

	var items []models.OrderItemResponse
	for rows.Next() {
		var item models.OrderItemResponse
		if err := rows.Scan(
			&item.ID,
			&item.ProductID,
			&item.VariantID, // ← add this
			&item.ProductTitle,
			&item.ImageURL,
			&item.Quantity,
			&item.UnitPrice,
			&item.TotalPrice,
		); err != nil {
			return nil, fmt.Errorf("orderRepository.GetItems scan: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("orderRepository.GetItems rows: %w", err)
	}

	return items, nil
}

func (r *orderRepository) MarkAsPaid(ctx context.Context, tx pgx.Tx, orderID int64) error {
	const q = `
		UPDATE orders
		SET status     = 'paid',
		    updated_at = NOW()
		WHERE id     = $1
		  AND status = 'pending'`

	res, err := tx.Exec(ctx, q, orderID)
	if err != nil {
		return fmt.Errorf("orderRepository.MarkAsPaid: %w", err)
	}
	if res.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}

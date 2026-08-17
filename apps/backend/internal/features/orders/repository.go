// internal/repositories/order_repository.go
package orders

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/features/inventory"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

type Repository interface {
	Create(ctx context.Context, tx pgx.Tx, req CreateOrderReq, userID int64, subtotal, discountAmount, shippingCost, taxAmount, giftAddonsFee float64, giftAddonsJSON []byte, giftWrap bool, couponID *int64) (*Order, error)
	GetByID(ctx context.Context, id int64) (*Order, error)
	GetByIDAndUserID(ctx context.Context, id int64, userID int64) (*Order, error)
	GetAll(ctx context.Context, filter OrderFilter) ([]OrderListItem, int64, error)
	UpdateStatus(ctx context.Context, id int64, req UpdateOrderStatusReq) (*Order, error)
	Cancel(ctx context.Context, id int64, userID int64) error
	// CancelTx CAS-updates pending|payment_failed → cancelled on the caller TX.
	// ownerUserID 0 skips the owner check (admin cancel).
	CancelTx(ctx context.Context, tx pgx.Tx, id int64, ownerUserID int64) error
	GetItems(ctx context.Context, orderID int64) ([]OrderItemResponse, error)
	// GetStockLines returns variant/qty from order_items only (no products join).
	GetStockLines(ctx context.Context, orderID int64) ([]inventory.StockLine, error)
	BeginTx(ctx context.Context) (pgx.Tx, error)
	MarkAsPaid(ctx context.Context, tx pgx.Tx, orderID int64) error
}

type orderRepository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) Repository {
	return &orderRepository{db: db}
}

func (r *orderRepository) BeginTx(ctx context.Context) (pgx.Tx, error) {
	return r.db.Begin(ctx)
}

func (r *orderRepository) Create(
	ctx context.Context,
	tx pgx.Tx,
	req CreateOrderReq,
	userID int64,
	subtotal, discountAmount, shippingCost, taxAmount, giftAddonsFee float64,
	giftAddonsJSON []byte,
	giftWrap bool,
	couponID *int64,
) (*Order, error) {
	if giftAddonsJSON == nil {
		giftAddonsJSON = []byte("[]")
	}
	const q = `
		INSERT INTO orders (
			user_id, address_id, status, payment_method,
			subtotal, discount_amount, shipping_cost, tax_amount, gift_addons_fee,
			coupon_id, coupon_code, shipping_method_id, notes,
			is_gift, gift_message, gift_wrap, hide_price, gift_addons, scheduled_delivery_date,
			ship_to, shipping_method_name, shipping_method_carrier
		) VALUES (
			@user_id, @address_id, 'pending', @payment_method,
			@subtotal, @discount_amount, @shipping_cost, @tax_amount, @gift_addons_fee,
			@coupon_id, @coupon_code, @shipping_method_id, @notes,
			@is_gift, @gift_message, @gift_wrap, @hide_price, @gift_addons, @scheduled_delivery_date,
			@ship_to, @shipping_method_name, @shipping_method_carrier
		)
		RETURNING *`

	methodName := any(nil)
	if req.ShippingMethodName != "" {
		methodName = req.ShippingMethodName
	}
	args := pgx.NamedArgs{
		"user_id":            userID,
		"address_id":         req.AddressID,
		"payment_method":     req.PaymentMethod,
		"subtotal":           subtotal,
		"discount_amount":    discountAmount,
		"shipping_cost":      shippingCost,
		"tax_amount":         taxAmount,
		"gift_addons_fee":    giftAddonsFee,
		"coupon_id":          couponID,
		"coupon_code":        req.AppliedCouponCode,
		"shipping_method_id": req.ShippingMethodID,
		"notes":              req.Notes,

		"is_gift":                 req.IsGift,
		"gift_message":            req.GiftMessage,
		"gift_wrap":               giftWrap,
		"hide_price":              req.HidePrice,
		"gift_addons":             giftAddonsJSON,
		"scheduled_delivery_date": req.ScheduledDeliveryDate,
		"ship_to":                 req.shipToJSON,
		"shipping_method_name":    methodName,
		"shipping_method_carrier": req.ShippingMethodCarrier,
	}

	rows, err := tx.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("orderRepository.Create: %w", err)
	}

	order, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Order])
	if err != nil {
		return nil, fmt.Errorf("orderRepository.Create scan: %w", err)
	}
	r.attachBuyer(ctx, &order)
	return &order, nil
}

func (r *orderRepository) GetByID(ctx context.Context, id int64) (*Order, error) {
	const q = `SELECT * FROM orders WHERE id = $1`

	rows, err := r.db.Query(ctx, q, id)
	if err != nil {
		return nil, fmt.Errorf("orderRepository.GetByID: %w", err)
	}

	order, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Order])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("orderRepository.GetByID scan: %w", err)
	}
	r.attachBuyer(ctx, &order)
	return &order, nil
}

func (r *orderRepository) GetByIDAndUserID(ctx context.Context, id int64, userID int64) (*Order, error) {
	const q = `SELECT * FROM orders WHERE id = $1 AND user_id = $2`

	rows, err := r.db.Query(ctx, q, id, userID)
	if err != nil {
		return nil, fmt.Errorf("orderRepository.GetByIDAndUserID: %w", err)
	}

	order, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Order])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("orderRepository.GetByIDAndUserID scan: %w", err)
	}
	r.attachBuyer(ctx, &order)
	return &order, nil
}

func (r *orderRepository) attachBuyer(ctx context.Context, order *Order) {
	if order == nil || order.UserID == 0 {
		return
	}
	order.Buyer.ID = order.UserID
	const q = `
		SELECT user_id, first_name, last_name, email, phone
		FROM users
		WHERE id = $1`
	var (
		uid                uuid.UUID
		first, last, phone *string
		email              string
	)
	if err := r.db.QueryRow(ctx, q, order.UserID).Scan(&uid, &first, &last, &email, &phone); err != nil {
		return
	}
	order.Buyer.UserID = uid
	order.Buyer.FirstName = first
	order.Buyer.LastName = last
	order.Buyer.Email = email
	order.Buyer.Phone = phone
}

func (r *orderRepository) GetAll(ctx context.Context, f OrderFilter) ([]OrderListItem, int64, error) {
	where := []string{"1=1"}
	args := pgx.NamedArgs{}

	if f.UserID != nil {
		where = append(where, "o.user_id = @user_id")
		args["user_id"] = *f.UserID
	}
	// The public identifier, which is the only customer id the admin UI has.
	if strings.TrimSpace(f.UserUUID) != "" {
		where = append(where, "u.user_id = @user_uuid")
		args["user_uuid"] = strings.TrimSpace(f.UserUUID)
	}
	if f.Status != nil {
		where = append(where, "o.status = @status")
		args["status"] = *f.Status
	}
	// Validated by the handler before we get here; parsing again is cheap and
	// keeps a bad literal out of the enum comparison regardless of caller.
	if statuses, err := f.ValidStatuses(); err == nil && len(statuses) > 0 {
		raw := make([]string, len(statuses))
		for i, s := range statuses {
			raw[i] = string(s)
		}
		where = append(where, "o.status = ANY(@statuses)")
		args["statuses"] = raw
	}
	if f.PaidFrom != nil {
		where = append(where, "o.paid_at >= @paid_from")
		args["paid_from"] = *f.PaidFrom
	}
	if f.PaidTo != nil {
		where = append(where, "o.paid_at <= @paid_to")
		args["paid_to"] = *f.PaidTo
	}

	allowed := map[string]bool{
		"created_at":   true,
		"total_amount": true,
		"status":       true,
	}
	// Qualified with the table alias: users is joined now (CF-1) and also has a
	// created_at, so a bare column here is an ambiguous-reference error at
	// runtime — invisible to the compiler and to every test that does not hit a
	// real database.
	sortBy := "o.created_at"
	if allowed[f.SortBy] {
		sortBy = "o." + f.SortBy
	}
	order := "DESC"
	if strings.ToUpper(f.OrderBy) == "ASC" {
		order = "ASC"
	}

	args["limit"] = f.Limit
	args["offset"] = f.Offset()

	// CF-1. Buyer identity is joined, never fetched per row: attachBuyer costs one
	// extra round trip per order, which is fine for a single detail view and an
	// N+1 across a page. orders.user_id is NOT NULL with ON DELETE RESTRICT, so an
	// inner join can never drop an order.
	//
	// Projected only for the admin list. The customer's own GET /orders shares
	// this repository method and this row struct, and has no use for a buyer
	// block describing itself.
	buyerCols := ""
	if f.includeBuyer {
		buyerCols = `,
			u.user_id AS buyer_uuid, u.first_name AS buyer_first_name,
			u.last_name AS buyer_last_name, u.email AS buyer_email,
			u.phone AS buyer_phone, o.user_id AS buyer_id`
	}
	q := fmt.Sprintf(`
		SELECT o.id, o.status, o.payment_method, o.total_amount,
			COALESCE((
				SELECT SUM(oi.quantity)
				FROM order_items oi
				WHERE oi.order_id = o.id
			), 0)::int AS item_count,
			o.created_at, COUNT(*) OVER() AS total_count%s
		FROM orders o
		JOIN users u ON u.id = o.user_id
		WHERE %s
		ORDER BY %s %s
		LIMIT @limit OFFSET @offset`,
		buyerCols, strings.Join(where, " AND "), sortBy, order,
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, 0, fmt.Errorf("orderRepository.GetAll: %w", err)
	}
	defer rows.Close()

	var (
		orders []OrderListItem
		total  int64
	)

	for rows.Next() {
		var o OrderListItem
		dest := []any{
			&o.ID, &o.Status, &o.PaymentMethod, &o.TotalAmount,
			&o.ItemCount, &o.CreatedAt, &total,
		}
		var buyer OrderUserIdentity
		if f.includeBuyer {
			dest = append(dest,
				&buyer.UserID, &buyer.FirstName, &buyer.LastName,
				&buyer.Email, &buyer.Phone, &buyer.ID,
			)
		}
		if err := rows.Scan(dest...); err != nil {
			return nil, 0, fmt.Errorf("orderRepository.GetAll scan: %w", err)
		}
		if f.includeBuyer {
			b := buyer
			o.Buyer = &b
		}
		orders = append(orders, o)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("orderRepository.GetAll rows: %w", err)
	}

	return orders, total, nil
}

func (r *orderRepository) UpdateStatus(ctx context.Context, id int64, req UpdateOrderStatusReq) (*Order, error) {
	sets := []string{"status = @status"}
	args := pgx.NamedArgs{
		"id":     id,
		"status": req.Status,
	}

	switch req.Status {
	case OrderStatusPaid:
		sets = append(sets, "paid_at = @paid_at")
		args["paid_at"] = time.Now()
	case OrderStatusShipped:
		sets = append(sets, "shipped_at = @shipped_at")
		args["shipped_at"] = time.Now()
	case OrderStatusDelivered:
		sets = append(sets, "delivered_at = @delivered_at")
		args["delivered_at"] = time.Now()
	case OrderStatusCancelled:
		sets = append(sets, "cancelled_at = @cancelled_at")
		args["cancelled_at"] = time.Now()
	}

	if canPersistParcelTracking(req.Status) {
		if req.TrackingNumber != nil {
			sets = append(sets, "tracking_number = @tracking_number")
			args["tracking_number"] = optionalTextArg(req.TrackingNumber)
		}
		if req.ParcelCarrier != nil {
			sets = append(sets, "parcel_carrier = @parcel_carrier")
			args["parcel_carrier"] = optionalTextArg(req.ParcelCarrier)
		}
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

	order, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Order])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("orderRepository.UpdateStatus scan: %w", err)
	}
	return &order, nil
}

func (r *orderRepository) Cancel(ctx context.Context, id int64, userID int64) error {
	return r.cancelExec(ctx, r.db, id, userID)
}

func (r *orderRepository) CancelTx(ctx context.Context, tx pgx.Tx, id int64, ownerUserID int64) error {
	return r.cancelExec(ctx, tx, id, ownerUserID)
}

// cancelDB is Exec+QueryRow shared by *pgxpool.Pool and pgx.Tx.
type cancelDB interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

const cancelOwnedSQL = `
		UPDATE orders
		SET status = 'cancelled', cancelled_at = NOW()
		WHERE id = $1
		  AND user_id = $2
		  AND status IN ('pending', 'payment_failed')`

const cancelAnySQL = `
		UPDATE orders
		SET status = 'cancelled', cancelled_at = NOW()
		WHERE id = $1
		  AND status IN ('pending', 'payment_failed')`

func (r *orderRepository) cancelExec(ctx context.Context, db cancelDB, id, ownerUserID int64) error {
	var (
		tag pgconn.CommandTag
		err error
	)
	if ownerUserID == 0 {
		tag, err = db.Exec(ctx, cancelAnySQL, id)
	} else {
		tag, err = db.Exec(ctx, cancelOwnedSQL, id, ownerUserID)
	}
	if err != nil {
		return fmt.Errorf("orderRepository.Cancel: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return classifyCancelMiss(ctx, db, id, ownerUserID)
	}
	return nil
}

func classifyCancelMiss(ctx context.Context, db cancelDB, id, ownerUserID int64) error {
	var (
		status string
		userID int64
	)
	err := db.QueryRow(ctx, `SELECT status, user_id FROM orders WHERE id = $1`, id).Scan(&status, &userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return models.ErrNotFound
		}
		return fmt.Errorf("orderRepository.Cancel classify: %w", err)
	}
	return cancelMissError(status, userID, ownerUserID)
}

func cancelMissError(status string, rowUserID, ownerUserID int64) error {
	if ownerUserID != 0 && rowUserID != ownerUserID {
		return models.ErrNotFound
	}
	if status == string(OrderStatusCancelled) {
		return apperr.ErrOrderCancelled
	}
	return apperr.ErrOrderAlreadyPaid
}

func (r *orderRepository) GetItems(ctx context.Context, orderID int64) ([]OrderItemResponse, error) {
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

	var items []OrderItemResponse
	for rows.Next() {
		var item OrderItemResponse
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

// getStockLinesSQL reads variant/qty from order_items only. A missing products
// row must not drop the line (webhook deduct/release and cancel).
const getStockLinesSQL = `
		SELECT product_variant_id, quantity
		FROM   order_items
		WHERE  order_id = $1`

func (r *orderRepository) GetStockLines(ctx context.Context, orderID int64) ([]inventory.StockLine, error) {
	rows, err := r.db.Query(ctx, getStockLinesSQL, orderID)
	if err != nil {
		return nil, fmt.Errorf("orderRepository.GetStockLines: %w", err)
	}
	defer rows.Close()

	var lines []inventory.StockLine
	for rows.Next() {
		var line inventory.StockLine
		if err := rows.Scan(&line.VariantID, &line.Quantity); err != nil {
			return nil, fmt.Errorf("orderRepository.GetStockLines scan: %w", err)
		}
		lines = append(lines, line)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("orderRepository.GetStockLines rows: %w", err)
	}
	sortStockLinesByVariantID(lines)
	return lines, nil
}

// sortStockLinesByVariantID is the lock-order used by GetStockLines so
// reserve/release/deduct take inventory row locks in VariantID ascending
// order (avoids 40P01 when two checkouts share variants in opposite order).
func sortStockLinesByVariantID(lines []inventory.StockLine) {
	sort.Slice(lines, func(i, j int) bool {
		return lines[i].VariantID < lines[j].VariantID
	})
}

// optionalTextArg trims a PATCH string pointer. Empty becomes SQL NULL.
func optionalTextArg(p *string) any {
	if p == nil {
		return nil
	}
	s := strings.TrimSpace(*p)
	if s == "" {
		return nil
	}
	return s
}

// markAsPaidSQL is the pending→paid UPDATE. paid_at is stamped once (COALESCE).
const markAsPaidSQL = `
		UPDATE orders
		SET status     = 'paid',
		    paid_at    = COALESCE(paid_at, NOW()),
		    updated_at = NOW()
		WHERE id     = $1
		  AND status = 'pending'`

func (r *orderRepository) MarkAsPaid(ctx context.Context, tx pgx.Tx, orderID int64) error {
	res, err := tx.Exec(ctx, markAsPaidSQL, orderID)
	if err != nil {
		return fmt.Errorf("orderRepository.MarkAsPaid: %w", err)
	}
	if res.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}

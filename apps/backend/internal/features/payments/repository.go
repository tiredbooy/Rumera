package payments

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

type Repository interface {
	Create(ctx context.Context, tx pgx.Tx, req CreatePaymentTransactionReq) (*PaymentTransaction, error)
	GetByID(ctx context.Context, id int64) (*PaymentTransaction, error)
	GetByTransactionID(ctx context.Context, transactionID string) (*PaymentTransaction, error)
	GetAll(ctx context.Context, filter PaymentTransactionFilter) ([]*PaymentTransaction, int64, error)
	Confirm(ctx context.Context, tx pgx.Tx, req ConfirmPaymentReq) (*PaymentTransaction, error)
	Fail(ctx context.Context, req FailPaymentReq) (*PaymentTransaction, error)
	BeginTx(ctx context.Context) (pgx.Tx, error)
}

type paymentTransactionRepository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) Repository {
	return &paymentTransactionRepository{db: db}
}

func (r *paymentTransactionRepository) BeginTx(ctx context.Context) (pgx.Tx, error) {
	return r.db.Begin(ctx)
}

func (r *paymentTransactionRepository) Create(ctx context.Context, tx pgx.Tx, req CreatePaymentTransactionReq) (*PaymentTransaction, error) {
	const q = `
		INSERT INTO payment_transactions (
			order_id, user_id, amount, currency,
			status, payment_method, transaction_id
		) VALUES (
			@order_id, @user_id, @amount, @currency,
			'pending', @payment_method, @transaction_id
		)
		RETURNING *`

	args := pgx.NamedArgs{
		"order_id":       req.OrderID,
		"user_id":        req.UserID,
		"amount":         req.Amount,
		"currency":       req.Currency,
		"payment_method": req.PaymentMethod,
		"transaction_id": req.TransactionID,
	}

	rows, err := tx.Query(ctx, q, args)
	if err != nil {
		if isUniqueViolation(err) {
			// PH-011d: uq_payment_transactions_transaction_id — gateway id is unique.
			return nil, models.ErrConflict
		}
		return nil, fmt.Errorf("paymentTransactionRepository.Create: %w", err)
	}

	pt, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[PaymentTransaction])
	if err != nil {
		if isUniqueViolation(err) {
			return nil, models.ErrConflict
		}
		return nil, fmt.Errorf("paymentTransactionRepository.Create scan: %w", err)
	}
	return &pt, nil
}

func (r *paymentTransactionRepository) GetByID(ctx context.Context, id int64) (*PaymentTransaction, error) {
	const q = `SELECT * FROM payment_transactions WHERE id = $1`

	rows, err := r.db.Query(ctx, q, id)
	if err != nil {
		return nil, fmt.Errorf("paymentTransactionRepository.GetByID: %w", err)
	}

	pt, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[PaymentTransaction])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("paymentTransactionRepository.GetByID scan: %w", err)
	}
	return &pt, nil
}

func (r *paymentTransactionRepository) GetByTransactionID(ctx context.Context, transactionID string) (*PaymentTransaction, error) {
	const q = `SELECT * FROM payment_transactions WHERE transaction_id = $1`

	rows, err := r.db.Query(ctx, q, transactionID)
	if err != nil {
		return nil, fmt.Errorf("paymentTransactionRepository.GetByTransactionID: %w", err)
	}

	pt, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[PaymentTransaction])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("paymentTransactionRepository.GetByTransactionID scan: %w", err)
	}
	return &pt, nil
}

func (r *paymentTransactionRepository) GetAll(ctx context.Context, f PaymentTransactionFilter) ([]*PaymentTransaction, int64, error) {
	where := []string{"1=1"}
	args := pgx.NamedArgs{}

	if f.UserID != nil {
		where = append(where, "user_id = @user_id")
		args["user_id"] = *f.UserID
	}
	if f.OrderID != nil {
		where = append(where, "order_id = @order_id")
		args["order_id"] = *f.OrderID
	}
	if f.Status != nil {
		where = append(where, "status = @status")
		args["status"] = *f.Status
	}

	allowed := map[string]bool{
		"created_at": true,
		"amount":     true,
		"paid_at":    true,
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
		FROM payment_transactions
		WHERE %s
		ORDER BY %s %s
		LIMIT @limit OFFSET @offset`,
		strings.Join(where, " AND "), sortBy, order,
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, 0, fmt.Errorf("paymentTransactionRepository.GetAll: %w", err)
	}
	defer rows.Close()

	var (
		pts   []*PaymentTransaction
		total int64
	)

	for rows.Next() {
		var pt PaymentTransaction
		if err := rows.Scan(
			&pt.ID, &pt.OrderID, &pt.UserID,
			&pt.Amount, &pt.Currency,
			&pt.Status, &pt.PaymentMethod,
			&pt.TransactionID, &pt.RawResponse,
			&pt.ErrorMessage, &pt.PaidAt,
			&pt.CreatedAt,
			&total,
		); err != nil {
			return nil, 0, fmt.Errorf("paymentTransactionRepository.GetAll scan: %w", err)
		}
		pts = append(pts, &pt)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("paymentTransactionRepository.GetAll rows: %w", err)
	}

	return pts, total, nil
}

// Confirm stamps paid_at and stores the gateway response.
// Always called inside a transaction — the caller also updates
// the order status to 'paid' in the same tx.
func (r *paymentTransactionRepository) Confirm(ctx context.Context, tx pgx.Tx, req ConfirmPaymentReq) (*PaymentTransaction, error) {
	const q = `
		UPDATE payment_transactions
		SET status       = 'succeeded',
		    raw_response = @raw_response,
		    paid_at      = @paid_at
		WHERE transaction_id = @transaction_id
		  AND status         = 'pending'
		RETURNING *`

	args := pgx.NamedArgs{
		"transaction_id": req.TransactionID,
		"raw_response":   req.RawResponse,
		"paid_at":        time.Now(),
	}

	rows, err := tx.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("paymentTransactionRepository.Confirm: %w", err)
	}

	pt, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[PaymentTransaction])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("paymentTransactionRepository.Confirm scan: %w", err)
	}
	return &pt, nil
}

// Fail records the gateway error without a transaction —
// a failed payment has no side effects that need atomicity.
func (r *paymentTransactionRepository) Fail(ctx context.Context, req FailPaymentReq) (*PaymentTransaction, error) {
	const q = `
		UPDATE payment_transactions
		SET status        = 'failed',
		    error_message = @error_message,
		    raw_response  = @raw_response
		WHERE transaction_id = @transaction_id
		  AND status         = 'pending'
		RETURNING *`

	args := pgx.NamedArgs{
		"transaction_id": req.TransactionID,
		"error_message":  req.ErrorMessage,
		"raw_response":   req.RawResponse,
	}

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("paymentTransactionRepository.Fail: %w", err)
	}

	pt, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[PaymentTransaction])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("paymentTransactionRepository.Fail scan: %w", err)
	}
	return &pt, nil
}


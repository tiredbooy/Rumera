package payments

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
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
	InsertEarnIntent(ctx context.Context, tx pgx.Tx, intent OrderEarnIntent) error
	ListPendingEarnIntents(ctx context.Context, limit int) ([]OrderEarnIntent, error)
	MarkEarnAwarded(ctx context.Context, orderID int64) error
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
	r.attachUserUUIDs(ctx, &pt)
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
	r.attachUserUUIDs(ctx, &pt)
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

	r.attachUserUUIDs(ctx, pts...)
	return pts, total, nil
}

// attachUserUUIDs fills UserUUID from users.user_id so admin DTOs can jump
// to /admin/customers/:id. Lookup failure omits the public id (never emit users.id).
func (r *paymentTransactionRepository) attachUserUUIDs(ctx context.Context, pts ...*PaymentTransaction) {
	ids := make([]int64, 0, len(pts))
	seen := make(map[int64]struct{}, len(pts))
	for _, pt := range pts {
		if pt == nil || pt.UserID == nil || *pt.UserID <= 0 {
			continue
		}
		id := *pt.UserID
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	if len(ids) == 0 {
		return
	}

	rows, err := r.db.Query(ctx, `SELECT id, user_id FROM users WHERE id = ANY($1)`, ids)
	if err != nil {
		return
	}
	defer rows.Close()

	byInternal := make(map[int64]uuid.UUID, len(ids))
	for rows.Next() {
		var id int64
		var public uuid.UUID
		if err := rows.Scan(&id, &public); err != nil {
			return
		}
		if public != uuid.Nil {
			byInternal[id] = public
		}
	}
	if rows.Err() != nil {
		return
	}

	for _, pt := range pts {
		if pt == nil || pt.UserID == nil {
			continue
		}
		if public, ok := byInternal[*pt.UserID]; ok {
			uid := public
			pt.UserUUID = &uid
		}
	}
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

func (r *paymentTransactionRepository) InsertEarnIntent(ctx context.Context, tx pgx.Tx, intent OrderEarnIntent) error {
	const q = `
		INSERT INTO payment_loyalty_awards (order_id, user_id, amount)
		VALUES ($1, $2, $3)
		ON CONFLICT (order_id) DO NOTHING`
	if _, err := tx.Exec(ctx, q, intent.OrderID, intent.UserID, intent.Amount); err != nil {
		return fmt.Errorf("paymentTransactionRepository.InsertEarnIntent: %w", err)
	}
	return nil
}

func (r *paymentTransactionRepository) ListPendingEarnIntents(ctx context.Context, limit int) ([]OrderEarnIntent, error) {
	if limit <= 0 {
		limit = 50
	}
	const q = `
		SELECT order_id, user_id, amount, created_at, awarded_at
		FROM payment_loyalty_awards
		WHERE awarded_at IS NULL
		ORDER BY created_at ASC
		LIMIT $1`
	rows, err := r.db.Query(ctx, q, limit)
	if err != nil {
		return nil, fmt.Errorf("paymentTransactionRepository.ListPendingEarnIntents: %w", err)
	}
	intents, err := pgx.CollectRows(rows, pgx.RowToStructByName[OrderEarnIntent])
	if err != nil {
		return nil, fmt.Errorf("paymentTransactionRepository.ListPendingEarnIntents scan: %w", err)
	}
	return intents, nil
}

func (r *paymentTransactionRepository) MarkEarnAwarded(ctx context.Context, orderID int64) error {
	const q = `
		UPDATE payment_loyalty_awards
		SET awarded_at = NOW()
		WHERE order_id = $1 AND awarded_at IS NULL`
	if _, err := r.db.Exec(ctx, q, orderID); err != nil {
		return fmt.Errorf("paymentTransactionRepository.MarkEarnAwarded: %w", err)
	}
	return nil
}

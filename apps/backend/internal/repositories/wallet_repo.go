package repositories

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
)

type WalletRepository interface {
	GetByUserID(ctx context.Context, userID int64) (*models.Wallet, error)
	GetOrCreate(ctx context.Context, userID int64) (*models.Wallet, error)

	Deposit(ctx context.Context, tx pgx.Tx, walletID int64, amount float64, orderID *int64, description *string) (*models.WalletTransaction, error)
	Withdraw(ctx context.Context, tx pgx.Tx, walletID int64, amount float64, orderID *int64, description *string) (*models.WalletTransaction, error)
	Purchase(ctx context.Context, tx pgx.Tx, walletID int64, amount float64, orderID int64) (*models.WalletTransaction, error)
	Refund(ctx context.Context, tx pgx.Tx, walletID int64, amount float64, orderID int64) (*models.WalletTransaction, error)

	GetTransactions(ctx context.Context, walletID int64, filter models.WalletTransactionFilter) ([]*models.WalletTransaction, int64, error)

	BeginTx(ctx context.Context) (pgx.Tx, error)
}

type walletRepository struct {
	db *pgxpool.Pool
}

func NewWalletRepository(db *pgxpool.Pool) WalletRepository {
	return &walletRepository{db: db}
}

func (r *walletRepository) BeginTx(ctx context.Context) (pgx.Tx, error) {
	return r.db.Begin(ctx)
}

func (r *walletRepository) GetByUserID(ctx context.Context, userID int64) (*models.Wallet, error) {
	const q = `SELECT * FROM wallets WHERE user_id = $1`

	rows, err := r.db.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("walletRepository.GetByUserID: %w", err)
	}

	wallet, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.Wallet])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("walletRepository.GetByUserID scan: %w", err)
	}
	return &wallet, nil
}

func (r *walletRepository) GetOrCreate(ctx context.Context, userID int64) (*models.Wallet, error) {
	const q = `
		INSERT INTO wallets (user_id)
		VALUES ($1)
		ON CONFLICT (user_id) DO UPDATE
			SET updated_at = NOW()
		RETURNING *`

	rows, err := r.db.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("walletRepository.GetOrCreate: %w", err)
	}

	wallet, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.Wallet])
	if err != nil {
		return nil, fmt.Errorf("walletRepository.GetOrCreate scan: %w", err)
	}
	return &wallet, nil
}

func (r *walletRepository) Deposit(ctx context.Context, tx pgx.Tx, walletID int64, amount float64, orderID *int64, description *string) (*models.WalletTransaction, error) {
	return r.applyTransaction(ctx, tx, walletID, amount, models.TransactionTypeDeposit, orderID, description, true)
}

func (r *walletRepository) Withdraw(ctx context.Context, tx pgx.Tx, walletID int64, amount float64, orderID *int64, description *string) (*models.WalletTransaction, error) {
	return r.applyTransaction(ctx, tx, walletID, amount, models.TransactionTypeWithdraw, orderID, description, false)
}

func (r *walletRepository) Purchase(ctx context.Context, tx pgx.Tx, walletID int64, amount float64, orderID int64) (*models.WalletTransaction, error) {
	desc := fmt.Sprintf("payment for order %d", orderID)
	return r.applyTransaction(ctx, tx, walletID, amount, models.TransactionTypePurchase, &orderID, &desc, false)
}

func (r *walletRepository) Refund(ctx context.Context, tx pgx.Tx, walletID int64, amount float64, orderID int64) (*models.WalletTransaction, error) {
	desc := fmt.Sprintf("refund for order %d", orderID)
	return r.applyTransaction(ctx, tx, walletID, amount, models.TransactionTypeRefund, &orderID, &desc, true)
}

// applyTransaction is the single internal method all four operations
// go through. It snapshots balance_before, updates the balance atomically,
// records the transaction row with balance_after, all in one DB round trip.
// credit=true adds to balance, credit=false subtracts.
func (r *walletRepository) applyTransaction(
	ctx context.Context,
	tx pgx.Tx,
	walletID int64,
	amount float64,
	txType models.TransactionType,
	orderID *int64,
	description *string,
	credit bool,
) (*models.WalletTransaction, error) {
	// UPDATE wallet and return old + new balance in one query.
	// For debits, AND balance >= @amount acts as the overdraft guard —
	// if funds are insufficient RowsAffected = 0 and we return ErrInsufficientFunds.
	var updateQ string
	if credit {
		updateQ = `
			UPDATE wallets
			SET balance    = balance + @amount,
			    updated_at = NOW()
			WHERE id = @wallet_id
			RETURNING balance - @amount AS balance_before, balance AS balance_after`
	} else {
		updateQ = `
			UPDATE wallets
			SET balance    = balance - @amount,
			    updated_at = NOW()
			WHERE id = @wallet_id
			  AND balance >= @amount
			RETURNING balance + @amount AS balance_before, balance AS balance_after`
	}

	updateArgs := pgx.NamedArgs{
		"wallet_id": walletID,
		"amount":    amount,
	}

	var balanceBefore, balanceAfter float64
	err := tx.QueryRow(ctx, updateQ, updateArgs).Scan(&balanceBefore, &balanceAfter)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrInsufficientFunds
		}
		return nil, fmt.Errorf("walletRepository.applyTransaction update: %w", err)
	}

	const insertQ = `
		INSERT INTO wallet_transactions (
			wallet_id, amount, type, status,
			balance_before, balance_after,
			reference_order_id, description
		) VALUES (
			@wallet_id, @amount, @type, 'completed',
			@balance_before, @balance_after,
			@order_id, @description
		)
		RETURNING *`

	insertArgs := pgx.NamedArgs{
		"wallet_id":      walletID,
		"amount":         amount,
		"type":           txType,
		"balance_before": balanceBefore,
		"balance_after":  balanceAfter,
		"order_id":       orderID,
		"description":    description,
	}

	rows, err := tx.Query(ctx, insertQ, insertArgs)
	if err != nil {
		return nil, fmt.Errorf("walletRepository.applyTransaction insert: %w", err)
	}

	wtx, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.WalletTransaction])
	if err != nil {
		return nil, fmt.Errorf("walletRepository.applyTransaction insert scan: %w", err)
	}
	return &wtx, nil
}

func (r *walletRepository) GetTransactions(ctx context.Context, walletID int64, f models.WalletTransactionFilter) ([]*models.WalletTransaction, int64, error) {
	where := []string{"wallet_id = @wallet_id"}
	args := pgx.NamedArgs{"wallet_id": walletID}

	if f.Type != nil {
		where = append(where, "type = @type")
		args["type"] = *f.Type
	}
	if f.Status != nil {
		where = append(where, "status = @status")
		args["status"] = *f.Status
	}

	allowed := map[string]bool{"created_at": true, "amount": true}
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
		FROM wallet_transactions
		WHERE %s
		ORDER BY %s %s
		LIMIT @limit OFFSET @offset`,
		strings.Join(where, " AND "), sortBy, order,
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, 0, fmt.Errorf("walletRepository.GetTransactions: %w", err)
	}
	defer rows.Close()

	var (
		txs   []*models.WalletTransaction
		total int64
	)

	for rows.Next() {
		var t models.WalletTransaction
		if err := rows.Scan(
			&t.ID, &t.WalletID, &t.Amount,
			&t.Type, &t.Status,
			&t.BalanceBefore, &t.BalanceAfter,
			&t.ReferenceOrderID, &t.Description,
			&t.CreatedAt,
			&total,
		); err != nil {
			return nil, 0, fmt.Errorf("walletRepository.GetTransactions scan: %w", err)
		}
		txs = append(txs, &t)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("walletRepository.GetTransactions rows: %w", err)
	}

	return txs, total, nil
}

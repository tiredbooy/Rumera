package wallet

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
)

type Repository interface {
	GetByUserID(ctx context.Context, userID int64) (*Wallet, error)
	GetOrCreate(ctx context.Context, userID int64) (*Wallet, error)

	Deposit(ctx context.Context, tx pgx.Tx, walletID int64, amount float64, orderID *int64, description *string) (*Transaction, error)
	Withdraw(ctx context.Context, tx pgx.Tx, walletID int64, amount float64, orderID *int64, description *string) (*Transaction, error)
	Purchase(ctx context.Context, tx pgx.Tx, walletID int64, amount float64, orderID int64) (*Transaction, error)
	Refund(ctx context.Context, tx pgx.Tx, walletID int64, amount float64, orderID int64) (*Transaction, error)

	// FindAdminCreditByIdempotencyKey returns a prior admin credit for this wallet
	// identified by the idempotency marker embedded in description.
	FindAdminCreditByIdempotencyKey(ctx context.Context, walletID int64, key string) (*Transaction, error)
	// FindDepositByDescriptionMarker finds a deposit whose description contains marker
	// (e.g. topup_txid=<gateway id>) for gateway top-up idempotency (PH-041a).
	FindDepositByDescriptionMarker(ctx context.Context, walletID int64, marker string) (*Transaction, error)

	GetTransactions(ctx context.Context, walletID int64, filter TransactionFilter) ([]*Transaction, int64, error)

	BeginTx(ctx context.Context) (pgx.Tx, error)
}

type repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) Repository {
	return &repository{db: db}
}

func (r *repository) BeginTx(ctx context.Context) (pgx.Tx, error) {
	return r.db.Begin(ctx)
}

func (r *repository) GetByUserID(ctx context.Context, userID int64) (*Wallet, error) {
	const q = `SELECT * FROM wallets WHERE user_id = $1`

	rows, err := r.db.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("repository.GetByUserID: %w", err)
	}

	wallet, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Wallet])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("repository.GetByUserID scan: %w", err)
	}
	return &wallet, nil
}

func (r *repository) GetOrCreate(ctx context.Context, userID int64) (*Wallet, error) {
	const q = `
		INSERT INTO wallets (user_id)
		VALUES ($1)
		ON CONFLICT (user_id) DO UPDATE
			SET updated_at = NOW()
		RETURNING *`

	rows, err := r.db.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("repository.GetOrCreate: %w", err)
	}

	wallet, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Wallet])
	if err != nil {
		return nil, fmt.Errorf("repository.GetOrCreate scan: %w", err)
	}
	return &wallet, nil
}

func (r *repository) Deposit(ctx context.Context, tx pgx.Tx, walletID int64, amount float64, orderID *int64, description *string) (*Transaction, error) {
	return r.applyTransaction(ctx, tx, walletID, amount, TransactionTypeDeposit, orderID, description, true)
}

// FindAdminCreditByIdempotencyKey locates a deposit whose description embeds
// the admin credit idempotency marker "idem=<key>".
func (r *repository) FindAdminCreditByIdempotencyKey(ctx context.Context, walletID int64, key string) (*Transaction, error) {
	return r.FindDepositByDescriptionMarker(ctx, walletID, "idem="+key)
}

// FindDepositByDescriptionMarker locates a deposit by a substring in description.
func (r *repository) FindDepositByDescriptionMarker(ctx context.Context, walletID int64, marker string) (*Transaction, error) {
	if walletID <= 0 || marker == "" {
		return nil, models.ErrNotFound
	}
	const q = `
		SELECT *
		FROM wallet_transactions
		WHERE wallet_id = $1
		  AND type = 'deposit'
		  AND description LIKE '%' || $2 || '%'
		ORDER BY id ASC
		LIMIT 1`
	rows, err := r.db.Query(ctx, q, walletID, marker)
	if err != nil {
		return nil, fmt.Errorf("repository.FindDepositByDescriptionMarker: %w", err)
	}
	wtx, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Transaction])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("repository.FindDepositByDescriptionMarker scan: %w", err)
	}
	return &wtx, nil
}

func (r *repository) Withdraw(ctx context.Context, tx pgx.Tx, walletID int64, amount float64, orderID *int64, description *string) (*Transaction, error) {
	return r.applyTransaction(ctx, tx, walletID, amount, TransactionTypeWithdraw, orderID, description, false)
}

func (r *repository) Purchase(ctx context.Context, tx pgx.Tx, walletID int64, amount float64, orderID int64) (*Transaction, error) {
	desc := fmt.Sprintf("payment for order %d", orderID)
	return r.applyTransaction(ctx, tx, walletID, amount, TransactionTypePurchase, &orderID, &desc, false)
}

func (r *repository) Refund(ctx context.Context, tx pgx.Tx, walletID int64, amount float64, orderID int64) (*Transaction, error) {
	desc := fmt.Sprintf("refund for order %d", orderID)
	return r.applyTransaction(ctx, tx, walletID, amount, TransactionTypeRefund, &orderID, &desc, true)
}

// applyTransaction is the single internal method all four operations
// go through. It snapshots balance_before, updates the balance atomically,
// records the transaction row with balance_after, all in one DB round trip.
// credit=true adds to balance, credit=false subtracts.
func (r *repository) applyTransaction(
	ctx context.Context,
	tx pgx.Tx,
	walletID int64,
	amount float64,
	txType TransactionType,
	orderID *int64,
	description *string,
	credit bool,
) (*Transaction, error) {
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
		return nil, fmt.Errorf("repository.applyTransaction update: %w", err)
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
		return nil, fmt.Errorf("repository.applyTransaction insert: %w", err)
	}

	wtx, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Transaction])
	if err != nil {
		return nil, fmt.Errorf("repository.applyTransaction insert scan: %w", err)
	}
	return &wtx, nil
}

func (r *repository) GetTransactions(ctx context.Context, walletID int64, f TransactionFilter) ([]*Transaction, int64, error) {
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
		return nil, 0, fmt.Errorf("repository.GetTransactions: %w", err)
	}
	defer rows.Close()

	var (
		txs   []*Transaction
		total int64
	)

	for rows.Next() {
		var t Transaction
		if err := rows.Scan(
			&t.ID, &t.WalletID, &t.Amount,
			&t.Type, &t.Status,
			&t.BalanceBefore, &t.BalanceAfter,
			&t.ReferenceOrderID, &t.Description,
			&t.CreatedAt,
			&total,
		); err != nil {
			return nil, 0, fmt.Errorf("repository.GetTransactions scan: %w", err)
		}
		txs = append(txs, &t)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("repository.GetTransactions rows: %w", err)
	}

	return txs, total, nil
}

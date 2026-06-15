package repositories

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
)

type LoyaltyRepository interface {
	GetAccount(ctx context.Context, userID int64) (*models.LoyaltyAccount, error)
	// Award grants points idempotently keyed by (reason, refType, refID). Returns
	// false (no error) when the grant was already recorded.
	Award(ctx context.Context, userID int64, delta int, reason, refType, refID string) (bool, error)
	// Spend deducts points (guarded against overdraw) and records a ledger entry.
	Spend(ctx context.Context, userID, points int64, refID string) error
	ListTransactions(ctx context.Context, userID int64, limit int) ([]models.LoyaltyTransaction, error)
}

type loyaltyRepository struct {
	db *pgxpool.Pool
}

func NewLoyaltyRepository(db *pgxpool.Pool) LoyaltyRepository {
	return &loyaltyRepository{db: db}
}

func (r *loyaltyRepository) GetAccount(ctx context.Context, userID int64) (*models.LoyaltyAccount, error) {
	const q = `SELECT * FROM loyalty_accounts WHERE user_id = $1`

	rows, err := r.db.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("loyaltyRepository.GetAccount: %w", err)
	}
	acc, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.LoyaltyAccount])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("loyaltyRepository.GetAccount scan: %w", err)
	}
	return &acc, nil
}

func (r *loyaltyRepository) Award(ctx context.Context, userID int64, delta int, reason, refType, refID string) (bool, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return false, fmt.Errorf("loyaltyRepository.Award begin: %w", err)
	}
	defer tx.Rollback(ctx)

	// Idempotency gate: the unique (reason, ref_type, ref_id) makes a replay a no-op.
	const insLedger = `
		INSERT INTO loyalty_transactions (user_id, delta, reason, ref_type, ref_id)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (reason, ref_type, ref_id) DO NOTHING`
	tag, err := tx.Exec(ctx, insLedger, userID, delta, reason, refType, refID)
	if err != nil {
		return false, fmt.Errorf("loyaltyRepository.Award ledger: %w", err)
	}
	if tag.RowsAffected() == 0 {
		// Already granted — nothing to do.
		return false, tx.Commit(ctx)
	}

	// Upsert the balance + tier. Tier is derived from the new lifetime total.
	const upsert = `
		INSERT INTO loyalty_accounts (user_id, points_balance, lifetime_points, tier)
		VALUES ($1, $2, GREATEST($2,0),
			CASE WHEN GREATEST($2,0) >= 20000 THEN 'cellar'
			     WHEN GREATEST($2,0) >= 5000  THEN 'gold'
			     WHEN GREATEST($2,0) >= 1000  THEN 'silver'
			     ELSE 'bronze' END)
		ON CONFLICT (user_id) DO UPDATE SET
			points_balance  = loyalty_accounts.points_balance  + $2,
			lifetime_points = loyalty_accounts.lifetime_points + GREATEST($2,0),
			tier = CASE
				WHEN loyalty_accounts.lifetime_points + GREATEST($2,0) >= 20000 THEN 'cellar'
				WHEN loyalty_accounts.lifetime_points + GREATEST($2,0) >= 5000  THEN 'gold'
				WHEN loyalty_accounts.lifetime_points + GREATEST($2,0) >= 1000  THEN 'silver'
				ELSE 'bronze' END,
			updated_at = NOW()`
	if _, err := tx.Exec(ctx, upsert, userID, delta); err != nil {
		return false, fmt.Errorf("loyaltyRepository.Award upsert: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return false, fmt.Errorf("loyaltyRepository.Award commit: %w", err)
	}
	return true, nil
}

func (r *loyaltyRepository) Spend(ctx context.Context, userID, points int64, refID string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("loyaltyRepository.Spend begin: %w", err)
	}
	defer tx.Rollback(ctx)

	const dec = `
		UPDATE loyalty_accounts
		SET points_balance = points_balance - $2, updated_at = NOW()
		WHERE user_id = $1 AND points_balance >= $2
		RETURNING points_balance`
	var remaining int
	if err := tx.QueryRow(ctx, dec, userID, points).Scan(&remaining); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return models.ErrInsufficientFunds
		}
		return fmt.Errorf("loyaltyRepository.Spend update: %w", err)
	}

	const ledger = `
		INSERT INTO loyalty_transactions (user_id, delta, reason, ref_type, ref_id)
		VALUES ($1, $2, 'redeem', 'redeem', $3)`
	if _, err := tx.Exec(ctx, ledger, userID, -points, refID); err != nil {
		return fmt.Errorf("loyaltyRepository.Spend ledger: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("loyaltyRepository.Spend commit: %w", err)
	}
	return nil
}

func (r *loyaltyRepository) ListTransactions(ctx context.Context, userID int64, limit int) ([]models.LoyaltyTransaction, error) {
	const q = `
		SELECT * FROM loyalty_transactions
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2`
	rows, err := r.db.Query(ctx, q, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("loyaltyRepository.ListTransactions: %w", err)
	}
	txs, err := pgx.CollectRows(rows, pgx.RowToStructByName[models.LoyaltyTransaction])
	if err != nil {
		return nil, fmt.Errorf("loyaltyRepository.ListTransactions scan: %w", err)
	}
	return txs, nil
}

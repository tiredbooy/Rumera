package loyalty

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
)

type Repository interface {
	GetAccount(ctx context.Context, userID int64) (*LoyaltyAccount, error)
	// Award grants points idempotently keyed by (reason, refType, refID). Returns
	// false (no error) when the grant was already recorded.
	Award(ctx context.Context, userID int64, delta int, reason, refType, refID string) (bool, error)
	// Spend deducts points (guarded against overdraw) and records a ledger entry.
	// When the same refID was already spent, replayed is true and err is nil
	// (no second balance change) — used with HTTP Idempotency-Key (PH-040b).
	Spend(ctx context.Context, userID, points int64, refID string) (replayed bool, err error)
	// Clawback reduces balance by up to maxPoints without reducing lifetime.
	// Idempotent on (reason, refType, refID). Returns points actually deducted.
	Clawback(ctx context.Context, userID int64, maxPoints int, reason, refType, refID string) (deducted int, err error)
	// GetLedgerDelta returns the delta for an exact ledger key (e.g. order_paid).
	GetLedgerDelta(ctx context.Context, reason, refType, refID string) (delta int, err error)
	// ListBirthdayUserIDs returns active users whose birth month/day match.
	// When includeFeb29 is true (28 Feb non-leap), also includes 29 Feb birthdays.
	ListBirthdayUserIDs(ctx context.Context, month, day int, includeFeb29 bool) ([]int64, error)
	ListTransactions(ctx context.Context, userID int64, limit int) ([]LoyaltyTransaction, error)
}

type loyaltyRepository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) Repository {
	return &loyaltyRepository{db: db}
}

func (r *loyaltyRepository) GetAccount(ctx context.Context, userID int64) (*LoyaltyAccount, error) {
	const q = `
		SELECT user_id, points_balance, lifetime_points, tier, tier_since, updated_at
		FROM loyalty_accounts
		WHERE user_id = $1`

	rows, err := r.db.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("loyaltyRepository.GetAccount: %w", err)
	}
	acc, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[LoyaltyAccount])
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

func (r *loyaltyRepository) Spend(ctx context.Context, userID, points int64, refID string) (bool, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return false, fmt.Errorf("loyaltyRepository.Spend begin: %w", err)
	}
	defer tx.Rollback(ctx)

	// Claim ledger row first so a client idempotency key cannot double-spend
	// after HTTP cache expiry (PH-040b).
	const ledger = `
		INSERT INTO loyalty_transactions (user_id, delta, reason, ref_type, ref_id)
		VALUES ($1, $2, 'redeem', 'redeem', $3)
		ON CONFLICT (reason, ref_type, ref_id) DO NOTHING`
	tag, err := tx.Exec(ctx, ledger, userID, -points, refID)
	if err != nil {
		return false, fmt.Errorf("loyaltyRepository.Spend ledger: %w", err)
	}
	if tag.RowsAffected() == 0 {
		if err := tx.Commit(ctx); err != nil {
			return false, fmt.Errorf("loyaltyRepository.Spend commit replay: %w", err)
		}
		return true, nil
	}

	const dec = `
		UPDATE loyalty_accounts
		SET points_balance = points_balance - $2, updated_at = NOW()
		WHERE user_id = $1 AND points_balance >= $2
		RETURNING points_balance`
	var remaining int
	if err := tx.QueryRow(ctx, dec, userID, points).Scan(&remaining); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, models.ErrInsufficientFunds
		}
		return false, fmt.Errorf("loyaltyRepository.Spend update: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return false, fmt.Errorf("loyaltyRepository.Spend commit: %w", err)
	}
	return false, nil
}

func (r *loyaltyRepository) Clawback(ctx context.Context, userID int64, maxPoints int, reason, refType, refID string) (int, error) {
	if maxPoints <= 0 {
		return 0, nil
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("loyaltyRepository.Clawback begin: %w", err)
	}
	defer tx.Rollback(ctx)

	// Lock account row if present.
	var balance int
	err = tx.QueryRow(ctx, `
		SELECT points_balance FROM loyalty_accounts WHERE user_id = $1 FOR UPDATE`,
		userID,
	).Scan(&balance)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// No account — still record zero clawback? Prefer no-op without ledger
			// so a later earn+clawback path can run once account exists.
			return 0, tx.Commit(ctx)
		}
		return 0, fmt.Errorf("loyaltyRepository.Clawback lock: %w", err)
	}
	deducted := maxPoints
	if balance < deducted {
		deducted = balance
	}
	if deducted <= 0 {
		// Nothing to take; claim the idempotency key with 0 so retries no-op.
		const ins0 = `
			INSERT INTO loyalty_transactions (user_id, delta, reason, ref_type, ref_id)
			VALUES ($1, 0, $2, $3, $4)
			ON CONFLICT (reason, ref_type, ref_id) DO NOTHING`
		if _, err := tx.Exec(ctx, ins0, userID, reason, refType, refID); err != nil {
			return 0, fmt.Errorf("loyaltyRepository.Clawback ledger0: %w", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return 0, err
		}
		return 0, nil
	}

	const ins = `
		INSERT INTO loyalty_transactions (user_id, delta, reason, ref_type, ref_id)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (reason, ref_type, ref_id) DO NOTHING`
	tag, err := tx.Exec(ctx, ins, userID, -deducted, reason, refType, refID)
	if err != nil {
		return 0, fmt.Errorf("loyaltyRepository.Clawback ledger: %w", err)
	}
	if tag.RowsAffected() == 0 {
		if err := tx.Commit(ctx); err != nil {
			return 0, err
		}
		return 0, nil
	}

	if _, err := tx.Exec(ctx, `
		UPDATE loyalty_accounts
		SET points_balance = points_balance - $2, updated_at = NOW()
		WHERE user_id = $1`, userID, deducted); err != nil {
		return 0, fmt.Errorf("loyaltyRepository.Clawback update: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return deducted, nil
}

func (r *loyaltyRepository) GetLedgerDelta(ctx context.Context, reason, refType, refID string) (int, error) {
	const q = `
		SELECT delta FROM loyalty_transactions
		WHERE reason = $1 AND ref_type = $2 AND ref_id = $3`
	var delta int
	err := r.db.QueryRow(ctx, q, reason, refType, refID).Scan(&delta)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, models.ErrNotFound
		}
		return 0, fmt.Errorf("loyaltyRepository.GetLedgerDelta: %w", err)
	}
	return delta, nil
}

func (r *loyaltyRepository) ListBirthdayUserIDs(ctx context.Context, month, day int, includeFeb29 bool) ([]int64, error) {
	const q = `
		SELECT id FROM users
		WHERE is_active = TRUE
		  AND is_banned = FALSE
		  AND birth_date IS NOT NULL
		  AND (
			(EXTRACT(MONTH FROM birth_date)::int = $1 AND EXTRACT(DAY FROM birth_date)::int = $2)
			OR ($3::bool AND EXTRACT(MONTH FROM birth_date)::int = 2 AND EXTRACT(DAY FROM birth_date)::int = 29)
		  )
		ORDER BY id`
	rows, err := r.db.Query(ctx, q, month, day, includeFeb29)
	if err != nil {
		return nil, fmt.Errorf("loyaltyRepository.ListBirthdayUserIDs: %w", err)
	}
	defer rows.Close()
	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("loyaltyRepository.ListBirthdayUserIDs scan: %w", err)
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func (r *loyaltyRepository) ListTransactions(ctx context.Context, userID int64, limit int) ([]LoyaltyTransaction, error) {
	const q = `
		SELECT id, user_id, delta, reason, ref_type, ref_id, created_at
		FROM loyalty_transactions
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2`
	rows, err := r.db.Query(ctx, q, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("loyaltyRepository.ListTransactions: %w", err)
	}
	txs, err := pgx.CollectRows(rows, pgx.RowToStructByName[LoyaltyTransaction])
	if err != nil {
		return nil, fmt.Errorf("loyaltyRepository.ListTransactions scan: %w", err)
	}
	return txs, nil
}

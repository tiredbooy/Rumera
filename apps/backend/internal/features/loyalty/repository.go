package loyalty

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
)

type Repository interface {
	GetAccount(ctx context.Context, userID int64) (*LoyaltyAccount, error)
	// Award grants points idempotently keyed by (reason, refType, refID). Returns
	// false (no error) when the grant was already recorded. tiers are live
	// programme cutovers (not hardcoded 1000/5000/20000).
	Award(ctx context.Context, userID int64, delta int, reason, refType, refID string, tiers TierThresholds) (bool, error)
	// GetProgramme returns the singleton loyalty_programme row. Missing → models.ErrNotFound.
	GetProgramme(ctx context.Context) (*programmeRow, error)
	// ListProgrammeTiers returns bronze/silver/gold/cellar ordered by sort_order.
	ListProgrammeTiers(ctx context.Context) ([]ProgrammeTier, error)
	// SaveProgramme upserts the singleton rates and the four named tiers.
	SaveProgramme(ctx context.Context, row programmeRow, tiers []ProgrammeTier) error
	// Spend deducts points (guarded against overdraw) and records a ledger entry.
	// When the same refID was already spent, replayed is true and err is nil
	// (no second balance change). Caller must pass a user-scoped ref
	// ("{userID}:idem:{key}", PR-003g) because UNIQUE is global.
	Spend(ctx context.Context, userID, points int64, refID string) (replayed bool, err error)
	// Clawback reduces balance by up to maxPoints without reducing lifetime.
	// Idempotent on (reason, refType, refID). Returns points actually deducted.
	Clawback(ctx context.Context, userID int64, maxPoints int, reason, refType, refID string) (deducted int, err error)
	// GetLedgerDelta returns the delta for an exact ledger key (e.g. order_paid).
	GetLedgerDelta(ctx context.Context, reason, refType, refID string) (delta int, err error)
	// ListBirthdayUserIDs returns active users whose birth month/day match.
	// When includeFeb29 is true (28 Feb non-leap), also includes 29 Feb birthdays.
	ListBirthdayUserIDs(ctx context.Context, month, day int, includeFeb29 bool) ([]int64, error)
	// ListTransactions pages the caller's ledger. Empty page is [] (never nil).
	ListTransactions(ctx context.Context, userID int64, filter TransactionFilter) ([]LoyaltyTransaction, int64, error)
	// ListMembers joins loyalty_accounts with users (email + public UUID).
	ListMembers(ctx context.Context, filter MemberFilter) ([]AdminMemberRow, int64, error)
	// GetMemberByUserUUID looks up users.user_id. Missing user → models.ErrNotFound.
	// A user with no loyalty_accounts row is still returned (zero bronze).
	GetMemberByUserUUID(ctx context.Context, userUUID uuid.UUID) (*AdminMemberRow, error)
	// ListMemberTransactions pages the ledger for users.user_id. Missing user → models.ErrNotFound.
	ListMemberTransactions(ctx context.Context, userUUID uuid.UUID, filter MemberTransactionFilter) ([]LoyaltyTransaction, int64, error)
	// ResolveUserID maps users.user_id (UUID) to internal users.id. Missing → models.ErrNotFound.
	ResolveUserID(ctx context.Context, userUUID uuid.UUID) (int64, error)
	// FindAdminAdjust locates a prior admin_adjust row for this member + key
	// (exact ref_id or `{key}|actor=…` encoding). Missing → models.ErrNotFound.
	FindAdminAdjust(ctx context.Context, userID int64, refIdentity string) (*LoyaltyTransaction, error)
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

func (r *loyaltyRepository) Award(ctx context.Context, userID int64, delta int, reason, refType, refID string, tiers TierThresholds) (bool, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return false, fmt.Errorf("loyaltyRepository.Award begin: %w", err)
	}
	defer tx.Rollback(ctx)

	cut := tiers.orDefault()

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

	// Upsert the balance + tier. Cutovers come from the live programme (PR-003f).
	const upsert = `
		INSERT INTO loyalty_accounts (user_id, points_balance, lifetime_points, tier)
		VALUES ($1, $2, GREATEST($2,0),
			CASE WHEN GREATEST($2,0) >= $5 THEN 'cellar'
			     WHEN GREATEST($2,0) >= $4 THEN 'gold'
			     WHEN GREATEST($2,0) >= $3 THEN 'silver'
			     ELSE 'bronze' END)
		ON CONFLICT (user_id) DO UPDATE SET
			points_balance  = loyalty_accounts.points_balance  + $2,
			lifetime_points = loyalty_accounts.lifetime_points + GREATEST($2,0),
			tier = CASE
				WHEN loyalty_accounts.lifetime_points + GREATEST($2,0) >= $5 THEN 'cellar'
				WHEN loyalty_accounts.lifetime_points + GREATEST($2,0) >= $4 THEN 'gold'
				WHEN loyalty_accounts.lifetime_points + GREATEST($2,0) >= $3 THEN 'silver'
				ELSE 'bronze' END,
			updated_at = NOW()`
	if _, err := tx.Exec(ctx, upsert, userID, delta, cut.Silver, cut.Gold, cut.Cellar); err != nil {
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

func (r *loyaltyRepository) ListTransactions(ctx context.Context, userID int64, filter TransactionFilter) ([]LoyaltyTransaction, int64, error) {
	filter.Defaults()
	var total int64
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM loyalty_transactions WHERE user_id = $1`, userID).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("loyaltyRepository.ListTransactions count: %w", err)
	}
	if total == 0 || int64(filter.Offset()) >= total {
		return []LoyaltyTransaction{}, total, nil
	}
	const q = `
		SELECT id, user_id, delta, reason, ref_type, ref_id, created_at
		FROM loyalty_transactions
		WHERE user_id = $1
		ORDER BY created_at DESC, id DESC
		LIMIT $2 OFFSET $3`
	rows, err := r.db.Query(ctx, q, userID, filter.Limit, filter.Offset())
	if err != nil {
		return nil, 0, fmt.Errorf("loyaltyRepository.ListTransactions: %w", err)
	}
	txs, err := pgx.CollectRows(rows, pgx.RowToStructByName[LoyaltyTransaction])
	if err != nil {
		return nil, 0, fmt.Errorf("loyaltyRepository.ListTransactions scan: %w", err)
	}
	if txs == nil {
		txs = []LoyaltyTransaction{}
	}
	return txs, total, nil
}

func (r *loyaltyRepository) resolveInternalUserID(ctx context.Context, userUUID uuid.UUID) (int64, error) {
	var id int64
	err := r.db.QueryRow(ctx, `SELECT id FROM users WHERE user_id = $1`, userUUID).Scan(&id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, models.ErrNotFound
		}
		return 0, fmt.Errorf("loyaltyRepository.resolveInternalUserID: %w", err)
	}
	return id, nil
}

func (r *loyaltyRepository) ResolveUserID(ctx context.Context, userUUID uuid.UUID) (int64, error) {
	return r.resolveInternalUserID(ctx, userUUID)
}

func (r *loyaltyRepository) FindAdminAdjust(ctx context.Context, userID int64, refIdentity string) (*LoyaltyTransaction, error) {
	refIdentity = strings.TrimSpace(refIdentity)
	if userID <= 0 || refIdentity == "" {
		return nil, models.ErrNotFound
	}
	const q = `
		SELECT id, user_id, delta, reason, ref_type, ref_id, created_at
		FROM loyalty_transactions
		WHERE user_id = $1
		  AND reason = $2
		  AND ref_type = $3
		  AND (ref_id = $4 OR ref_id LIKE $4 || '|%')
		ORDER BY id ASC
		LIMIT 1`
	rows, err := r.db.Query(ctx, q, userID, string(LoyaltyReasonAdminAdjust), adminAdjustRefType, refIdentity)
	if err != nil {
		return nil, fmt.Errorf("loyaltyRepository.FindAdminAdjust: %w", err)
	}
	tx, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[LoyaltyTransaction])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("loyaltyRepository.FindAdminAdjust scan: %w", err)
	}
	return &tx, nil
}

func memberOrderSQL(filter MemberFilter) string {
	dir := "DESC"
	if filter.OrderBy == "asc" {
		dir = "ASC"
	}
	switch filter.SortBy {
	case "points_balance":
		return "a.points_balance " + dir + ", a.user_id DESC"
	case "lifetime_points":
		return "a.lifetime_points " + dir + ", a.user_id DESC"
	case "tier":
		return "CASE a.tier WHEN 'cellar' THEN 4 WHEN 'gold' THEN 3 WHEN 'silver' THEN 2 ELSE 1 END " + dir + ", a.user_id DESC"
	default:
		return "a.updated_at " + dir + ", a.user_id DESC"
	}
}

func (r *loyaltyRepository) ListMembers(ctx context.Context, filter MemberFilter) ([]AdminMemberRow, int64, error) {
	where := []string{"TRUE"}
	args := make([]any, 0, 4)
	n := 1
	if q := strings.TrimSpace(filter.Q); q != "" {
		where = append(where, fmt.Sprintf("(u.email ILIKE $%d OR u.first_name ILIKE $%d OR u.last_name ILIKE $%d OR u.phone ILIKE $%d)", n, n, n, n))
		args = append(args, "%"+q+"%")
		n++
	}
	if tier := strings.TrimSpace(filter.Tier); tier != "" {
		where = append(where, fmt.Sprintf("a.tier = $%d", n))
		args = append(args, tier)
		n++
	}
	whereSQL := strings.Join(where, " AND ")

	countQ := `SELECT COUNT(*) FROM loyalty_accounts a JOIN users u ON u.id = a.user_id WHERE ` + whereSQL
	var total int64
	if err := r.db.QueryRow(ctx, countQ, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("loyaltyRepository.ListMembers count: %w", err)
	}
	if total == 0 || int64(filter.Offset()) >= total {
		return []AdminMemberRow{}, total, nil
	}

	listQ := fmt.Sprintf(`
		SELECT u.user_id, u.email,
		       NULLIF(BTRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') AS display_name,
		       a.points_balance, a.lifetime_points, a.tier, a.updated_at
		FROM loyalty_accounts a
		JOIN users u ON u.id = a.user_id
		WHERE %s
		ORDER BY %s
		LIMIT $%d OFFSET $%d`, whereSQL, memberOrderSQL(filter), n, n+1)
	rows, err := r.db.Query(ctx, listQ, append(args, filter.Limit, filter.Offset())...)
	if err != nil {
		return nil, 0, fmt.Errorf("loyaltyRepository.ListMembers: %w", err)
	}
	out, err := pgx.CollectRows(rows, pgx.RowToStructByName[AdminMemberRow])
	if err != nil {
		return nil, 0, fmt.Errorf("loyaltyRepository.ListMembers scan: %w", err)
	}
	if out == nil {
		out = []AdminMemberRow{}
	}
	return out, total, nil
}

func (r *loyaltyRepository) GetMemberByUserUUID(ctx context.Context, userUUID uuid.UUID) (*AdminMemberRow, error) {
	const q = `
		SELECT u.user_id, u.email,
		       NULLIF(BTRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') AS display_name,
		       COALESCE(a.points_balance, 0) AS points_balance,
		       COALESCE(a.lifetime_points, 0) AS lifetime_points,
		       COALESCE(a.tier, 'bronze') AS tier,
		       COALESCE(a.updated_at, u.updated_at) AS updated_at
		FROM users u
		LEFT JOIN loyalty_accounts a ON a.user_id = u.id
		WHERE u.user_id = $1`
	rows, err := r.db.Query(ctx, q, userUUID)
	if err != nil {
		return nil, fmt.Errorf("loyaltyRepository.GetMemberByUserUUID: %w", err)
	}
	row, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[AdminMemberRow])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("loyaltyRepository.GetMemberByUserUUID scan: %w", err)
	}
	return &row, nil
}

func (r *loyaltyRepository) ListMemberTransactions(ctx context.Context, userUUID uuid.UUID, filter MemberTransactionFilter) ([]LoyaltyTransaction, int64, error) {
	internalID, err := r.resolveInternalUserID(ctx, userUUID)
	if err != nil {
		return nil, 0, err
	}

	where := "user_id = $1"
	args := []any{internalID}
	n := 2
	if reason := strings.TrimSpace(filter.Reason); reason != "" {
		where += fmt.Sprintf(" AND reason = $%d", n)
		args = append(args, reason)
		n++
	}

	var total int64
	countQ := `SELECT COUNT(*) FROM loyalty_transactions WHERE ` + where
	if err := r.db.QueryRow(ctx, countQ, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("loyaltyRepository.ListMemberTransactions count: %w", err)
	}
	if total == 0 || int64(filter.Offset()) >= total {
		return []LoyaltyTransaction{}, total, nil
	}

	listQ := fmt.Sprintf(`
		SELECT id, user_id, delta, reason, ref_type, ref_id, created_at
		FROM loyalty_transactions
		WHERE %s
		ORDER BY created_at DESC, id DESC
		LIMIT $%d OFFSET $%d`, where, n, n+1)
	rows, err := r.db.Query(ctx, listQ, append(args, filter.Limit, filter.Offset())...)
	if err != nil {
		return nil, 0, fmt.Errorf("loyaltyRepository.ListMemberTransactions: %w", err)
	}
	txs, err := pgx.CollectRows(rows, pgx.RowToStructByName[LoyaltyTransaction])
	if err != nil {
		return nil, 0, fmt.Errorf("loyaltyRepository.ListMemberTransactions scan: %w", err)
	}
	if txs == nil {
		txs = []LoyaltyTransaction{}
	}
	return txs, total, nil
}

const programmeSingletonID = 1

func (r *loyaltyRepository) GetProgramme(ctx context.Context) (*programmeRow, error) {
	const q = `
		SELECT id, enabled, earn_divisor, redeem_value,
		       signup_bonus, review_bonus, birthday_bonus, birthday_tz,
		       referral_reward, updated_at
		FROM loyalty_programme
		WHERE id = $1`
	rows, err := r.db.Query(ctx, q, programmeSingletonID)
	if err != nil {
		return nil, fmt.Errorf("loyaltyRepository.GetProgramme: %w", err)
	}
	row, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[programmeRow])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("loyaltyRepository.GetProgramme scan: %w", err)
	}
	return &row, nil
}

func (r *loyaltyRepository) ListProgrammeTiers(ctx context.Context) ([]ProgrammeTier, error) {
	const q = `
		SELECT id, min_lifetime_points
		FROM loyalty_programme_tiers
		ORDER BY sort_order ASC, id ASC`
	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("loyaltyRepository.ListProgrammeTiers: %w", err)
	}
	out, err := pgx.CollectRows(rows, pgx.RowToStructByName[ProgrammeTier])
	if err != nil {
		return nil, fmt.Errorf("loyaltyRepository.ListProgrammeTiers scan: %w", err)
	}
	if out == nil {
		out = []ProgrammeTier{}
	}
	return out, nil
}

func (r *loyaltyRepository) SaveProgramme(ctx context.Context, row programmeRow, tiers []ProgrammeTier) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("loyaltyRepository.SaveProgramme begin: %w", err)
	}
	defer tx.Rollback(ctx)

	const upsert = `
		INSERT INTO loyalty_programme (
			id, enabled, earn_divisor, redeem_value,
			signup_bonus, review_bonus, birthday_bonus, birthday_tz, referral_reward
		) VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (id) DO UPDATE SET
			enabled         = EXCLUDED.enabled,
			earn_divisor    = EXCLUDED.earn_divisor,
			redeem_value    = EXCLUDED.redeem_value,
			signup_bonus    = EXCLUDED.signup_bonus,
			review_bonus    = EXCLUDED.review_bonus,
			birthday_bonus  = EXCLUDED.birthday_bonus,
			birthday_tz     = EXCLUDED.birthday_tz,
			referral_reward = EXCLUDED.referral_reward,
			updated_at      = NOW()`
	if _, err := tx.Exec(ctx, upsert,
		row.Enabled, row.EarnDivisor, row.RedeemValue,
		row.SignupBonus, row.ReviewBonus, row.BirthdayBonus, row.BirthdayTZ, row.ReferralReward,
	); err != nil {
		return fmt.Errorf("loyaltyRepository.SaveProgramme upsert: %w", err)
	}

	const upsertTier = `
		INSERT INTO loyalty_programme_tiers (id, min_lifetime_points, sort_order)
		VALUES ($1, $2, $3)
		ON CONFLICT (id) DO UPDATE SET
			min_lifetime_points = EXCLUDED.min_lifetime_points,
			sort_order          = EXCLUDED.sort_order`
	for i, t := range tiers {
		if _, err := tx.Exec(ctx, upsertTier, t.ID, t.MinLifetimePoints, i+1); err != nil {
			return fmt.Errorf("loyaltyRepository.SaveProgramme tier %s: %w", t.ID, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("loyaltyRepository.SaveProgramme commit: %w", err)
	}
	return nil
}

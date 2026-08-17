package giftcard

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/shopspring/decimal"
	"github.com/tiredbooy/internal/models"
)

type Repository interface {
	// CreateBatch inserts the complete issuance in one transaction. A collision or
	// scan/commit failure rolls the whole batch back so callers never receive a
	// misleading partial result.
	CreateBatch(ctx context.Context, codes []string, amount decimal.Decimal) ([]GiftCard, error)
	// RedeemAndCredit atomically marks the card redeemed and credits the user's
	// wallet in a single transaction. Returns the credited amount.
	// Returns models.ErrNotFound when the code is unknown or already used.
	RedeemAndCredit(ctx context.Context, code string, userID int64, description string) (decimal.Decimal, error)
	// GetByPurchaseTxID returns the card issued for a gateway payment (idempotency).
	GetByPurchaseTxID(ctx context.Context, purchaseTxID string) (*GiftCard, error)
	// InsertPurchasedTx inserts one paid card inside an open payment Confirm TX.
	InsertPurchasedTx(ctx context.Context, tx pgx.Tx, code string, amount decimal.Decimal, purchaserUserID int64, purchaseTxID string) (*GiftCard, error)
	// ListByPurchaser returns cards bought by the customer (newest first).
	ListByPurchaser(ctx context.Context, userID int64, limit int) ([]GiftCard, error)
	// ListAdmin pages every card for staff (newest first). Empty page is [] (never nil).
	ListAdmin(ctx context.Context, filter AdminFilter) ([]GiftCard, int64, error)
	// GetByID returns one card. Missing → models.ErrNotFound.
	GetByID(ctx context.Context, id int64) (*GiftCard, error)
	// VoidActive sets status=disabled only when the card is still active.
	// Missing → models.ErrNotFound. Redeemed/disabled → models.ErrInvalidState.
	VoidActive(ctx context.Context, id int64) (*GiftCard, error)
}

type repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) Repository {
	return &repository{db: db}
}

func (r *repository) CreateBatch(ctx context.Context, codes []string, amount decimal.Decimal) ([]GiftCard, error) {
	if len(codes) == 0 {
		return []GiftCard{}, nil
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("repository.CreateBatch begin: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	const q = `
		INSERT INTO gift_cards (code, initial_amount)
		SELECT code, $2
		FROM unnest($1::text[]) WITH ORDINALITY AS input(code, ord)
		ORDER BY ord
		RETURNING *`
	rows, err := tx.Query(ctx, q, codes, amount)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, models.ErrConflict
		}
		return nil, fmt.Errorf("repository.CreateBatch: %w", err)
	}
	cards, err := pgx.CollectRows(rows, pgx.RowToStructByName[GiftCard])
	if err != nil {
		if isUniqueViolation(err) {
			return nil, models.ErrConflict
		}
		return nil, fmt.Errorf("repository.CreateBatch scan: %w", err)
	}
	if len(cards) != len(codes) {
		return nil, fmt.Errorf("repository.CreateBatch: inserted %d of %d cards", len(cards), len(codes))
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("repository.CreateBatch commit: %w", err)
	}
	return cards, nil
}

// RedeemAndCredit locks the gift card, marks it redeemed, ensures a wallet
// exists, credits the balance, and writes the wallet_transactions row — all
// inside one transaction so a card can never be burned without a matching credit.
func (r *repository) RedeemAndCredit(
	ctx context.Context,
	code string,
	userID int64,
	description string,
) (decimal.Decimal, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return decimal.Zero, fmt.Errorf("repository.RedeemAndCredit begin: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	const redeemQ = `
		UPDATE gift_cards
		SET status = 'redeemed', redeemed_by = $2, redeemed_at = NOW()
		WHERE code = $1 AND status = 'active'
		RETURNING initial_amount`
	var amount decimal.Decimal
	if err := tx.QueryRow(ctx, redeemQ, code, userID).Scan(&amount); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return decimal.Zero, models.ErrNotFound
		}
		return decimal.Zero, fmt.Errorf("repository.RedeemAndCredit redeem: %w", err)
	}
	if !amount.GreaterThan(decimal.Zero) {
		return decimal.Zero, fmt.Errorf("repository.RedeemAndCredit: non-positive amount")
	}

	const walletQ = `
		INSERT INTO wallets (user_id)
		VALUES ($1)
		ON CONFLICT (user_id) DO UPDATE
			SET updated_at = NOW()
		RETURNING id`
	var walletID int64
	if err := tx.QueryRow(ctx, walletQ, userID).Scan(&walletID); err != nil {
		return decimal.Zero, fmt.Errorf("repository.RedeemAndCredit wallet: %w", err)
	}

	// amount as float64 matches existing wallet ledger (decimal used for gift cards).
	credit, _ := amount.Float64()
	const creditQ = `
		UPDATE wallets
		SET balance    = balance + $1,
		    updated_at = NOW()
		WHERE id = $2
		RETURNING balance - $1 AS balance_before, balance AS balance_after`
	var balanceBefore, balanceAfter float64
	if err := tx.QueryRow(ctx, creditQ, credit, walletID).Scan(&balanceBefore, &balanceAfter); err != nil {
		return decimal.Zero, fmt.Errorf("repository.RedeemAndCredit credit: %w", err)
	}

	const txQ = `
		INSERT INTO wallet_transactions (
			wallet_id, amount, type, status,
			balance_before, balance_after,
			reference_order_id, description
		) VALUES (
			$1, $2, 'deposit', 'completed',
			$3, $4,
			NULL, $5
		)`
	if _, err := tx.Exec(ctx, txQ, walletID, credit, balanceBefore, balanceAfter, description); err != nil {
		return decimal.Zero, fmt.Errorf("repository.RedeemAndCredit ledger: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return decimal.Zero, fmt.Errorf("repository.RedeemAndCredit commit: %w", err)
	}
	return amount, nil
}

func (r *repository) GetByPurchaseTxID(ctx context.Context, purchaseTxID string) (*GiftCard, error) {
	if purchaseTxID == "" {
		return nil, models.ErrNotFound
	}
	const q = `SELECT * FROM gift_cards WHERE purchase_txid = $1 LIMIT 1`
	rows, err := r.db.Query(ctx, q, purchaseTxID)
	if err != nil {
		return nil, fmt.Errorf("repository.GetByPurchaseTxID: %w", err)
	}
	card, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[GiftCard])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("repository.GetByPurchaseTxID scan: %w", err)
	}
	return &card, nil
}

func (r *repository) InsertPurchasedTx(
	ctx context.Context,
	tx pgx.Tx,
	code string,
	amount decimal.Decimal,
	purchaserUserID int64,
	purchaseTxID string,
) (*GiftCard, error) {
	const q = `
		INSERT INTO gift_cards (code, initial_amount, status, purchaser_user_id, purchase_txid)
		VALUES ($1, $2, 'active', $3, $4)
		RETURNING *`
	rows, err := tx.Query(ctx, q, code, amount, purchaserUserID, purchaseTxID)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, models.ErrConflict
		}
		return nil, fmt.Errorf("repository.InsertPurchasedTx: %w", err)
	}
	card, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[GiftCard])
	if err != nil {
		if isUniqueViolation(err) {
			return nil, models.ErrConflict
		}
		return nil, fmt.Errorf("repository.InsertPurchasedTx scan: %w", err)
	}
	return &card, nil
}

func (r *repository) ListByPurchaser(ctx context.Context, userID int64, limit int) ([]GiftCard, error) {
	if limit <= 0 {
		limit = 50
	}
	const q = `
		SELECT * FROM gift_cards
		WHERE purchaser_user_id = $1
		ORDER BY created_at DESC
		LIMIT $2`
	rows, err := r.db.Query(ctx, q, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("repository.ListByPurchaser: %w", err)
	}
	cards, err := pgx.CollectRows(rows, pgx.RowToStructByName[GiftCard])
	if err != nil {
		return nil, fmt.Errorf("repository.ListByPurchaser scan: %w", err)
	}
	return cards, nil
}

func (r *repository) ListAdmin(ctx context.Context, f AdminFilter) ([]GiftCard, int64, error) {
	f.Defaults()

	where := []string{"1=1"}
	args := []any{}
	n := 1
	if f.Status != "" {
		where = append(where, fmt.Sprintf("status = $%d", n))
		args = append(args, string(f.Status))
		n++
	}
	if search := strings.TrimSpace(f.Search); search != "" {
		where = append(where, fmt.Sprintf("code ILIKE $%d", n))
		args = append(args, "%"+search+"%")
		n++
	}
	whereSQL := strings.Join(where, " AND ")

	var total int64
	countQ := `SELECT COUNT(*) FROM gift_cards WHERE ` + whereSQL
	if err := r.db.QueryRow(ctx, countQ, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("repository.ListAdmin count: %w", err)
	}
	if total == 0 || int64(f.Offset()) >= total {
		return []GiftCard{}, total, nil
	}

	sortBy := "created_at"
	switch f.SortBy {
	case "created_at", "initial_amount", "status":
		sortBy = f.SortBy
	}
	order := "DESC"
	if strings.EqualFold(f.OrderBy, "asc") {
		order = "ASC"
	}

	listQ := fmt.Sprintf(`
		SELECT * FROM gift_cards
		WHERE %s
		ORDER BY %s %s, id DESC
		LIMIT $%d OFFSET $%d`, whereSQL, sortBy, order, n, n+1)
	rows, err := r.db.Query(ctx, listQ, append(args, f.Limit, f.Offset())...)
	if err != nil {
		return nil, 0, fmt.Errorf("repository.ListAdmin: %w", err)
	}
	cards, err := pgx.CollectRows(rows, pgx.RowToStructByName[GiftCard])
	if err != nil {
		return nil, 0, fmt.Errorf("repository.ListAdmin scan: %w", err)
	}
	if cards == nil {
		cards = []GiftCard{}
	}
	return cards, total, nil
}

func (r *repository) GetByID(ctx context.Context, id int64) (*GiftCard, error) {
	if id <= 0 {
		return nil, models.ErrNotFound
	}
	const q = `SELECT * FROM gift_cards WHERE id = $1`
	rows, err := r.db.Query(ctx, q, id)
	if err != nil {
		return nil, fmt.Errorf("repository.GetByID: %w", err)
	}
	card, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[GiftCard])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("repository.GetByID scan: %w", err)
	}
	return &card, nil
}

func (r *repository) VoidActive(ctx context.Context, id int64) (*GiftCard, error) {
	if id <= 0 {
		return nil, models.ErrNotFound
	}
	const q = `
		UPDATE gift_cards
		SET status = 'disabled'
		WHERE id = $1 AND status = 'active'
		RETURNING *`
	rows, err := r.db.Query(ctx, q, id)
	if err != nil {
		return nil, fmt.Errorf("repository.VoidActive: %w", err)
	}
	card, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[GiftCard])
	if err == nil {
		return &card, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("repository.VoidActive scan: %w", err)
	}
	if _, getErr := r.GetByID(ctx, id); errors.Is(getErr, models.ErrNotFound) {
		return nil, models.ErrNotFound
	} else if getErr != nil {
		return nil, getErr
	}
	return nil, models.ErrInvalidState
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

package repositories

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/shopspring/decimal"
	"github.com/tiredbooy/internal/models"
)

type GiftCardRepository interface {
	// CreateBatch inserts the complete issuance in one transaction. A collision or
	// scan/commit failure rolls the whole batch back so callers never receive a
	// misleading partial result.
	CreateBatch(ctx context.Context, codes []string, amount decimal.Decimal) ([]models.GiftCard, error)
	// RedeemAndCredit atomically marks the card redeemed and credits the user's
	// wallet in a single transaction. Returns the credited amount.
	// Returns models.ErrNotFound when the code is unknown or already used.
	RedeemAndCredit(ctx context.Context, code string, userID int64, description string) (decimal.Decimal, error)
}

type giftCardRepository struct {
	db *pgxpool.Pool
}

func NewGiftCardRepository(db *pgxpool.Pool) GiftCardRepository {
	return &giftCardRepository{db: db}
}

func (r *giftCardRepository) CreateBatch(ctx context.Context, codes []string, amount decimal.Decimal) ([]models.GiftCard, error) {
	if len(codes) == 0 {
		return []models.GiftCard{}, nil
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("giftCardRepository.CreateBatch begin: %w", err)
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
		return nil, fmt.Errorf("giftCardRepository.CreateBatch: %w", err)
	}
	cards, err := pgx.CollectRows(rows, pgx.RowToStructByName[models.GiftCard])
	if err != nil {
		if isUniqueViolation(err) {
			return nil, models.ErrConflict
		}
		return nil, fmt.Errorf("giftCardRepository.CreateBatch scan: %w", err)
	}
	if len(cards) != len(codes) {
		return nil, fmt.Errorf("giftCardRepository.CreateBatch: inserted %d of %d cards", len(cards), len(codes))
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("giftCardRepository.CreateBatch commit: %w", err)
	}
	return cards, nil
}

// RedeemAndCredit locks the gift card, marks it redeemed, ensures a wallet
// exists, credits the balance, and writes the wallet_transactions row — all
// inside one transaction so a card can never be burned without a matching credit.
func (r *giftCardRepository) RedeemAndCredit(
	ctx context.Context,
	code string,
	userID int64,
	description string,
) (decimal.Decimal, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return decimal.Zero, fmt.Errorf("giftCardRepository.RedeemAndCredit begin: %w", err)
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
		return decimal.Zero, fmt.Errorf("giftCardRepository.RedeemAndCredit redeem: %w", err)
	}
	if !amount.GreaterThan(decimal.Zero) {
		return decimal.Zero, fmt.Errorf("giftCardRepository.RedeemAndCredit: non-positive amount")
	}

	const walletQ = `
		INSERT INTO wallets (user_id)
		VALUES ($1)
		ON CONFLICT (user_id) DO UPDATE
			SET updated_at = NOW()
		RETURNING id`
	var walletID int64
	if err := tx.QueryRow(ctx, walletQ, userID).Scan(&walletID); err != nil {
		return decimal.Zero, fmt.Errorf("giftCardRepository.RedeemAndCredit wallet: %w", err)
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
		return decimal.Zero, fmt.Errorf("giftCardRepository.RedeemAndCredit credit: %w", err)
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
		return decimal.Zero, fmt.Errorf("giftCardRepository.RedeemAndCredit ledger: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return decimal.Zero, fmt.Errorf("giftCardRepository.RedeemAndCredit commit: %w", err)
	}
	return amount, nil
}

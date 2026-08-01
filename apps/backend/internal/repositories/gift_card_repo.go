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
	// Redeem atomically flips an active card to redeemed and returns its amount.
	// Returns models.ErrNotFound when the code is unknown or already used.
	Redeem(ctx context.Context, code string, userID int64) (decimal.Decimal, error)
	// Reactivate restores a card to active (compensation if a wallet credit fails).
	Reactivate(ctx context.Context, code string) error
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

func (r *giftCardRepository) Redeem(ctx context.Context, code string, userID int64) (decimal.Decimal, error) {
	const q = `
		UPDATE gift_cards
		SET status = 'redeemed', redeemed_by = $2, redeemed_at = NOW()
		WHERE code = $1 AND status = 'active'
		RETURNING initial_amount`
	var amount decimal.Decimal
	if err := r.db.QueryRow(ctx, q, code, userID).Scan(&amount); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return decimal.Zero, models.ErrNotFound
		}
		return decimal.Zero, fmt.Errorf("giftCardRepository.Redeem: %w", err)
	}
	return amount, nil
}

func (r *giftCardRepository) Reactivate(ctx context.Context, code string) error {
	const q = `
		UPDATE gift_cards
		SET status = 'active', redeemed_by = NULL, redeemed_at = NULL
		WHERE code = $1 AND status = 'redeemed'`
	if _, err := r.db.Exec(ctx, q, code); err != nil {
		return fmt.Errorf("giftCardRepository.Reactivate: %w", err)
	}
	return nil
}

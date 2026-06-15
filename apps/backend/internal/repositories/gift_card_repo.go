package repositories

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
)

type GiftCardRepository interface {
	Create(ctx context.Context, code string, amount float64) (*models.GiftCard, error)
	// Redeem atomically flips an active card to redeemed and returns its amount.
	// Returns models.ErrNotFound when the code is unknown or already used.
	Redeem(ctx context.Context, code string, userID int64) (float64, error)
	// Reactivate restores a card to active (compensation if a wallet credit fails).
	Reactivate(ctx context.Context, code string) error
}

type giftCardRepository struct {
	db *pgxpool.Pool
}

func NewGiftCardRepository(db *pgxpool.Pool) GiftCardRepository {
	return &giftCardRepository{db: db}
}

func (r *giftCardRepository) Create(ctx context.Context, code string, amount float64) (*models.GiftCard, error) {
	const q = `
		INSERT INTO gift_cards (code, initial_amount) VALUES ($1, $2)
		ON CONFLICT (code) DO NOTHING
		RETURNING *`
	rows, err := r.db.Query(ctx, q, code, amount)
	if err != nil {
		return nil, fmt.Errorf("giftCardRepository.Create: %w", err)
	}
	gc, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.GiftCard])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrConflict // code collision — caller retries
		}
		return nil, fmt.Errorf("giftCardRepository.Create scan: %w", err)
	}
	return &gc, nil
}

func (r *giftCardRepository) Redeem(ctx context.Context, code string, userID int64) (float64, error) {
	const q = `
		UPDATE gift_cards
		SET status = 'redeemed', redeemed_by = $2, redeemed_at = NOW()
		WHERE code = $1 AND status = 'active'
		RETURNING initial_amount`
	var amount float64
	if err := r.db.QueryRow(ctx, q, code, userID).Scan(&amount); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, models.ErrNotFound
		}
		return 0, fmt.Errorf("giftCardRepository.Redeem: %w", err)
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

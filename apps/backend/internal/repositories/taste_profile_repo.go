package repositories

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
)

type TasteProfileRepository interface {
	Get(ctx context.Context, userID int64) (*models.TastePrefs, error)
	Upsert(ctx context.Context, userID int64, prefs models.TastePrefs) error
}

type tasteProfileRepository struct {
	db *pgxpool.Pool
}

func NewTasteProfileRepository(db *pgxpool.Pool) TasteProfileRepository {
	return &tasteProfileRepository{db: db}
}

func (r *tasteProfileRepository) Get(ctx context.Context, userID int64) (*models.TastePrefs, error) {
	const q = `SELECT prefs FROM taste_profiles WHERE user_id = $1`

	var raw []byte
	if err := r.db.QueryRow(ctx, q, userID).Scan(&raw); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("tasteProfileRepository.Get: %w", err)
	}

	var prefs models.TastePrefs
	if err := json.Unmarshal(raw, &prefs); err != nil {
		return nil, fmt.Errorf("tasteProfileRepository.Get unmarshal: %w", err)
	}
	return &prefs, nil
}

func (r *tasteProfileRepository) Upsert(ctx context.Context, userID int64, prefs models.TastePrefs) error {
	raw, err := json.Marshal(prefs)
	if err != nil {
		return fmt.Errorf("tasteProfileRepository.Upsert marshal: %w", err)
	}

	const q = `
		INSERT INTO taste_profiles (user_id, prefs)
		VALUES ($1, $2)
		ON CONFLICT (user_id) DO UPDATE
			SET prefs = EXCLUDED.prefs, updated_at = NOW()`

	if _, err := r.db.Exec(ctx, q, userID, raw); err != nil {
		return fmt.Errorf("tasteProfileRepository.Upsert: %w", err)
	}
	return nil
}

package site_settings

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
)

// ─────────────────────────────────────────────────────────────
// Interface
// ─────────────────────────────────────────────────────────────

// Repository persists the storefront's single configuration
// document. The table holds exactly one row (id = 1); Get reads it and Update
// writes it under an optimistic revision check.
type Repository interface {
	Get(ctx context.Context) (*SiteSettings, error)
	Update(ctx context.Context, settings SiteSettings, expectedUpdatedAt time.Time) (*SiteSettings, error)
}

// ─────────────────────────────────────────────────────────────
// Struct + constructor
// ─────────────────────────────────────────────────────────────

type repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) Repository {
	return &repository{db: db}
}

// siteSettingsID is the singleton primary key. The table's CHECK (id = 1)
// constraint guarantees there is never more than one row.
const siteSettingsID = 1

// ─────────────────────────────────────────────────────────────
// Get
// ─────────────────────────────────────────────────────────────

func (r *repository) Get(ctx context.Context) (*SiteSettings, error) {
	const q = `SELECT settings, updated_at FROM site_settings WHERE id = $1`

	var (
		raw       []byte
		updatedAt time.Time
	)
	if err := r.db.QueryRow(ctx, q, siteSettingsID).Scan(&raw, &updatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("repository.Get: %w", err)
	}

	var settings SiteSettings
	if err := json.Unmarshal(raw, &settings); err != nil {
		return nil, fmt.Errorf("repository.Get unmarshal: %w", err)
	}
	settings.UpdatedAt = updatedAt
	return &settings, nil
}

// ─────────────────────────────────────────────────────────────
// Update  (lock singleton, compare revision, write)
// ─────────────────────────────────────────────────────────────

func (r *repository) Update(ctx context.Context, settings SiteSettings, expectedUpdatedAt time.Time) (*SiteSettings, error) {
	raw, err := json.Marshal(settings)
	if err != nil {
		return nil, fmt.Errorf("repository.Update marshal: %w", err)
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("repository.Update begin: %w", err)
	}
	defer tx.Rollback(ctx)

	var matches bool
	if err := tx.QueryRow(ctx, `
		SELECT updated_at = $2
		FROM site_settings
		WHERE id = $1
		FOR UPDATE`, siteSettingsID, expectedUpdatedAt).Scan(&matches); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("repository.Update lock: %w", err)
	}
	if !matches {
		return nil, models.ErrConflict
	}

	const q = `
		UPDATE site_settings
		SET settings = @settings
		WHERE id = @id AND updated_at = @expected_updated_at
		RETURNING settings, updated_at`

	args := pgx.NamedArgs{
		"id":                  siteSettingsID,
		"settings":            raw,
		"expected_updated_at": expectedUpdatedAt,
	}

	var (
		outRaw    []byte
		updatedAt time.Time
	)
	if err := tx.QueryRow(ctx, q, args).Scan(&outRaw, &updatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrConflict
		}
		return nil, fmt.Errorf("repository.Update: %w", err)
	}

	var out SiteSettings
	if err := json.Unmarshal(outRaw, &out); err != nil {
		return nil, fmt.Errorf("repository.Update unmarshal: %w", err)
	}
	out.UpdatedAt = updatedAt

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("repository.Update commit: %w", err)
	}
	return &out, nil
}

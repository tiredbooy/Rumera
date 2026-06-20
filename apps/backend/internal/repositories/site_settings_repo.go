// internal/repositories/site_settings_repo.go
package repositories

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

// SiteSettingsRepository persists the storefront's single configuration
// document. The table holds exactly one row (id = 1); Get reads it and Update
// upserts it.
type SiteSettingsRepository interface {
	Get(ctx context.Context) (*models.SiteSettings, error)
	Update(ctx context.Context, settings models.SiteSettings) (*models.SiteSettings, error)
}

// ─────────────────────────────────────────────────────────────
// Struct + constructor
// ─────────────────────────────────────────────────────────────

type siteSettingsRepository struct {
	db *pgxpool.Pool
}

func NewSiteSettingsRepository(db *pgxpool.Pool) SiteSettingsRepository {
	return &siteSettingsRepository{db: db}
}

// siteSettingsID is the singleton primary key. The table's CHECK (id = 1)
// constraint guarantees there is never more than one row.
const siteSettingsID = 1

// ─────────────────────────────────────────────────────────────
// Get
// ─────────────────────────────────────────────────────────────

func (r *siteSettingsRepository) Get(ctx context.Context) (*models.SiteSettings, error) {
	const q = `SELECT settings, updated_at FROM site_settings WHERE id = $1`

	var (
		raw       []byte
		updatedAt time.Time
	)
	if err := r.db.QueryRow(ctx, q, siteSettingsID).Scan(&raw, &updatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("siteSettingsRepository.Get: %w", err)
	}

	var settings models.SiteSettings
	if err := json.Unmarshal(raw, &settings); err != nil {
		return nil, fmt.Errorf("siteSettingsRepository.Get unmarshal: %w", err)
	}
	settings.UpdatedAt = updatedAt
	return &settings, nil
}

// ─────────────────────────────────────────────────────────────
// Update  (upsert the singleton document)
// ─────────────────────────────────────────────────────────────

func (r *siteSettingsRepository) Update(ctx context.Context, settings models.SiteSettings) (*models.SiteSettings, error) {
	raw, err := json.Marshal(settings)
	if err != nil {
		return nil, fmt.Errorf("siteSettingsRepository.Update marshal: %w", err)
	}

	const q = `
		INSERT INTO site_settings (id, settings)
		VALUES (@id, @settings)
		ON CONFLICT (id) DO UPDATE
			SET settings = EXCLUDED.settings
		RETURNING settings, updated_at`

	args := pgx.NamedArgs{
		"id":       siteSettingsID,
		"settings": raw,
	}

	var (
		outRaw    []byte
		updatedAt time.Time
	)
	if err := r.db.QueryRow(ctx, q, args).Scan(&outRaw, &updatedAt); err != nil {
		return nil, fmt.Errorf("siteSettingsRepository.Update: %w", err)
	}

	var out models.SiteSettings
	if err := json.Unmarshal(outRaw, &out); err != nil {
		return nil, fmt.Errorf("siteSettingsRepository.Update unmarshal: %w", err)
	}
	out.UpdatedAt = updatedAt
	return &out, nil
}

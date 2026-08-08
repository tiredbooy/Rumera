package repositories

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
)

type CapabilityRepository interface {
	GetByRole(ctx context.Context, role string) ([]string, error)
	ListPanelRoles(ctx context.Context) ([]models.RoleCapabilities, error)
	Replace(ctx context.Context, role string, permissions []string) error
}

type capabilityRepository struct {
	db *pgxpool.Pool
}

func NewCapabilityRepository(db *pgxpool.Pool) CapabilityRepository {
	return &capabilityRepository{db: db}
}

func (r *capabilityRepository) GetByRole(ctx context.Context, role string) ([]string, error) {
	const q = `SELECT permissions FROM role_capabilities WHERE role = $1`
	var perms []string
	err := r.db.QueryRow(ctx, q, role).Scan(&perms)
	if err != nil {
		if err == pgx.ErrNoRows {
			return []string{}, nil
		}
		return nil, fmt.Errorf("capabilityRepository.GetByRole: %w", err)
	}
	if perms == nil {
		return []string{}, nil
	}
	return perms, nil
}

func (r *capabilityRepository) ListPanelRoles(ctx context.Context) ([]models.RoleCapabilities, error) {
	const q = `
		SELECT role, permissions
		FROM role_capabilities
		WHERE role IN ('admin', 'staff')
		ORDER BY role ASC`
	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("capabilityRepository.ListPanelRoles: %w", err)
	}
	defer rows.Close()

	out := make([]models.RoleCapabilities, 0, 2)
	for rows.Next() {
		var item models.RoleCapabilities
		var perms []string
		if err := rows.Scan(&item.Role, &perms); err != nil {
			return nil, fmt.Errorf("capabilityRepository.ListPanelRoles scan: %w", err)
		}
		if perms == nil {
			perms = []string{}
		}
		item.Permissions = perms
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *capabilityRepository) Replace(ctx context.Context, role string, permissions []string) error {
	if permissions == nil {
		permissions = []string{}
	}
	const q = `
		INSERT INTO role_capabilities (role, permissions, updated_at)
		VALUES ($1, $2, $3)
		ON CONFLICT (role) DO UPDATE
			SET permissions = EXCLUDED.permissions,
			    updated_at  = EXCLUDED.updated_at`
	_, err := r.db.Exec(ctx, q, role, permissions, time.Now().UTC())
	if err != nil {
		return fmt.Errorf("capabilityRepository.Replace: %w", err)
	}
	return nil
}

package rbac

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Repository persists panel role → capability mappings.
type Repository interface {
	GetByRole(ctx context.Context, role string) ([]string, error)
	ListPanelRoles(ctx context.Context) ([]RoleCapabilities, error)
	Replace(ctx context.Context, role string, permissions []string) error
}

type repository struct {
	db *pgxpool.Pool
}

// NewRepository constructs a Postgres-backed capability repository.
func NewRepository(db *pgxpool.Pool) Repository {
	return &repository{db: db}
}

func (r *repository) GetByRole(ctx context.Context, role string) ([]string, error) {
	const q = `SELECT permissions FROM role_capabilities WHERE role = $1`
	var perms []string
	err := r.db.QueryRow(ctx, q, role).Scan(&perms)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return []string{}, nil
		}
		return nil, fmt.Errorf("rbac.Repository.GetByRole: %w", err)
	}
	if perms == nil {
		return []string{}, nil
	}
	return perms, nil
}

func (r *repository) ListPanelRoles(ctx context.Context) ([]RoleCapabilities, error) {
	const q = `
		SELECT role, permissions
		FROM role_capabilities
		WHERE role IN ('admin', 'staff')
		ORDER BY role ASC`
	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("rbac.Repository.ListPanelRoles: %w", err)
	}
	defer rows.Close()

	out := make([]RoleCapabilities, 0, 2)
	for rows.Next() {
		var item RoleCapabilities
		var perms []string
		if err := rows.Scan(&item.Role, &perms); err != nil {
			return nil, fmt.Errorf("rbac.Repository.ListPanelRoles scan: %w", err)
		}
		if perms == nil {
			perms = []string{}
		}
		item.Permissions = perms
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *repository) Replace(ctx context.Context, role string, permissions []string) error {
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
		return fmt.Errorf("rbac.Repository.Replace: %w", err)
	}
	return nil
}

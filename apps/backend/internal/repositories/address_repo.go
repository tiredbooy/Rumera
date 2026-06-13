// internal/repositories/address_repository.go
package repositories

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
)

// ─────────────────────────────────────────────────────────────
// Interface
// ─────────────────────────────────────────────────────────────

type AddressRepository interface {
	Create(ctx context.Context, userID int64, req models.CreateAddressReq) (*models.Address, error)
	GetByID(ctx context.Context, id int64, userID int64) (*models.Address, error)
	GetAllByUserID(ctx context.Context, userID int64) ([]*models.Address, error)
	Update(ctx context.Context, id int64, userID int64, req models.UpdateAddressReq) (*models.Address, error)
	Delete(ctx context.Context, id int64, userID int64) error
	SetDefault(ctx context.Context, id int64, userID int64) error
}

// ─────────────────────────────────────────────────────────────
// Struct + constructor
// ─────────────────────────────────────────────────────────────

type addressRepository struct {
	db *pgxpool.Pool
}

func NewAddressRepository(db *pgxpool.Pool) AddressRepository {
	return &addressRepository{db: db}
}

func (r *addressRepository) Create(ctx context.Context, userID int64, req models.CreateAddressReq) (*models.Address, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("addressRepository.Create begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	if req.IsDefault {
		if err := unsetDefault(ctx, tx, userID); err != nil {
			return nil, err
		}
	}

	const q = `
		INSERT INTO addresses (
			user_id, title, full_name, phone_number,
			address_line1, address_line2,
			city, state_province, postal_code, country,
			is_default
		) VALUES (
			@user_id, @title, @full_name, @phone_number,
			@address_line1, @address_line2,
			@city, @state_province, @postal_code, @country,
			@is_default
		)
		RETURNING *`

	args := pgx.NamedArgs{
		"user_id":        userID,
		"title":          req.Title,
		"full_name":      req.FullName,
		"phone_number":   req.PhoneNumber,
		"address_line1":  req.AddressLine1,
		"address_line2":  req.AddressLine2,
		"city":           req.City,
		"state_province": req.StateProvince,
		"postal_code":    req.PostalCode,
		"country":        req.Country,
		"is_default":     req.IsDefault,
	}

	rows, err := tx.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("addressRepository.Create insert: %w", err)
	}

	address, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.Address])
	if err != nil {
		return nil, fmt.Errorf("addressRepository.Create scan: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("addressRepository.Create commit: %w", err)
	}

	return &address, nil
}

// ─────────────────────────────────────────────────────────────
// GetByID
// userID is always scoped in the WHERE clause — a user can never
// fetch another user's address even if they know the ID.
// ─────────────────────────────────────────────────────────────

func (r *addressRepository) GetByID(ctx context.Context, id int64, userID int64) (*models.Address, error) {
	const q = `SELECT * FROM addresses WHERE id = $1 AND user_id = $2`

	rows, err := r.db.Query(ctx, q, id, userID)
	if err != nil {
		return nil, fmt.Errorf("addressRepository.GetByID: %w", err)
	}

	address, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.Address])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("addressRepository.GetByID scan: %w", err)
	}
	return &address, nil
}

// ─────────────────────────────────────────────────────────────
// GetAllByUserID
// No pagination — a user realistically has < 10 addresses.
// Default address is always sorted first.
// ─────────────────────────────────────────────────────────────

func (r *addressRepository) GetAllByUserID(ctx context.Context, userID int64) ([]*models.Address, error) {
	const q = `
		SELECT * FROM addresses
		WHERE user_id = $1
		ORDER BY is_default DESC, created_at DESC`

	rows, err := r.db.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("addressRepository.GetAllByUserID: %w", err)
	}
	defer rows.Close()

	addresses, err := pgx.CollectRows(rows, pgx.RowToStructByName[models.Address])
	if err != nil {
		return nil, fmt.Errorf("addressRepository.GetAllByUserID scan: %w", err)
	}

	result := make([]*models.Address, len(addresses))
	for i := range addresses {
		result[i] = &addresses[i]
	}
	return result, nil
}

// ─────────────────────────────────────────────────────────────
// Update  (PATCH — only non-nil fields applied)
// If is_default is flipped to true, old default is unset first.
// ─────────────────────────────────────────────────────────────

func (r *addressRepository) Update(ctx context.Context, id int64, userID int64, req models.UpdateAddressReq) (*models.Address, error) {
	sets := []string{}
	args := pgx.NamedArgs{
		"id":      id,
		"user_id": userID,
	}

	if req.Title != nil {
		sets = append(sets, "title = @title")
		args["title"] = *req.Title
	}
	if req.FullName != nil {
		sets = append(sets, "full_name = @full_name")
		args["full_name"] = *req.FullName
	}
	if req.PhoneNumber != nil {
		sets = append(sets, "phone_number = @phone_number")
		args["phone_number"] = *req.PhoneNumber
	}
	if req.AddressLine1 != nil {
		sets = append(sets, "address_line1 = @address_line1")
		args["address_line1"] = *req.AddressLine1
	}
	if req.AddressLine2 != nil {
		sets = append(sets, "address_line2 = @address_line2")
		args["address_line2"] = *req.AddressLine2
	}
	if req.City != nil {
		sets = append(sets, "city = @city")
		args["city"] = *req.City
	}
	if req.StateProvince != nil {
		sets = append(sets, "state_province = @state_province")
		args["state_province"] = *req.StateProvince
	}
	if req.PostalCode != nil {
		sets = append(sets, "postal_code = @postal_code")
		args["postal_code"] = *req.PostalCode
	}
	if req.Country != nil {
		sets = append(sets, "country = @country")
		args["country"] = *req.Country
	}
	if req.IsDefault != nil {
		sets = append(sets, "is_default = @is_default")
		args["is_default"] = *req.IsDefault
	}

	if len(sets) == 0 {
		return r.GetByID(ctx, id, userID)
	}

	// If setting as default we need a transaction to unset the old one
	if req.IsDefault != nil && *req.IsDefault {
		return r.updateWithDefaultTx(ctx, id, userID, sets, args)
	}

	q := fmt.Sprintf(`
		UPDATE addresses SET %s
		WHERE id = @id AND user_id = @user_id
		RETURNING *`,
		strings.Join(sets, ", "),
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("addressRepository.Update: %w", err)
	}

	address, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.Address])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("addressRepository.Update scan: %w", err)
	}
	return &address, nil
}

// updateWithDefaultTx is an internal helper — Update calls this when
// is_default is being set to true, requiring a transaction.
func (r *addressRepository) updateWithDefaultTx(ctx context.Context, id int64, userID int64, sets []string, args pgx.NamedArgs) (*models.Address, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("addressRepository.Update begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	if err := unsetDefault(ctx, tx, userID); err != nil {
		return nil, err
	}

	q := fmt.Sprintf(`
		UPDATE addresses SET %s
		WHERE id = @id AND user_id = @user_id
		RETURNING *`,
		strings.Join(sets, ", "),
	)

	rows, err := tx.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("addressRepository.Update tx: %w", err)
	}

	address, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.Address])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("addressRepository.Update tx scan: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("addressRepository.Update commit: %w", err)
	}
	return &address, nil
}

// ─────────────────────────────────────────────────────────────
// Delete
// If the deleted address was the default, the service should
// prompt the user to pick a new default — repo doesn't decide.
// ─────────────────────────────────────────────────────────────

func (r *addressRepository) Delete(ctx context.Context, id int64, userID int64) error {
	const q = `DELETE FROM addresses WHERE id = $1 AND user_id = $2`

	res, err := r.db.Exec(ctx, q, id, userID)
	if err != nil {
		return fmt.Errorf("addressRepository.Delete: %w", err)
	}
	if res.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}

// ─────────────────────────────────────────────────────────────
// SetDefault
// Dedicated method for "set this as my default address" —
// cleaner than going through Update when that's the only intent.
// ─────────────────────────────────────────────────────────────

func (r *addressRepository) SetDefault(ctx context.Context, id int64, userID int64) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("addressRepository.SetDefault begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	if err := unsetDefault(ctx, tx, userID); err != nil {
		return err
	}

	const q = `
		UPDATE addresses SET is_default = true
		WHERE id = $1 AND user_id = $2`

	res, err := tx.Exec(ctx, q, id, userID)
	if err != nil {
		return fmt.Errorf("addressRepository.SetDefault: %w", err)
	}
	if res.RowsAffected() == 0 {
		return models.ErrNotFound
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("addressRepository.SetDefault commit: %w", err)
	}
	return nil
}

// ─────────────────────────────────────────────────────────────
// unsetDefault — shared internal helper
// Clears is_default for all addresses belonging to a user.
// Always called inside a transaction before setting a new default.
// ─────────────────────────────────────────────────────────────

func unsetDefault(ctx context.Context, tx pgx.Tx, userID int64) error {
	const q = `UPDATE addresses SET is_default = false WHERE user_id = $1 AND is_default = true`
	if _, err := tx.Exec(ctx, q, userID); err != nil {
		return fmt.Errorf("addressRepository.unsetDefault: %w", err)
	}
	return nil
}

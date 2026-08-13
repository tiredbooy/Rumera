package option

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
)

const (
	optionTypeColumns  = `id, title, display_name, created_at, updated_at`
	optionValueColumns = `id, option_type_id, value, sort_order, created_at, updated_at`
)

type Repository interface {
	CreateType(ctx context.Context, req CreateOptionTypeReq) (*OptionType, error)
	GetType(ctx context.Context, id int64) (*OptionType, error)
	ListTypes(ctx context.Context) ([]*OptionType, error)
	UpdateType(ctx context.Context, id int64, req UpdateOptionTypeReq) (*OptionType, error)
	DeleteType(ctx context.Context, id int64) error

	CreateValue(ctx context.Context, optionTypeID int64, req CreateOptionValueReq) (*OptionValue, error)
	GetValue(ctx context.Context, id int64) (*OptionValue, error)
	ListValues(ctx context.Context, optionTypeID int64) ([]*OptionValue, error)
	UpdateValue(ctx context.Context, id int64, req UpdateOptionValueReq) (*OptionValue, error)
	DeleteValue(ctx context.Context, id int64) error
}

type repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) Repository {
	return &repository{db: db}
}

func (r *repository) CreateType(ctx context.Context, req CreateOptionTypeReq) (*OptionType, error) {
	const q = `
		INSERT INTO option_types (title, display_name)
		VALUES ($1, $2)
		RETURNING ` + optionTypeColumns
	optionType, err := scanOptionType(r.db.QueryRow(ctx, q, req.Title, req.DisplayName))
	if err != nil {
		if isUniqueViolation(err) {
			return nil, models.ErrConflict
		}
		return nil, fmt.Errorf("repository.CreateType: %w", err)
	}
	return optionType, nil
}

func (r *repository) GetType(ctx context.Context, id int64) (*OptionType, error) {
	optionType, err := scanOptionType(r.db.QueryRow(ctx,
		`SELECT `+optionTypeColumns+` FROM option_types WHERE id = $1`, id,
	))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("repository.GetType: %w", err)
	}
	return optionType, nil
}

func (r *repository) ListTypes(ctx context.Context) ([]*OptionType, error) {
	rows, err := r.db.Query(ctx,
		`SELECT `+optionTypeColumns+` FROM option_types ORDER BY display_name, id`,
	)
	if err != nil {
		return nil, fmt.Errorf("repository.ListTypes: %w", err)
	}
	defer rows.Close()

	result := make([]*OptionType, 0)
	for rows.Next() {
		optionType, err := scanOptionType(rows)
		if err != nil {
			return nil, fmt.Errorf("repository.ListTypes scan: %w", err)
		}
		result = append(result, optionType)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("repository.ListTypes rows: %w", err)
	}
	return result, nil
}

func (r *repository) UpdateType(ctx context.Context, id int64, req UpdateOptionTypeReq) (*OptionType, error) {
	sets := make([]string, 0, 2)
	args := pgx.NamedArgs{"id": id}
	if req.Title != nil {
		sets = append(sets, "title = @title")
		args["title"] = *req.Title
	}
	if req.DisplayName != nil {
		sets = append(sets, "display_name = @display_name")
		args["display_name"] = *req.DisplayName
	}
	if len(sets) == 0 {
		return r.GetType(ctx, id)
	}

	q := fmt.Sprintf(`UPDATE option_types SET %s WHERE id = @id RETURNING %s`,
		strings.Join(sets, ", "), optionTypeColumns)
	optionType, err := scanOptionType(r.db.QueryRow(ctx, q, args))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		if isUniqueViolation(err) {
			return nil, models.ErrConflict
		}
		return nil, fmt.Errorf("repository.UpdateType: %w", err)
	}
	return optionType, nil
}

func (r *repository) DeleteType(ctx context.Context, id int64) error {
	res, err := r.db.Exec(ctx, `DELETE FROM option_types WHERE id = $1`, id)
	if err != nil {
		if isOptionForeignKeyViolation(err) {
			return models.ErrConflict
		}
		return fmt.Errorf("repository.DeleteType: %w", err)
	}
	if res.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}

func (r *repository) CreateValue(ctx context.Context, optionTypeID int64, req CreateOptionValueReq) (*OptionValue, error) {
	const q = `
		INSERT INTO option_values (option_type_id, value, sort_order)
		VALUES ($1, $2, $3)
		RETURNING ` + optionValueColumns
	value, err := scanOptionValue(r.db.QueryRow(ctx, q, optionTypeID, req.Value, req.SortOrder))
	if err != nil {
		if isUniqueViolation(err) {
			return nil, models.ErrConflict
		}
		if isOptionForeignKeyViolation(err) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("repository.CreateValue: %w", err)
	}
	return value, nil
}

func (r *repository) GetValue(ctx context.Context, id int64) (*OptionValue, error) {
	value, err := scanOptionValue(r.db.QueryRow(ctx,
		`SELECT `+optionValueColumns+` FROM option_values WHERE id = $1`, id,
	))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("repository.GetValue: %w", err)
	}
	return value, nil
}

func (r *repository) ListValues(ctx context.Context, optionTypeID int64) ([]*OptionValue, error) {
	rows, err := r.db.Query(ctx, `
		SELECT `+optionValueColumns+`
		FROM option_values
		WHERE option_type_id = $1
		ORDER BY sort_order, value, id`, optionTypeID)
	if err != nil {
		return nil, fmt.Errorf("repository.ListValues: %w", err)
	}
	defer rows.Close()

	result := make([]*OptionValue, 0)
	for rows.Next() {
		value, err := scanOptionValue(rows)
		if err != nil {
			return nil, fmt.Errorf("repository.ListValues scan: %w", err)
		}
		result = append(result, value)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("repository.ListValues rows: %w", err)
	}
	return result, nil
}

func (r *repository) UpdateValue(ctx context.Context, id int64, req UpdateOptionValueReq) (*OptionValue, error) {
	sets := make([]string, 0, 2)
	args := pgx.NamedArgs{"id": id}
	if req.Value != nil {
		sets = append(sets, "value = @value")
		args["value"] = *req.Value
	}
	if req.SortOrder != nil {
		sets = append(sets, "sort_order = @sort_order")
		args["sort_order"] = *req.SortOrder
	}
	if len(sets) == 0 {
		return r.GetValue(ctx, id)
	}

	q := fmt.Sprintf(`UPDATE option_values SET %s WHERE id = @id RETURNING %s`,
		strings.Join(sets, ", "), optionValueColumns)
	value, err := scanOptionValue(r.db.QueryRow(ctx, q, args))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		if isUniqueViolation(err) {
			return nil, models.ErrConflict
		}
		return nil, fmt.Errorf("repository.UpdateValue: %w", err)
	}
	return value, nil
}

func (r *repository) DeleteValue(ctx context.Context, id int64) error {
	res, err := r.db.Exec(ctx, `DELETE FROM option_values WHERE id = $1`, id)
	if err != nil {
		if isOptionForeignKeyViolation(err) {
			return models.ErrConflict
		}
		return fmt.Errorf("repository.DeleteValue: %w", err)
	}
	if res.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}

type optionScanner interface {
	Scan(dest ...any) error
}

func scanOptionType(row optionScanner) (*OptionType, error) {
	var value OptionType
	if err := row.Scan(&value.ID, &value.Title, &value.DisplayName, &value.CreatedAt, &value.UpdatedAt); err != nil {
		return nil, err
	}
	return &value, nil
}

func scanOptionValue(row optionScanner) (*OptionValue, error) {
	var value OptionValue
	if err := row.Scan(
		&value.ID, &value.OptionTypeID, &value.Value, &value.SortOrder, &value.CreatedAt, &value.UpdatedAt,
	); err != nil {
		return nil, err
	}
	return &value, nil
}

func isOptionForeignKeyViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23503"
}

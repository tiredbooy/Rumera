package repositories

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

type OptionRepository interface {
	CreateType(ctx context.Context, req models.CreateOptionTypeReq) (*models.OptionType, error)
	GetType(ctx context.Context, id int64) (*models.OptionType, error)
	ListTypes(ctx context.Context) ([]*models.OptionType, error)
	UpdateType(ctx context.Context, id int64, req models.UpdateOptionTypeReq) (*models.OptionType, error)
	DeleteType(ctx context.Context, id int64) error

	CreateValue(ctx context.Context, optionTypeID int64, req models.CreateOptionValueReq) (*models.OptionValue, error)
	GetValue(ctx context.Context, id int64) (*models.OptionValue, error)
	ListValues(ctx context.Context, optionTypeID int64) ([]*models.OptionValue, error)
	UpdateValue(ctx context.Context, id int64, req models.UpdateOptionValueReq) (*models.OptionValue, error)
	DeleteValue(ctx context.Context, id int64) error
}

type optionRepository struct {
	db *pgxpool.Pool
}

func NewOptionRepository(db *pgxpool.Pool) OptionRepository {
	return &optionRepository{db: db}
}

func (r *optionRepository) CreateType(ctx context.Context, req models.CreateOptionTypeReq) (*models.OptionType, error) {
	const q = `
		INSERT INTO option_types (title, display_name)
		VALUES ($1, $2)
		RETURNING ` + optionTypeColumns
	optionType, err := scanOptionType(r.db.QueryRow(ctx, q, req.Title, req.DisplayName))
	if err != nil {
		if isUniqueViolation(err) {
			return nil, models.ErrConflict
		}
		return nil, fmt.Errorf("optionRepository.CreateType: %w", err)
	}
	return optionType, nil
}

func (r *optionRepository) GetType(ctx context.Context, id int64) (*models.OptionType, error) {
	optionType, err := scanOptionType(r.db.QueryRow(ctx,
		`SELECT `+optionTypeColumns+` FROM option_types WHERE id = $1`, id,
	))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("optionRepository.GetType: %w", err)
	}
	return optionType, nil
}

func (r *optionRepository) ListTypes(ctx context.Context) ([]*models.OptionType, error) {
	rows, err := r.db.Query(ctx,
		`SELECT `+optionTypeColumns+` FROM option_types ORDER BY display_name, id`,
	)
	if err != nil {
		return nil, fmt.Errorf("optionRepository.ListTypes: %w", err)
	}
	defer rows.Close()

	result := make([]*models.OptionType, 0)
	for rows.Next() {
		optionType, err := scanOptionType(rows)
		if err != nil {
			return nil, fmt.Errorf("optionRepository.ListTypes scan: %w", err)
		}
		result = append(result, optionType)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("optionRepository.ListTypes rows: %w", err)
	}
	return result, nil
}

func (r *optionRepository) UpdateType(ctx context.Context, id int64, req models.UpdateOptionTypeReq) (*models.OptionType, error) {
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
		return nil, fmt.Errorf("optionRepository.UpdateType: %w", err)
	}
	return optionType, nil
}

func (r *optionRepository) DeleteType(ctx context.Context, id int64) error {
	res, err := r.db.Exec(ctx, `DELETE FROM option_types WHERE id = $1`, id)
	if err != nil {
		if isOptionForeignKeyViolation(err) {
			return models.ErrConflict
		}
		return fmt.Errorf("optionRepository.DeleteType: %w", err)
	}
	if res.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}

func (r *optionRepository) CreateValue(ctx context.Context, optionTypeID int64, req models.CreateOptionValueReq) (*models.OptionValue, error) {
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
		return nil, fmt.Errorf("optionRepository.CreateValue: %w", err)
	}
	return value, nil
}

func (r *optionRepository) GetValue(ctx context.Context, id int64) (*models.OptionValue, error) {
	value, err := scanOptionValue(r.db.QueryRow(ctx,
		`SELECT `+optionValueColumns+` FROM option_values WHERE id = $1`, id,
	))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("optionRepository.GetValue: %w", err)
	}
	return value, nil
}

func (r *optionRepository) ListValues(ctx context.Context, optionTypeID int64) ([]*models.OptionValue, error) {
	rows, err := r.db.Query(ctx, `
		SELECT `+optionValueColumns+`
		FROM option_values
		WHERE option_type_id = $1
		ORDER BY sort_order, value, id`, optionTypeID)
	if err != nil {
		return nil, fmt.Errorf("optionRepository.ListValues: %w", err)
	}
	defer rows.Close()

	result := make([]*models.OptionValue, 0)
	for rows.Next() {
		value, err := scanOptionValue(rows)
		if err != nil {
			return nil, fmt.Errorf("optionRepository.ListValues scan: %w", err)
		}
		result = append(result, value)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("optionRepository.ListValues rows: %w", err)
	}
	return result, nil
}

func (r *optionRepository) UpdateValue(ctx context.Context, id int64, req models.UpdateOptionValueReq) (*models.OptionValue, error) {
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
		return nil, fmt.Errorf("optionRepository.UpdateValue: %w", err)
	}
	return value, nil
}

func (r *optionRepository) DeleteValue(ctx context.Context, id int64) error {
	res, err := r.db.Exec(ctx, `DELETE FROM option_values WHERE id = $1`, id)
	if err != nil {
		if isOptionForeignKeyViolation(err) {
			return models.ErrConflict
		}
		return fmt.Errorf("optionRepository.DeleteValue: %w", err)
	}
	if res.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}

type optionScanner interface {
	Scan(dest ...any) error
}

func scanOptionType(row optionScanner) (*models.OptionType, error) {
	var value models.OptionType
	if err := row.Scan(&value.ID, &value.Title, &value.DisplayName, &value.CreatedAt, &value.UpdatedAt); err != nil {
		return nil, err
	}
	return &value, nil
}

func scanOptionValue(row optionScanner) (*models.OptionValue, error) {
	var value models.OptionValue
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

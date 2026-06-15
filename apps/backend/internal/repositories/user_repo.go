package repositories

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
)

type UserRepository interface {
	Create(ctx context.Context, req models.CreateUserReq, passwordHash string) (*models.User, error)
	// CreatePhone creates a phone-only customer (no password). The caller supplies
	// a synthetic, unique email to satisfy the NOT NULL/UNIQUE email column.
	CreatePhone(ctx context.Context, phone, email string) (*models.User, error)
	GetByID(ctx context.Context, userID uuid.UUID) (*models.User, error)
	GetByEmail(ctx context.Context, email string) (*models.User, error)
	GetByPhone(ctx context.Context, phone string) (*models.User, error)
	GetAll(ctx context.Context, filter models.UserFilter) ([]*models.User, int64, error)
	Update(ctx context.Context, userID uuid.UUID, req models.UpdateUserReq) (*models.User, error)
	Delete(ctx context.Context, userID uuid.UUID) error
	ExistsByEmail(ctx context.Context, email string) (bool, error)
	ExistsByID(ctx context.Context, userID uuid.UUID) (bool, error)
}

type userRepository struct {
	db *pgxpool.Pool
}

func NewUserRepository(db *pgxpool.Pool) UserRepository {
	return &userRepository{db: db}
}

func (r *userRepository) Create(ctx context.Context, req models.CreateUserReq, passwordHash string) (*models.User, error) {
	const q = `
		INSERT INTO users (
			user_id, first_name, last_name, email, password_hash,
			phone, national_code, birth_date, gender, role, is_active
		) VALUES (
			gen_random_uuid(), @first_name, @last_name, @email, @password_hash,
			@phone, @national_code, @birth_date, @gender, @role, true
		)
		RETURNING *`

	args := pgx.NamedArgs{
		"first_name":    req.FirstName,
		"last_name":     req.LastName,
		"email":         req.Email,
		"password_hash": passwordHash,
		"phone":         req.Phone,
		"national_code": req.NationalCode,
		"birth_date":    req.BirthDate,
		"gender":        req.Gender,
		"role":          req.Role,
	}

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("userRepository.Create: %w", err)
	}

	user, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.User])
	if err != nil {
		return nil, fmt.Errorf("userRepository.Create scan: %w", err)
	}
	return &user, nil
}

func (r *userRepository) CreatePhone(ctx context.Context, phone, email string) (*models.User, error) {
	const q = `
		INSERT INTO users (user_id, email, phone, role, is_active)
		VALUES (gen_random_uuid(), @email, @phone, 'customer', true)
		RETURNING *`

	args := pgx.NamedArgs{"email": email, "phone": phone}

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("userRepository.CreatePhone: %w", err)
	}

	user, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.User])
	if err != nil {
		return nil, fmt.Errorf("userRepository.CreatePhone scan: %w", err)
	}
	return &user, nil
}

func (r *userRepository) GetByPhone(ctx context.Context, phone string) (*models.User, error) {
	const q = `SELECT * FROM users WHERE phone = $1 AND is_active = true`

	rows, err := r.db.Query(ctx, q, phone)
	if err != nil {
		return nil, fmt.Errorf("userRepository.GetByPhone: %w", err)
	}

	user, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.User])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("userRepository.GetByPhone scan: %w", err)
	}
	return &user, nil
}

func (r *userRepository) GetByID(ctx context.Context, userID uuid.UUID) (*models.User, error) {
	const q = `SELECT * FROM users WHERE user_id = $1 AND is_active = true`

	rows, err := r.db.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("userRepository.GetByID: %w", err)
	}

	user, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.User])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("userRepository.GetByID scan: %w", err)
	}
	return &user, nil
}

// ─────────────────────────────────────────────────────────────
// GetByEmail
// ─────────────────────────────────────────────────────────────

func (r *userRepository) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	const q = `SELECT * FROM users WHERE email = $1 AND is_active = true`

	rows, err := r.db.Query(ctx, q, email)
	if err != nil {
		return nil, fmt.Errorf("userRepository.GetByEmail: %w", err)
	}

	user, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.User])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("userRepository.GetByEmail scan: %w", err)
	}
	return &user, nil
}

func (r *userRepository) GetAll(ctx context.Context, f models.UserFilter) ([]*models.User, int64, error) {
	where := []string{"is_active = true"}
	args := pgx.NamedArgs{}

	if f.Role != nil {
		where = append(where, "role = @role")
		args["role"] = *f.Role
	}
	if f.IsActive != nil {
		where = append(where, "is_active = @is_active")
		args["is_active"] = *f.IsActive
	}
	if f.Gender != nil {
		where = append(where, "gender = @gender")
		args["gender"] = *f.Gender
	}
	if f.CreatedFrom != nil {
		where = append(where, "created_at >= @created_from")
		args["created_from"] = *f.CreatedFrom
	}
	if f.CreatedTo != nil {
		where = append(where, "created_at <= @created_to")
		args["created_to"] = *f.CreatedTo
	}
	if f.Search != "" {
		where = append(where, "(first_name ILIKE @search OR last_name ILIKE @search OR email ILIKE @search)")
		args["search"] = "%" + f.Search + "%"
	}

	allowed := map[string]bool{
		"created_at": true,
		"email":      true,
		"first_name": true,
		"last_name":  true,
	}
	sortBy := "created_at"
	if allowed[f.SortBy] {
		sortBy = f.SortBy
	}
	order := "DESC"
	if strings.ToUpper(f.OrderBy) == "ASC" {
		order = "ASC"
	}

	args["limit"] = f.Limit
	args["offset"] = f.Offset()

	q := fmt.Sprintf(`
		SELECT *, COUNT(*) OVER() AS total_count
		FROM users
		WHERE %s
		ORDER BY %s %s
		LIMIT @limit OFFSET @offset`,
		strings.Join(where, " AND "), sortBy, order,
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, 0, fmt.Errorf("userRepository.GetAll: %w", err)
	}
	defer rows.Close()

	var (
		users []*models.User
		total int64
	)

	for rows.Next() {
		var user models.User

		if err := rows.Scan(
			&user.ID, &user.UserID,
			&user.FirstName, &user.LastName,
			&user.Email, &user.PasswordHash,
			&user.Phone, &user.NationalCode,
			&user.BirthDate, &user.Gender,
			&user.OAuthProvider, &user.OAuthID,
			&user.Role, &user.IsActive,
			&user.EmailVerifiedAt, &user.LastLoginAt,
			&user.CreatedAt, &user.UpdatedAt,
			&total, // COUNT(*) OVER()
		); err != nil {
			return nil, 0, fmt.Errorf("userRepository.GetAll scan: %w", err)
		}
		users = append(users, &user)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("userRepository.GetAll rows: %w", err)
	}

	return users, total, nil
}

func (r *userRepository) Update(ctx context.Context, userID uuid.UUID, req models.UpdateUserReq) (*models.User, error) {
	sets := []string{}
	args := pgx.NamedArgs{"user_id": userID}

	if req.FirstName != nil {
		sets = append(sets, "first_name = @first_name")
		args["first_name"] = *req.FirstName
	}
	if req.LastName != nil {
		sets = append(sets, "last_name = @last_name")
		args["last_name"] = *req.LastName
	}
	if req.Phone != nil {
		sets = append(sets, "phone = @phone")
		args["phone"] = *req.Phone
	}
	if req.NationalCode != nil {
		sets = append(sets, "national_code = @national_code")
		args["national_code"] = *req.NationalCode
	}
	if req.BirthDate != nil {
		sets = append(sets, "birth_date = @birth_date")
		args["birth_date"] = *req.BirthDate
	}
	if req.Gender != nil {
		sets = append(sets, "gender = @gender")
		args["gender"] = *req.Gender
	}

	if len(sets) == 0 {
		return r.GetByID(ctx, userID)
	}

	sets = append(sets, "updated_at = @updated_at")
	args["updated_at"] = time.Now()

	q := fmt.Sprintf(`
		UPDATE users
		SET %s
		WHERE user_id = @user_id AND is_active = true
		RETURNING *`,
		strings.Join(sets, ", "),
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("userRepository.Update: %w", err)
	}

	user, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.User])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("userRepository.Update scan: %w", err)
	}
	return &user, nil
}

func (r *userRepository) Delete(ctx context.Context, userID uuid.UUID) error {
	const q = `
		UPDATE users
		SET is_active = false, updated_at = NOW()
		WHERE user_id = $1 AND is_active = true`

	res, err := r.db.Exec(ctx, q, userID)
	if err != nil {
		return fmt.Errorf("userRepository.Delete: %w", err)
	}
	if res.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}

func (r *userRepository) ExistsByEmail(ctx context.Context, email string) (bool, error) {
	const q = `SELECT EXISTS(SELECT 1 FROM users WHERE email = $1 AND is_active = true)`

	var exists bool
	if err := r.db.QueryRow(ctx, q, email).Scan(&exists); err != nil {
		return false, fmt.Errorf("userRepository.ExistsByEmail: %w", err)
	}
	return exists, nil
}

func (r *userRepository) ExistsByID(ctx context.Context, userID uuid.UUID) (bool, error) {
	const q = `SELECT EXISTS(SELECT 1 FROM users WHERE user_id = $1 AND is_active = true)`

	var exists bool
	if err := r.db.QueryRow(ctx, q, userID).Scan(&exists); err != nil {
		return false, fmt.Errorf("userRepository.ExistsByID: %w", err)
	}
	return exists, nil
}

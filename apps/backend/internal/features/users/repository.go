package users

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
)

type Repository interface {
	Create(ctx context.Context, req CreateUserReq, passwordHash string) (*User, error)
	AdminCreate(ctx context.Context, actorUserID uuid.UUID, req AdminCreateUserParams, passwordHash string) (*User, error)
	// CreatePhone creates a phone-only customer (no password). The caller supplies
	// a synthetic, unique email to satisfy the NOT NULL/UNIQUE email column.
	CreatePhone(ctx context.Context, phone, email string) (*User, error)
	GetByID(ctx context.Context, userID uuid.UUID) (*User, error)
	GetByIDIncludingInactive(ctx context.Context, userID uuid.UUID) (*User, error)
	GetAuthUserByUID(ctx context.Context, uid int64) (*AuthUser, error)
	GetByEmail(ctx context.Context, email string) (*User, error)
	GetByPhone(ctx context.Context, phone string) (*User, error)
	GetAll(ctx context.Context, filter UserFilter) ([]*UserListItem, int64, error)
	GetRoleCounts(ctx context.Context) (map[string]UserRoleCounts, error)
	Update(ctx context.Context, userID uuid.UUID, req UpdateUserReq) (*User, error)
	AdminUpdate(ctx context.Context, actorUserID, targetUserID uuid.UUID, req AdminUpdateUserReq) (*User, error)
	AdminDeactivate(ctx context.Context, actorUserID, targetUserID uuid.UUID) error
	AdminBan(ctx context.Context, actorUserID, targetUserID uuid.UUID) (*User, error)
	AdminUnban(ctx context.Context, actorUserID, targetUserID uuid.UUID) (*User, error)
	GetAdminAudit(ctx context.Context, targetUserID uuid.UUID, filter AdminUserAuditFilter) ([]AdminUserAuditEvent, int64, error)
	// AdminWalletBalance reads the customer's wallet balance for the admin
	// detail projection (CF-3). Direct SQL rather than a wallet.Service call:
	// wallet already imports users, so the dependency cannot run the other way.
	AdminWalletBalance(ctx context.Context, id int64) (float64, error)
	ExistsByEmail(ctx context.Context, email string) (bool, error)
	ExistsByID(ctx context.Context, userID uuid.UUID) (bool, error)
}

type repository struct {
	db *pgxpool.Pool
}

const userColumns = `
	id, user_id, first_name, last_name, email, password_hash,
	phone, national_code, birth_date, gender, oauth_provider, oauth_id,
	role, is_active, email_verified_at, last_login_at, is_banned, banned_at,
	sessions_invalidated_at, created_at, updated_at`

func NewRepository(db *pgxpool.Pool) Repository {
	return &repository{db: db}
}

func (r *repository) Create(ctx context.Context, req CreateUserReq, passwordHash string) (*User, error) {
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
		return nil, mapUserWriteError("repository.Create", err)
	}

	user, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[User])
	if err != nil {
		return nil, mapUserWriteError("repository.Create scan", err)
	}
	return &user, nil
}

// AdminCreate revalidates the actor and writes the user plus its audit event in
// one transaction. The audit payload deliberately excludes identity and profile
// values; only access-control values are retained.
func (r *repository) AdminCreate(
	ctx context.Context,
	actorUserID uuid.UUID,
	req AdminCreateUserParams,
	passwordHash string,
) (*User, error) {
	if !IsAssignableUserRole(req.Role) {
		return nil, models.ErrInvalidState
	}
	if req.Gender != nil && !IsUserGender(*req.Gender) {
		return nil, models.ErrInvalidState
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("repository.AdminCreate begin: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	actor, err := lockActiveAdmin(ctx, tx, actorUserID)
	if err != nil {
		return nil, err
	}
	if isPrivilegedUserCreate(req.Role, req.IsActive) && !mayMutateRoleOrStatus(actor.Role) {
		return nil, models.ErrAccessDenied
	}

	q := `
		INSERT INTO users (
			user_id, first_name, last_name, email, password_hash,
			phone, national_code, birth_date, gender, role, is_active
		) VALUES (
			gen_random_uuid(), @first_name, @last_name, @email, @password_hash,
			@phone, @national_code, @birth_date, @gender, @role, @is_active
		)
		RETURNING ` + userColumns
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
		"is_active":     req.IsActive,
	}

	user, err := scanUser(tx.QueryRow(ctx, q, args))
	if err != nil {
		return nil, mapUserWriteError("repository.AdminCreate", err)
	}

	changedFields := adminCreateChangedFields(req)
	changes := map[string]AdminUserAuditChange{
		"role":      {Before: nil, After: req.Role},
		"is_active": {Before: nil, After: req.IsActive},
	}
	if err := insertUserAdminAudit(
		ctx, tx, actor, user.UserID, AdminUserAuditCreated, changedFields, changes,
	); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("repository.AdminCreate commit: %w", err)
	}
	return user, nil
}

func (r *repository) CreatePhone(ctx context.Context, phone, email string) (*User, error) {
	const q = `
		INSERT INTO users (user_id, email, phone, role, is_active)
		VALUES (gen_random_uuid(), @email, @phone, 'customer', true)
		RETURNING *`

	args := pgx.NamedArgs{"email": email, "phone": phone}

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, mapUserWriteError("repository.CreatePhone", err)
	}

	user, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[User])
	if err != nil {
		return nil, mapUserWriteError("repository.CreatePhone scan", err)
	}
	return &user, nil
}

func (r *repository) GetByPhone(ctx context.Context, phone string) (*User, error) {
	const q = `SELECT * FROM users WHERE phone = $1`

	rows, err := r.db.Query(ctx, q, phone)
	if err != nil {
		return nil, fmt.Errorf("repository.GetByPhone: %w", err)
	}

	user, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[User])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("repository.GetByPhone scan: %w", err)
	}
	return &user, nil
}

func (r *repository) GetByID(ctx context.Context, userID uuid.UUID) (*User, error) {
	const q = `SELECT * FROM users WHERE user_id = $1 AND is_active = true`

	rows, err := r.db.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("repository.GetByID: %w", err)
	}

	user, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[User])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("repository.GetByID scan: %w", err)
	}
	return &user, nil
}

func (r *repository) GetByIDIncludingInactive(ctx context.Context, userID uuid.UUID) (*User, error) {
	q := `SELECT ` + userColumns + ` FROM users WHERE user_id = $1`
	user, err := scanUser(r.db.QueryRow(ctx, q, userID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("repository.GetByIDIncludingInactive: %w", err)
	}
	return user, nil
}

// AdminWalletBalance returns the wallet balance for a user id. Wallets are
// created lazily on first use (wallet.Service.GetOrCreate), so a customer who
// has never transacted has no row — that is a zero balance, not an error.
func (r *repository) AdminWalletBalance(ctx context.Context, id int64) (float64, error) {
	const q = `SELECT COALESCE((SELECT balance FROM wallets WHERE user_id = $1), 0)`
	var balance float64
	if err := r.db.QueryRow(ctx, q, id).Scan(&balance); err != nil {
		return 0, fmt.Errorf("repository.AdminWalletBalance: %w", err)
	}
	return balance, nil
}

func (r *repository) GetAuthUserByUID(ctx context.Context, uid int64) (*AuthUser, error) {
	const q = `
		SELECT id, user_id, role, is_active, is_banned, sessions_invalidated_at
		FROM users WHERE id = $1`
	var user AuthUser
	if err := r.db.QueryRow(ctx, q, uid).Scan(
		&user.ID, &user.UserID, &user.Role, &user.IsActive, &user.IsBanned,
		&user.SessionsInvalidatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("repository.GetAuthUserByUID: %w", err)
	}
	return &user, nil
}

// ─────────────────────────────────────────────────────────────
// GetByEmail
// ─────────────────────────────────────────────────────────────

func (r *repository) GetByEmail(ctx context.Context, email string) (*User, error) {
	const q = `SELECT * FROM users WHERE email = $1`

	rows, err := r.db.Query(ctx, q, email)
	if err != nil {
		return nil, fmt.Errorf("repository.GetByEmail: %w", err)
	}

	user, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[User])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("repository.GetByEmail scan: %w", err)
	}
	return &user, nil
}

func (r *repository) GetAll(ctx context.Context, f UserFilter) ([]*UserListItem, int64, error) {
	where := []string{}
	args := pgx.NamedArgs{}

	if f.Role != nil {
		where = append(where, "u.role = @role")
		args["role"] = *f.Role
	}
	if f.IsActive != nil {
		if *f.IsActive {
			where = append(where, "u.is_active = true AND NOT u.is_banned")
		} else {
			where = append(where, "(u.is_active = false OR u.is_banned)")
		}
	}
	if f.Gender != nil {
		where = append(where, "u.gender = @gender")
		args["gender"] = *f.Gender
	}
	if f.CreatedFrom != nil {
		where = append(where, "u.created_at >= @created_from")
		args["created_from"] = *f.CreatedFrom
	}
	if f.CreatedTo != nil {
		where = append(where, "u.created_at <= @created_to")
		args["created_to"] = *f.CreatedTo
	}
	if f.Search != "" {
		where = append(where, "(u.first_name ILIKE @search OR u.last_name ILIKE @search OR u.email ILIKE @search OR u.phone ILIKE @search)")
		args["search"] = "%" + f.Search + "%"
	}

	allowed := map[string]string{
		"created_at": "created_at",
		"email":      "email",
		"first_name": "first_name",
		"last_name":  "last_name",
	}
	sortBy, ok := allowed[f.SortBy]
	if !ok {
		sortBy = "created_at"
	}
	order := "DESC"
	if strings.ToUpper(f.OrderBy) == "ASC" {
		order = "ASC"
	}

	whereSQL := "TRUE"
	if len(where) > 0 {
		whereSQL = strings.Join(where, " AND ")
	}

	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM users u WHERE %s`, whereSQL)
	var total int64
	if err := r.db.QueryRow(ctx, countQuery, args).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("repository.GetAll count: %w", err)
	}
	if total == 0 || int64(f.Offset()) >= total {
		return []*UserListItem{}, total, nil
	}

	args["limit"] = f.Limit
	args["offset"] = f.Offset()

	q := fmt.Sprintf(`
		WITH page_users AS (
			SELECT u.id, u.user_id, u.first_name, u.last_name, u.email, u.phone,
			       u.role, u.is_active, u.is_banned, u.created_at
			FROM users u
			WHERE %s
			ORDER BY u.%s %s, u.id %s
			LIMIT @limit OFFSET @offset
		)
		SELECT p.user_id,
		       BTRIM(CONCAT_WS(' ', p.first_name, p.last_name)) AS full_name,
		       p.email, p.phone, p.role, COUNT(o.id)::INTEGER AS total_orders,
		       p.is_active, p.is_banned, p.created_at
		FROM page_users p
		LEFT JOIN orders o ON o.user_id = p.id
		GROUP BY p.id, p.user_id, p.first_name, p.last_name, p.email, p.phone,
		         p.role, p.is_active, p.is_banned, p.created_at
		ORDER BY p.%s %s, p.id %s`,
		whereSQL, sortBy, order, order, sortBy, order, order,
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, 0, fmt.Errorf("repository.GetAll: %w", err)
	}
	defer rows.Close()

	items := make([]*UserListItem, 0, f.Limit)

	for rows.Next() {
		var item UserListItem
		if err := rows.Scan(
			&item.UserID, &item.FullName, &item.Email, &item.Phone,
			&item.Role, &item.TotalOrders, &item.IsActive, &item.IsBanned, &item.CreatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("repository.GetAll scan: %w", err)
		}
		items = append(items, &item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("repository.GetAll rows: %w", err)
	}

	return items, total, nil
}

func (r *repository) GetRoleCounts(ctx context.Context) (map[string]UserRoleCounts, error) {
	const q = `
		SELECT role, COUNT(*), COUNT(*) FILTER (WHERE is_active AND NOT is_banned)
		FROM users
		GROUP BY role`
	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("repository.GetRoleCounts: %w", err)
	}
	defer rows.Close()

	counts := make(map[string]UserRoleCounts, len(AssignableUserRoles()))
	for rows.Next() {
		var (
			role  string
			count UserRoleCounts
		)
		if err := rows.Scan(&role, &count.MemberCount, &count.ActiveMemberCount); err != nil {
			return nil, fmt.Errorf("repository.GetRoleCounts scan: %w", err)
		}
		counts[role] = count
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("repository.GetRoleCounts rows: %w", err)
	}
	return counts, nil
}

func (r *repository) Update(ctx context.Context, userID uuid.UUID, req UpdateUserReq) (*User, error) {
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
		return nil, mapUserWriteError("repository.Update", err)
	}

	user, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[User])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, mapUserWriteError("repository.Update scan", err)
	}
	return &user, nil
}

// AdminUpdate locks and revalidates the actor before reading the target. Actual
// profile changes are named in the audit event, but their values are never
// persisted there; only role and is_active receive before/after values.
func (r *repository) AdminUpdate(
	ctx context.Context,
	actorUserID, targetUserID uuid.UUID,
	req AdminUpdateUserReq,
) (*User, error) {
	if (req.Role.Set && req.Role.Value == nil) ||
		(req.IsActive.Set && req.IsActive.Value == nil) {
		return nil, models.ErrInvalidState
	}
	if req.Role.Set && !IsAssignableUserRole(*req.Role.Value) {
		return nil, models.ErrInvalidState
	}
	if req.Gender.Set && req.Gender.Value != nil && !IsUserGender(*req.Gender.Value) {
		return nil, models.ErrInvalidState
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("repository.AdminUpdate begin: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	actor, target, err := lockAdminActorAndTarget(ctx, tx, actorUserID, targetUserID)
	if err != nil {
		return nil, err
	}
	if isPrivilegedUserPatch(req) && !mayMutateRoleOrStatus(actor.Role) {
		return nil, models.ErrAccessDenied
	}
	if actorUserID == targetUserID && adminPatchRemovesOwnAccess(req) {
		return nil, models.ErrAccessDenied
	}
	// Last active superuser lockout (PH-021b): do not demote/deactivate the
	// sole active admin — panel recovery would be impossible.
	if wouldRemoveActiveAdmin(target, req) {
		n, err := countOtherActiveAdmins(ctx, tx, target.UserID)
		if err != nil {
			return nil, err
		}
		if isLastActiveAdmin(n) {
			return nil, models.ErrConflict
		}
	}

	sets := make([]string, 0, 9)
	changedFields := make([]string, 0, 8)
	changes := make(map[string]AdminUserAuditChange, 2)
	args := pgx.NamedArgs{"target_user_id": targetUserID}

	if req.FirstName.Set && !userPointerEqual(target.FirstName, req.FirstName.Value) {
		sets = append(sets, "first_name = @first_name")
		changedFields = append(changedFields, "first_name")
		args["first_name"] = nullableUserArg(req.FirstName.Value)
	}
	if req.LastName.Set && !userPointerEqual(target.LastName, req.LastName.Value) {
		sets = append(sets, "last_name = @last_name")
		changedFields = append(changedFields, "last_name")
		args["last_name"] = nullableUserArg(req.LastName.Value)
	}
	if req.Phone.Set && !userPointerEqual(target.Phone, req.Phone.Value) {
		sets = append(sets, "phone = @phone")
		changedFields = append(changedFields, "phone")
		args["phone"] = nullableUserArg(req.Phone.Value)
	}
	if req.NationalCode.Set && !userPointerEqual(target.NationalCode, req.NationalCode.Value) {
		sets = append(sets, "national_code = @national_code")
		changedFields = append(changedFields, "national_code")
		args["national_code"] = nullableUserArg(req.NationalCode.Value)
	}
	if req.BirthDate.Set && !userPointerEqual(target.BirthDate, req.BirthDate.Value) {
		sets = append(sets, "birth_date = @birth_date")
		changedFields = append(changedFields, "birth_date")
		args["birth_date"] = nullableUserArg(req.BirthDate.Value)
	}
	if req.Gender.Set && !userPointerEqual(target.Gender, req.Gender.Value) {
		sets = append(sets, "gender = @gender")
		changedFields = append(changedFields, "gender")
		args["gender"] = nullableUserArg(req.Gender.Value)
	}
	if req.Role.Set && target.Role != *req.Role.Value {
		sets = append(sets, "role = @role")
		changedFields = append(changedFields, "role")
		args["role"] = *req.Role.Value
		changes["role"] = AdminUserAuditChange{Before: target.Role, After: *req.Role.Value}
	}
	if req.IsActive.Set && target.IsActive != *req.IsActive.Value {
		sets = append(sets, "is_active = @is_active")
		changedFields = append(changedFields, "is_active")
		args["is_active"] = *req.IsActive.Value
		changes["is_active"] = AdminUserAuditChange{Before: target.IsActive, After: *req.IsActive.Value}
	}

	if len(sets) == 0 {
		if err := tx.Commit(ctx); err != nil {
			return nil, fmt.Errorf("repository.AdminUpdate no-op commit: %w", err)
		}
		return target, nil
	}

	sets = append(sets, "updated_at = NOW()")
	q := fmt.Sprintf(`
		UPDATE users
		SET %s
		WHERE user_id = @target_user_id
		RETURNING %s`, strings.Join(sets, ", "), userColumns)
	updated, err := scanUser(tx.QueryRow(ctx, q, args))
	if err != nil {
		return nil, mapUserWriteError("repository.AdminUpdate", err)
	}
	if err := insertUserAdminAudit(
		ctx, tx, actor, targetUserID, AdminUserAuditUpdated, changedFields, changes,
	); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("repository.AdminUpdate commit: %w", err)
	}
	return updated, nil
}

func (r *repository) AdminDeactivate(
	ctx context.Context,
	actorUserID, targetUserID uuid.UUID,
) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("repository.AdminDeactivate begin: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	actor, target, err := lockAdminActorAndTarget(ctx, tx, actorUserID, targetUserID)
	if err != nil {
		return err
	}
	if !mayMutateRoleOrStatus(actor.Role) {
		return models.ErrAccessDenied
	}
	if actorUserID == targetUserID {
		return models.ErrAccessDenied
	}
	if !target.IsActive {
		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("repository.AdminDeactivate no-op commit: %w", err)
		}
		return nil
	}
	if target.Role == UserRoleAdmin && !target.IsBanned {
		n, err := countOtherActiveAdmins(ctx, tx, target.UserID)
		if err != nil {
			return err
		}
		if isLastActiveAdmin(n) {
			return models.ErrConflict
		}
	}

	if _, err := tx.Exec(ctx, `
		UPDATE users
		SET is_active = false, updated_at = NOW()
		WHERE user_id = $1`, targetUserID); err != nil {
		return mapUserWriteError("repository.AdminDeactivate", err)
	}
	changes := map[string]AdminUserAuditChange{
		"is_active": {Before: true, After: false},
	}
	if err := insertUserAdminAudit(
		ctx, tx, actor, targetUserID, AdminUserAuditDeactivated,
		[]string{"is_active"}, changes,
	); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("repository.AdminDeactivate commit: %w", err)
	}
	return nil
}

func (r *repository) AdminBan(
	ctx context.Context,
	actorUserID, targetUserID uuid.UUID,
) (*User, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("repository.AdminBan begin: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	actor, target, err := lockAdminActorAndTarget(ctx, tx, actorUserID, targetUserID)
	if err != nil {
		return nil, err
	}
	if actorUserID == targetUserID {
		return nil, models.ErrAccessDenied
	}
	if target.IsBanned {
		if err := tx.Commit(ctx); err != nil {
			return nil, fmt.Errorf("repository.AdminBan no-op commit: %w", err)
		}
		return target, nil
	}
	if wouldBanActiveAdmin(target) {
		n, err := countOtherActiveAdmins(ctx, tx, target.UserID)
		if err != nil {
			return nil, err
		}
		if isLastActiveAdmin(n) {
			return nil, models.ErrConflict
		}
	}

	updated, err := scanUser(tx.QueryRow(ctx, `
		UPDATE users
		SET is_banned = true,
		    banned_at = NOW(),
		    sessions_invalidated_at = NOW(),
		    updated_at = NOW()
		WHERE user_id = $1
		RETURNING `+userColumns, targetUserID))
	if err != nil {
		return nil, mapUserWriteError("repository.AdminBan", err)
	}
	changes := map[string]AdminUserAuditChange{
		"is_banned": {Before: false, After: true},
	}
	if err := insertUserAdminAudit(
		ctx, tx, actor, targetUserID, AdminUserAuditUpdated,
		[]string{"is_banned"}, changes,
	); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("repository.AdminBan commit: %w", err)
	}
	return updated, nil
}

func (r *repository) AdminUnban(
	ctx context.Context,
	actorUserID, targetUserID uuid.UUID,
) (*User, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("repository.AdminUnban begin: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	actor, target, err := lockAdminActorAndTarget(ctx, tx, actorUserID, targetUserID)
	if err != nil {
		return nil, err
	}
	if actorUserID == targetUserID {
		return nil, models.ErrAccessDenied
	}
	if !target.IsBanned {
		if err := tx.Commit(ctx); err != nil {
			return nil, fmt.Errorf("repository.AdminUnban no-op commit: %w", err)
		}
		return target, nil
	}

	updated, err := scanUser(tx.QueryRow(ctx, `
		UPDATE users
		SET is_banned = false,
		    banned_at = NULL,
		    updated_at = NOW()
		WHERE user_id = $1
		RETURNING `+userColumns, targetUserID))
	if err != nil {
		return nil, mapUserWriteError("repository.AdminUnban", err)
	}
	changes := map[string]AdminUserAuditChange{
		"is_banned": {Before: true, After: false},
	}
	if err := insertUserAdminAudit(
		ctx, tx, actor, targetUserID, AdminUserAuditUpdated,
		[]string{"is_banned"}, changes,
	); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("repository.AdminUnban commit: %w", err)
	}
	return updated, nil
}

func (r *repository) GetAdminAudit(
	ctx context.Context,
	targetUserID uuid.UUID,
	f AdminUserAuditFilter,
) ([]AdminUserAuditEvent, int64, error) {
	const countQuery = `SELECT COUNT(*) FROM user_admin_audit_events WHERE target_user_id = $1`
	var total int64
	if err := r.db.QueryRow(ctx, countQuery, targetUserID).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("repository.GetAdminAudit count: %w", err)
	}
	if total == 0 || int64(f.Offset()) >= total {
		return []AdminUserAuditEvent{}, total, nil
	}

	const q = `
		SELECT event_id, actor_user_id, actor_email, target_user_id, action,
		       changed_fields, changes, created_at
		FROM user_admin_audit_events
		WHERE target_user_id = $1
		ORDER BY created_at DESC, event_id DESC
		LIMIT $2 OFFSET $3`
	rows, err := r.db.Query(ctx, q, targetUserID, f.Limit, f.Offset())
	if err != nil {
		return nil, 0, fmt.Errorf("repository.GetAdminAudit: %w", err)
	}
	defer rows.Close()

	events := make([]AdminUserAuditEvent, 0, f.Limit)
	for rows.Next() {
		var (
			event      AdminUserAuditEvent
			changesRaw []byte
		)
		if err := rows.Scan(
			&event.EventID, &event.ActorUserID, &event.ActorEmail,
			&event.TargetUserID, &event.Action, &event.ChangedFields,
			&changesRaw, &event.CreatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("repository.GetAdminAudit scan: %w", err)
		}
		if err := json.Unmarshal(changesRaw, &event.Changes); err != nil {
			return nil, 0, fmt.Errorf("repository.GetAdminAudit changes: %w", err)
		}
		if event.Changes == nil {
			event.Changes = map[string]AdminUserAuditChange{}
		}
		events = append(events, event)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("repository.GetAdminAudit rows: %w", err)
	}
	return events, total, nil
}

func (r *repository) ExistsByEmail(ctx context.Context, email string) (bool, error) {
	const q = `SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)`

	var exists bool
	if err := r.db.QueryRow(ctx, q, email).Scan(&exists); err != nil {
		return false, fmt.Errorf("repository.ExistsByEmail: %w", err)
	}
	return exists, nil
}

func (r *repository) ExistsByID(ctx context.Context, userID uuid.UUID) (bool, error) {
	const q = `SELECT EXISTS(SELECT 1 FROM users WHERE user_id = $1 AND is_active = true)`

	var exists bool
	if err := r.db.QueryRow(ctx, q, userID).Scan(&exists); err != nil {
		return false, fmt.Errorf("repository.ExistsByID: %w", err)
	}
	return exists, nil
}

func lockActiveAdmin(ctx context.Context, tx pgx.Tx, actorUserID uuid.UUID) (adminAuditActor, error) {
	user, err := lockUser(ctx, tx, actorUserID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return adminAuditActor{}, models.ErrAccessDenied
		}
		return adminAuditActor{}, err
	}
	return liveAdminActor(user)
}

// lockAdminActorAndTarget locks reciprocal admin operations in the same UUID
// order, preventing actor-first A->B / B->A deadlocks. Actor authorization is
// evaluated only after both live rows are locked.
func lockAdminActorAndTarget(
	ctx context.Context,
	tx pgx.Tx,
	actorUserID, targetUserID uuid.UUID,
) (adminAuditActor, *User, error) {
	q := `
		SELECT ` + userColumns + `
		FROM users
		WHERE user_id = $1 OR user_id = $2
		ORDER BY user_id
		FOR UPDATE`
	rows, err := tx.Query(ctx, q, actorUserID, targetUserID)
	if err != nil {
		return adminAuditActor{}, nil, fmt.Errorf("repository lock admin pair: %w", err)
	}
	defer rows.Close()

	var actorUser, targetUser *User
	for rows.Next() {
		user, err := scanUser(rows)
		if err != nil {
			return adminAuditActor{}, nil, fmt.Errorf("repository lock admin pair scan: %w", err)
		}
		if user.UserID == actorUserID {
			actorUser = user
		}
		if user.UserID == targetUserID {
			targetUser = user
		}
	}
	if err := rows.Err(); err != nil {
		return adminAuditActor{}, nil, fmt.Errorf("repository lock admin pair rows: %w", err)
	}
	if actorUser == nil {
		return adminAuditActor{}, nil, models.ErrAccessDenied
	}
	actor, err := liveAdminActor(actorUser)
	if err != nil {
		return adminAuditActor{}, nil, err
	}
	if targetUser == nil {
		return adminAuditActor{}, nil, models.ErrNotFound
	}
	return actor, targetUser, nil
}

// countOtherActiveAdmins counts active, non-banned superusers excluding exclude.
// Call under the same transaction as AdminUpdate/Deactivate (rows already locked).
func countOtherActiveAdmins(ctx context.Context, tx pgx.Tx, exclude uuid.UUID) (int64, error) {
	const q = `
		SELECT COUNT(*)::bigint
		FROM users
		WHERE role = $1
		  AND is_active
		  AND NOT is_banned
		  AND user_id <> $2`
	var n int64
	if err := tx.QueryRow(ctx, q, UserRoleAdmin, exclude).Scan(&n); err != nil {
		return 0, fmt.Errorf("repository countOtherActiveAdmins: %w", err)
	}
	return n, nil
}

func lockUser(ctx context.Context, tx pgx.Tx, userID uuid.UUID) (*User, error) {
	q := `SELECT ` + userColumns + ` FROM users WHERE user_id = $1 FOR UPDATE`
	user, err := scanUser(tx.QueryRow(ctx, q, userID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("repository lock target: %w", err)
	}
	return user, nil
}

func insertUserAdminAudit(
	ctx context.Context,
	tx pgx.Tx,
	actor adminAuditActor,
	targetUserID uuid.UUID,
	action AdminUserAuditAction,
	changedFields []string,
	changes map[string]AdminUserAuditChange,
) error {
	if changedFields == nil {
		changedFields = []string{}
	}
	if changes == nil {
		changes = map[string]AdminUserAuditChange{}
	}
	changesJSON, err := json.Marshal(changes)
	if err != nil {
		return fmt.Errorf("repository marshal admin audit: %w", err)
	}
	const q = `
		INSERT INTO user_admin_audit_events (
			actor_user_id, actor_email, target_user_id, action, changed_fields, changes
		) VALUES ($1, $2, $3, $4, $5, $6)`
	if _, err := tx.Exec(
		ctx, q, actor.UserID, actor.Email, targetUserID, action, changedFields, changesJSON,
	); err != nil {
		return fmt.Errorf("repository insert admin audit: %w", err)
	}
	return nil
}

func adminCreateChangedFields(req AdminCreateUserParams) []string {
	fields := make([]string, 0, 8)
	if req.FirstName != nil {
		fields = append(fields, "first_name")
	}
	if req.LastName != nil {
		fields = append(fields, "last_name")
	}
	if req.Phone != nil {
		fields = append(fields, "phone")
	}
	if req.NationalCode != nil {
		fields = append(fields, "national_code")
	}
	if req.BirthDate != nil {
		fields = append(fields, "birth_date")
	}
	if req.Gender != nil {
		fields = append(fields, "gender")
	}
	return append(fields, "role", "is_active")
}

func adminPatchRemovesOwnAccess(req AdminUpdateUserReq) bool {
	return (req.Role.Set && req.Role.Value != nil && *req.Role.Value != UserRoleAdmin) ||
		(req.IsActive.Set && req.IsActive.Value != nil && !*req.IsActive.Value)
}

func userPointerEqual[T comparable](left, right *T) bool {
	if left == nil || right == nil {
		return left == nil && right == nil
	}
	return *left == *right
}

func nullableUserArg[T any](value *T) any {
	if value == nil {
		return nil
	}
	return *value
}

type userScanner interface {
	Scan(dest ...any) error
}

func scanUser(row userScanner) (*User, error) {
	var user User
	if err := row.Scan(
		&user.ID, &user.UserID,
		&user.FirstName, &user.LastName,
		&user.Email, &user.PasswordHash,
		&user.Phone, &user.NationalCode,
		&user.BirthDate, &user.Gender,
		&user.OAuthProvider, &user.OAuthID,
		&user.Role, &user.IsActive,
		&user.EmailVerifiedAt, &user.LastLoginAt,
		&user.IsBanned, &user.BannedAt,
		&user.SessionsInvalidatedAt,
		&user.CreatedAt, &user.UpdatedAt,
	); err != nil {
		return nil, err
	}
	return &user, nil
}

func mapUserWriteError(operation string, err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505":
			return fmt.Errorf("%s: %w", operation, models.ErrAlreadyExists)
		case "23514":
			return fmt.Errorf("%s: %w", operation, models.ErrInvalidState)
		case "22001":
			return fmt.Errorf("%s: %w", operation, models.ErrInvalidState)
		}
	}
	return fmt.Errorf("%s: %w", operation, err)
}

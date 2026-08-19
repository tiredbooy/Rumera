package users

import (
	"context"
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
	"github.com/tiredbooy/pkg/crypto"
)

type Service struct {
	userRepo Repository
}

func NewService(userRepo Repository) *Service {
	return &Service{userRepo: userRepo}
}

func (s *Service) Create(ctx context.Context, req CreateUserReq, passwordHash string) (*User, error) {
	// This service method is the public registration boundary. Bootstrap code
	// writes through the repository directly, so callers cannot promote
	// themselves by constructing CreateUserReq manually.
	req.Role = UserRoleCustomer
	if err := validateCreateUserReq(req); err != nil {
		return nil, err
	}
	if passwordHash == "" {
		return nil, apperr.ErrInvalidRequest
	}

	exists, err := s.userRepo.ExistsByEmail(ctx, req.Email)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	if exists {
		return nil, apperr.ErrUserAlreadyExists
	}

	user, err := s.userRepo.Create(ctx, req, passwordHash)
	if err != nil {
		if errors.Is(err, models.ErrAlreadyExists) || errors.Is(err, models.ErrConflict) {
			return nil, apperr.ErrUserAlreadyExists
		}
		return nil, apperr.ErrInternal
	}

	return user, nil
}

// GetAuthUserByUID intentionally preserves repository error identity so Auth
// middleware can distinguish a missing account from a database outage.
func (s *Service) GetAuthUserByUID(ctx context.Context, uid int64) (*AuthUser, error) {
	if uid <= 0 {
		return nil, models.ErrNotFound
	}
	return s.userRepo.GetAuthUserByUID(ctx, uid)
}

func (s *Service) GetByID(ctx context.Context, userID uuid.UUID) (*User, error) {
	if userID == uuid.Nil {
		return nil, apperr.ErrInvalidRequest
	}

	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrUserNotFound
		}
		return nil, apperr.ErrInternal
	}

	return user, nil
}

func (s *Service) GetByIDIncludingInactive(ctx context.Context, userID uuid.UUID) (*User, error) {
	if userID == uuid.Nil {
		return nil, apperr.ErrInvalidRequest
	}
	user, err := s.userRepo.GetByIDIncludingInactive(ctx, userID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrUserNotFound
		}
		return nil, apperr.ErrInternal
	}
	return user, nil
}

func (s *Service) GetByEmail(ctx context.Context, email string) (*User, error) {
	if email == "" {
		return nil, apperr.ErrInvalidRequest
	}

	user, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrUserNotFound
		}
		return nil, apperr.ErrInternal
	}

	return user, nil
}

// GetOrCreateByPhone returns the customer for a (canonical) phone number,
// creating a passwordless phone-only account the first time we see it. Used by
// the SMS OTP login flow after a code is verified.
func (s *Service) GetOrCreateByPhone(ctx context.Context, phone string) (*User, error) {
	if phone == "" {
		return nil, apperr.ErrInvalidRequest
	}

	user, err := s.userRepo.GetByPhone(ctx, phone)
	if err == nil {
		return user, nil
	}
	if !errors.Is(err, models.ErrNotFound) {
		return nil, apperr.ErrInternal
	}

	// First sighting → create. A synthetic, unique email satisfies the NOT NULL /
	// UNIQUE email column; the password hash stays NULL (login is via OTP only).
	email := phone + "@phone.rumera.local"
	user, err = s.userRepo.CreatePhone(ctx, phone, email)
	if err != nil {
		if errors.Is(err, models.ErrAlreadyExists) || errors.Is(err, models.ErrConflict) {
			// Another request may have created the same OTP identity after our
			// initial read. Resolve the winning row rather than returning a 500.
			if existing, getErr := s.userRepo.GetByPhone(ctx, phone); getErr == nil {
				return existing, nil
			}
		}
		return nil, apperr.ErrInternal
	}
	return user, nil
}

func (s *Service) GetAll(ctx context.Context, filter UserFilter) ([]*UserListItem, int64, error) {
	if err := validateUserFilter(filter); err != nil {
		return nil, 0, err
	}

	users, total, err := s.userRepo.GetAll(ctx, filter)
	if err != nil {
		return nil, 0, apperr.ErrInternal
	}

	return users, total, nil
}

func (s *Service) GetAdminRoles(ctx context.Context) (*AdminRolesResponse, error) {
	counts, err := s.userRepo.GetRoleCounts(ctx)
	if err != nil {
		return nil, apperr.ErrInternal
	}

	roles := AssignableUserRoles()
	summaries := make([]AdminRoleSummary, 0, len(roles))
	for _, role := range roles {
		count := counts[role]
		summaries = append(summaries, AdminRoleSummary{
			Role: role,
			// Panel entry: admin (superuser) and staff (capability-gated).
			AdminAccess:       IsPanelRole(role),
			Assignable:        true,
			MemberCount:       count.MemberCount,
			ActiveMemberCount: count.ActiveMemberCount,
		})
	}
	return &AdminRolesResponse{
		AuthorizationMode: "role_capabilities",
		AdminRoles:        []string{UserRoleAdmin, UserRoleStaff},
		Roles:             summaries,
	}, nil
}

func (s *Service) AdminCreate(
	ctx context.Context,
	actorUserID uuid.UUID,
	req AdminCreateUserReq,
) (*User, error) {
	email := strings.TrimSpace(req.Email)
	firstName := normalizedOptionalString(req.FirstName)
	lastName := normalizedOptionalString(req.LastName)
	phone := normalizedOptionalString(req.Phone)
	nationalCode := normalizedOptionalString(req.NationalCode)
	gender := normalizedOptionalString(req.Gender)
	if actorUserID == uuid.Nil || email == "" || utf8.RuneCountInString(req.Password) < 8 ||
		utf8.RuneCountInString(email) > 255 || !crypto.PasswordFitsBcrypt(req.Password) ||
		optionalStringTooLong(firstName, 100) || optionalStringTooLong(lastName, 100) ||
		optionalStringTooLong(phone, 20) || optionalStringTooLong(nationalCode, 20) {
		return nil, apperr.ErrInvalidRequest
	}
	if req.Role != nil && !IsAssignableUserRole(*req.Role) {
		return nil, apperr.ErrInvalidRequest
	}
	if gender != nil && !IsUserGender(*gender) {
		return nil, apperr.ErrInvalidRequest
	}

	role := UserRoleCustomer
	if req.Role != nil {
		role = *req.Role
	}
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}
	if isPrivilegedUserCreate(role, isActive) {
		if err := s.requireRoleWriter(ctx, actorUserID); err != nil {
			return nil, err
		}
	}
	hash, err := crypto.HashPassword(req.Password)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	params := AdminCreateUserParams{
		FirstName:    firstName,
		LastName:     lastName,
		Email:        email,
		Phone:        phone,
		NationalCode: nationalCode,
		BirthDate:    req.BirthDate,
		Gender:       gender,
		Role:         role,
		IsActive:     isActive,
	}
	user, err := s.userRepo.AdminCreate(ctx, actorUserID, params, hash)
	if err != nil {
		return nil, mapAdminUserError(err)
	}
	return user, nil
}

func (s *Service) Update(ctx context.Context, userID uuid.UUID, req UpdateUserReq) (*ProfileUpdate, error) {
	if userID == uuid.Nil {
		return nil, apperr.ErrInvalidRequest
	}

	current, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrUserNotFound
		}
		return nil, apperr.ErrInternal
	}

	pending, err := s.stageSelfServicePhone(ctx, userID, current.Phone, &req)
	if err != nil {
		return nil, err
	}

	user, err := s.userRepo.Update(ctx, userID, req)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrUserNotFound
		}
		if errors.Is(err, models.ErrAlreadyExists) || errors.Is(err, models.ErrConflict) {
			return nil, apperr.ErrConflict
		}
		if errors.Is(err, models.ErrInvalidState) {
			return nil, apperr.ErrInvalidRequest
		}
		return nil, apperr.ErrInternal
	}

	return &ProfileUpdate{User: user, PendingPhone: pending}, nil
}

// ApplyVerifiedPhone persists a new number after auth OTP to that number
// succeeds. Self-service Update never writes a changed phone.
func (s *Service) ApplyVerifiedPhone(ctx context.Context, userID uuid.UUID, phone string) (*User, error) {
	if userID == uuid.Nil {
		return nil, apperr.ErrInvalidRequest
	}
	normalized, ok := NormalizeIranPhone(phone)
	if !ok {
		return nil, apperr.ErrInvalidRequest
	}
	if err := s.ensurePhoneAvailable(ctx, userID, normalized); err != nil {
		return nil, err
	}

	current, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrUserNotFound
		}
		return nil, apperr.ErrInternal
	}
	if sameCanonicalPhone(current.Phone, normalized) {
		return current, nil
	}

	user, err := s.userRepo.Update(ctx, userID, UpdateUserReq{Phone: &normalized})
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrUserNotFound
		}
		if errors.Is(err, models.ErrAlreadyExists) || errors.Is(err, models.ErrConflict) {
			return nil, apperr.ErrConflict
		}
		return nil, apperr.ErrInternal
	}
	return user, nil
}

// stageSelfServicePhone drops a changed phone from the profile write and
// returns it as pending. Same-number / blank values are treated as omitted.
func (s *Service) stageSelfServicePhone(
	ctx context.Context,
	userID uuid.UUID,
	current *string,
	req *UpdateUserReq,
) (*string, error) {
	if req.Phone == nil {
		return nil, nil
	}
	raw := strings.TrimSpace(*req.Phone)
	if raw == "" {
		req.Phone = nil
		return nil, nil
	}
	normalized, ok := NormalizeIranPhone(raw)
	if !ok {
		return nil, apperr.ErrInvalidRequest
	}
	req.Phone = nil
	if sameCanonicalPhone(current, normalized) {
		return nil, nil
	}
	if err := s.ensurePhoneAvailable(ctx, userID, normalized); err != nil {
		return nil, err
	}
	return &normalized, nil
}

// CheckPhoneAvailable reports whether phone can be bound to userID.
// ErrConflict means another account already owns the number.
func (s *Service) CheckPhoneAvailable(ctx context.Context, userID uuid.UUID, phone string) error {
	if userID == uuid.Nil || phone == "" {
		return apperr.ErrInvalidRequest
	}
	return s.ensurePhoneAvailable(ctx, userID, phone)
}

func (s *Service) ensurePhoneAvailable(ctx context.Context, userID uuid.UUID, phone string) error {
	existing, err := s.userRepo.GetByPhone(ctx, phone)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil
		}
		return apperr.ErrInternal
	}
	if existing.UserID != userID {
		return apperr.ErrConflict
	}
	return nil
}

func (s *Service) AdminUpdate(
	ctx context.Context,
	actorUserID, targetUserID uuid.UUID,
	req AdminUpdateUserReq,
) (*User, error) {
	if actorUserID == uuid.Nil || targetUserID == uuid.Nil {
		return nil, apperr.ErrInvalidRequest
	}
	if (req.Role.Set && req.Role.Value == nil) ||
		(req.IsActive.Set && req.IsActive.Value == nil) {
		return nil, apperr.ErrInvalidRequest
	}
	if req.Role.Set && !IsAssignableUserRole(*req.Role.Value) {
		return nil, apperr.ErrInvalidRequest
	}
	if req.Gender.Set && req.Gender.Value != nil && !IsUserGender(*req.Gender.Value) {
		return nil, apperr.ErrInvalidRequest
	}
	if nullableStringPatchTooLong(req.FirstName, 100) ||
		nullableStringPatchTooLong(req.LastName, 100) ||
		nullableStringPatchTooLong(req.Phone, 20) ||
		nullableStringPatchTooLong(req.NationalCode, 20) {
		return nil, apperr.ErrInvalidRequest
	}
	if actorUserID == targetUserID && adminPatchRemovesAccess(req) {
		return nil, apperr.ErrAccessDenied
	}
	if isPrivilegedUserPatch(req) {
		if err := s.requireRoleWriter(ctx, actorUserID); err != nil {
			return nil, err
		}
	}

	user, err := s.userRepo.AdminUpdate(ctx, actorUserID, targetUserID, req)
	if err != nil {
		return nil, mapAdminUserError(err)
	}
	return user, nil
}

func (s *Service) AdminDeactivate(
	ctx context.Context,
	actorUserID, targetUserID uuid.UUID,
) error {
	if actorUserID == uuid.Nil || targetUserID == uuid.Nil {
		return apperr.ErrInvalidRequest
	}
	if actorUserID == targetUserID {
		return apperr.ErrAccessDenied
	}
	if err := s.requireRoleWriter(ctx, actorUserID); err != nil {
		return err
	}
	return mapAdminUserError(s.userRepo.AdminDeactivate(ctx, actorUserID, targetUserID))
}

// AdminBan sets is_banned / banned_at. HTTP is customers:ban (PR-040e);
// persistence only requires a live panel actor. Self-ban is denied here and
// again inside the repository transaction.
func (s *Service) AdminBan(
	ctx context.Context,
	actorUserID, targetUserID uuid.UUID,
) (*User, error) {
	if actorUserID == uuid.Nil || targetUserID == uuid.Nil {
		return nil, apperr.ErrInvalidRequest
	}
	if actorUserID == targetUserID {
		return nil, apperr.ErrAccessDenied
	}
	user, err := s.userRepo.AdminBan(ctx, actorUserID, targetUserID)
	if err != nil {
		return nil, mapAdminUserError(err)
	}
	return user, nil
}

// AdminUnban clears is_banned / banned_at. Same HTTP/persistence split as
// AdminBan. Self-unban is denied even though a banned actor cannot authenticate.
func (s *Service) AdminUnban(
	ctx context.Context,
	actorUserID, targetUserID uuid.UUID,
) (*User, error) {
	if actorUserID == uuid.Nil || targetUserID == uuid.Nil {
		return nil, apperr.ErrInvalidRequest
	}
	if actorUserID == targetUserID {
		return nil, apperr.ErrAccessDenied
	}
	user, err := s.userRepo.AdminUnban(ctx, actorUserID, targetUserID)
	if err != nil {
		return nil, mapAdminUserError(err)
	}
	return user, nil
}

// requireRoleWriter is the service-side gate for role/status writes (PR-040c).
// HTTP customers:write is not enough; the live actor must be admin.
func (s *Service) requireRoleWriter(ctx context.Context, actorUserID uuid.UUID) error {
	actor, err := s.userRepo.GetByID(ctx, actorUserID)
	if err != nil {
		return mapAdminUserError(err)
	}
	if !mayMutateRoleOrStatus(actor.Role) {
		return apperr.ErrAccessDenied
	}
	return nil
}

func (s *Service) GetAdminAudit(
	ctx context.Context,
	targetUserID uuid.UUID,
	filter AdminUserAuditFilter,
) ([]AdminUserAuditEvent, int64, error) {
	if targetUserID == uuid.Nil || filter.Page < 1 || filter.Limit < 1 || filter.Limit > 100 {
		return nil, 0, apperr.ErrInvalidRequest
	}
	if _, err := s.userRepo.GetByIDIncludingInactive(ctx, targetUserID); err != nil {
		return nil, 0, mapAdminUserError(err)
	}
	events, total, err := s.userRepo.GetAdminAudit(ctx, targetUserID, filter)
	if err != nil {
		return nil, 0, apperr.ErrInternal
	}
	return events, total, nil
}

// GetAdminWalletBalance is the wallet balance shown on the admin customer file
// (CF-3). Takes the internal id the caller already has from the user read, so
// it costs one extra query on the detail route and nothing anywhere else.
func (s *Service) GetAdminWalletBalance(ctx context.Context, id int64) (float64, error) {
	if id <= 0 {
		return 0, apperr.ErrInvalidRequest
	}
	balance, err := s.userRepo.AdminWalletBalance(ctx, id)
	if err != nil {
		return 0, apperr.ErrInternal
	}
	return balance, nil
}

func (s *Service) ExistsByEmail(ctx context.Context, email string) (bool, error) {
	if email == "" {
		return false, apperr.ErrInvalidRequest
	}

	exists, err := s.userRepo.ExistsByEmail(ctx, email)
	if err != nil {
		return false, apperr.ErrInternal
	}

	return exists, nil
}

func (s *Service) ExistsByID(ctx context.Context, userID uuid.UUID) (bool, error) {
	if userID == uuid.Nil {
		return false, apperr.ErrInvalidRequest
	}

	exists, err := s.userRepo.ExistsByID(ctx, userID)
	if err != nil {
		return false, apperr.ErrInternal
	}

	return exists, nil
}

// ── private validators ────────────────────────────────────────────────────────

func validateCreateUserReq(req CreateUserReq) error {
	// Email and password are already validated by the request binder
	// (validate:"required,email" / "required,min=8"). First/last name are
	// optional — the column is nullable and the DTO marks them optional — so we
	// must NOT reject a registration just because the customer left them blank.
	if req.Email == "" {
		return apperr.ErrInvalidRequest
	}
	return nil
}

func validateUserFilter(f UserFilter) error {
	if f.Limit <= 0 {
		return apperr.ErrInvalidRequest
	}
	if f.Role != nil && !IsAssignableUserRole(*f.Role) {
		return apperr.ErrInvalidRequest
	}
	if f.Gender != nil && !IsUserGender(*f.Gender) {
		return apperr.ErrInvalidRequest
	}
	if f.CreatedFrom != nil && f.CreatedTo != nil && f.CreatedFrom.After(*f.CreatedTo) {
		return apperr.ErrInvalidRequest
	}
	validSort := map[string]bool{
		"created_at": true,
		"email":      true,
		"first_name": true,
		"last_name":  true,
	}
	if !validSort[f.SortBy] {
		return apperr.ErrInvalidRequest
	}
	if order := strings.ToLower(f.OrderBy); order != "asc" && order != "desc" {
		return apperr.ErrInvalidRequest
	}
	return nil
}

func adminPatchRemovesAccess(req AdminUpdateUserReq) bool {
	return (req.Role.Set && req.Role.Value != nil && *req.Role.Value != UserRoleAdmin) ||
		(req.IsActive.Set && req.IsActive.Value != nil && !*req.IsActive.Value)
}

func normalizedOptionalString(value *string) *string {
	if value == nil {
		return nil
	}
	normalized := strings.TrimSpace(*value)
	if normalized == "" {
		return nil
	}
	return &normalized
}

func optionalStringTooLong(value *string, maxLength int) bool {
	return value != nil && utf8.RuneCountInString(*value) > maxLength
}

func nullableStringPatchTooLong(patch models.NullablePatch[string], maxLength int) bool {
	return patch.Set && optionalStringTooLong(patch.Value, maxLength)
}

func mapAdminUserError(err error) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, models.ErrNotFound):
		return apperr.ErrUserNotFound
	case errors.Is(err, models.ErrAccessDenied):
		return apperr.ErrAccessDenied
	case errors.Is(err, models.ErrAlreadyExists), errors.Is(err, models.ErrConflict):
		return apperr.ErrConflict
	case errors.Is(err, models.ErrInvalidState):
		return apperr.ErrInvalidRequest
	default:
		return apperr.ErrInternal
	}
}

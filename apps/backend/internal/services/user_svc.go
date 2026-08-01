package services

import (
	"context"
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
	"github.com/tiredbooy/pkg/crypto"
)

type UserService struct {
	userRepo repositories.UserRepository
}

func NewUserService(userRepo repositories.UserRepository) *UserService {
	return &UserService{userRepo: userRepo}
}

func (s *UserService) Create(ctx context.Context, req models.CreateUserReq, passwordHash string) (*models.User, error) {
	// This service method is the public registration boundary. Bootstrap code
	// writes through the repository directly, so callers cannot promote
	// themselves by constructing CreateUserReq manually.
	req.Role = models.UserRoleCustomer
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
func (s *UserService) GetAuthUserByUID(ctx context.Context, uid int64) (*models.AuthUser, error) {
	if uid <= 0 {
		return nil, models.ErrNotFound
	}
	return s.userRepo.GetAuthUserByUID(ctx, uid)
}

func (s *UserService) GetByID(ctx context.Context, userID uuid.UUID) (*models.User, error) {
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

func (s *UserService) GetByIDIncludingInactive(ctx context.Context, userID uuid.UUID) (*models.User, error) {
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

func (s *UserService) GetByEmail(ctx context.Context, email string) (*models.User, error) {
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
func (s *UserService) GetOrCreateByPhone(ctx context.Context, phone string) (*models.User, error) {
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

func (s *UserService) GetAll(ctx context.Context, filter models.UserFilter) ([]*models.UserListItem, int64, error) {
	if err := validateUserFilter(filter); err != nil {
		return nil, 0, err
	}

	users, total, err := s.userRepo.GetAll(ctx, filter)
	if err != nil {
		return nil, 0, apperr.ErrInternal
	}

	return users, total, nil
}

func (s *UserService) GetAdminRoles(ctx context.Context) (*models.AdminRolesResponse, error) {
	counts, err := s.userRepo.GetRoleCounts(ctx)
	if err != nil {
		return nil, apperr.ErrInternal
	}

	roles := models.AssignableUserRoles()
	summaries := make([]models.AdminRoleSummary, 0, len(roles))
	for _, role := range roles {
		count := counts[role]
		summaries = append(summaries, models.AdminRoleSummary{
			Role:              role,
			AdminAccess:       role == models.UserRoleAdmin,
			Assignable:        true,
			MemberCount:       count.MemberCount,
			ActiveMemberCount: count.ActiveMemberCount,
		})
	}
	return &models.AdminRolesResponse{
		AuthorizationMode: "single_role",
		AdminRoles:        []string{models.UserRoleAdmin},
		Roles:             summaries,
	}, nil
}

func (s *UserService) AdminCreate(
	ctx context.Context,
	actorUserID uuid.UUID,
	req models.AdminCreateUserReq,
) (*models.User, error) {
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
	if req.Role != nil && !models.IsAssignableUserRole(*req.Role) {
		return nil, apperr.ErrInvalidRequest
	}
	if gender != nil && !models.IsUserGender(*gender) {
		return nil, apperr.ErrInvalidRequest
	}

	role := models.UserRoleCustomer
	if req.Role != nil {
		role = *req.Role
	}
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}
	hash, err := crypto.HashPassword(req.Password)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	params := models.AdminCreateUserParams{
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

func (s *UserService) Update(ctx context.Context, userID uuid.UUID, req models.UpdateUserReq) (*models.User, error) {
	if userID == uuid.Nil {
		return nil, apperr.ErrInvalidRequest
	}

	exists, err := s.userRepo.ExistsByID(ctx, userID)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	if !exists {
		return nil, apperr.ErrUserNotFound
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

	return user, nil
}

func (s *UserService) AdminUpdate(
	ctx context.Context,
	actorUserID, targetUserID uuid.UUID,
	req models.AdminUpdateUserReq,
) (*models.User, error) {
	if actorUserID == uuid.Nil || targetUserID == uuid.Nil {
		return nil, apperr.ErrInvalidRequest
	}
	if (req.Role.Set && req.Role.Value == nil) ||
		(req.IsActive.Set && req.IsActive.Value == nil) {
		return nil, apperr.ErrInvalidRequest
	}
	if req.Role.Set && !models.IsAssignableUserRole(*req.Role.Value) {
		return nil, apperr.ErrInvalidRequest
	}
	if req.Gender.Set && req.Gender.Value != nil && !models.IsUserGender(*req.Gender.Value) {
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

	user, err := s.userRepo.AdminUpdate(ctx, actorUserID, targetUserID, req)
	if err != nil {
		return nil, mapAdminUserError(err)
	}
	return user, nil
}

func (s *UserService) AdminDeactivate(
	ctx context.Context,
	actorUserID, targetUserID uuid.UUID,
) error {
	if actorUserID == uuid.Nil || targetUserID == uuid.Nil {
		return apperr.ErrInvalidRequest
	}
	if actorUserID == targetUserID {
		return apperr.ErrAccessDenied
	}
	return mapAdminUserError(s.userRepo.AdminDeactivate(ctx, actorUserID, targetUserID))
}

func (s *UserService) GetAdminAudit(
	ctx context.Context,
	targetUserID uuid.UUID,
	filter models.AdminUserAuditFilter,
) ([]models.AdminUserAuditEvent, int64, error) {
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

func (s *UserService) ExistsByEmail(ctx context.Context, email string) (bool, error) {
	if email == "" {
		return false, apperr.ErrInvalidRequest
	}

	exists, err := s.userRepo.ExistsByEmail(ctx, email)
	if err != nil {
		return false, apperr.ErrInternal
	}

	return exists, nil
}

func (s *UserService) ExistsByID(ctx context.Context, userID uuid.UUID) (bool, error) {
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

func validateCreateUserReq(req models.CreateUserReq) error {
	// Email and password are already validated by the request binder
	// (validate:"required,email" / "required,min=8"). First/last name are
	// optional — the column is nullable and the DTO marks them optional — so we
	// must NOT reject a registration just because the customer left them blank.
	if req.Email == "" {
		return apperr.ErrInvalidRequest
	}
	return nil
}

func validateUserFilter(f models.UserFilter) error {
	if f.Limit <= 0 {
		return apperr.ErrInvalidRequest
	}
	if f.Role != nil && !models.IsAssignableUserRole(*f.Role) {
		return apperr.ErrInvalidRequest
	}
	if f.Gender != nil && !models.IsUserGender(*f.Gender) {
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

func adminPatchRemovesAccess(req models.AdminUpdateUserReq) bool {
	return (req.Role.Set && req.Role.Value != nil && *req.Role.Value != models.UserRoleAdmin) ||
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

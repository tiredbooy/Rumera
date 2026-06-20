package services

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
)

type UserService struct {
	userRepo repositories.UserRepository
}

func NewUserService(userRepo repositories.UserRepository) *UserService {
	return &UserService{userRepo: userRepo}
}

func (s *UserService) Create(ctx context.Context, req models.CreateUserReq, passwordHash string) (*models.User, error) {
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
		return nil, apperr.ErrInternal
	}

	return user, nil
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
		return nil, apperr.ErrInternal
	}
	return user, nil
}

func (s *UserService) GetAll(ctx context.Context, filter models.UserFilter) ([]*models.User, int64, error) {
	if err := validateUserFilter(filter); err != nil {
		return nil, 0, err
	}

	users, total, err := s.userRepo.GetAll(ctx, filter)
	if err != nil {
		return nil, 0, apperr.ErrInternal
	}

	return users, total, nil
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
		return nil, apperr.ErrInternal
	}

	return user, nil
}

// AdminUpdate applies an admin-initiated patch that may include the privileged
// role and is_active fields. Existence is NOT pre-checked via ExistsByID (which
// filters on is_active = true) because an admin must be able to reactivate a
// deactivated account; the repository's RETURNING * surfaces ErrNotFound when no
// row matches the user_id.
func (s *UserService) AdminUpdate(ctx context.Context, userID uuid.UUID, req models.AdminUpdateUserReq) (*models.User, error) {
	if userID == uuid.Nil {
		return nil, apperr.ErrInvalidRequest
	}

	user, err := s.userRepo.AdminUpdate(ctx, userID, req)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrUserNotFound
		}
		return nil, apperr.ErrInternal
	}

	return user, nil
}

func (s *UserService) Delete(ctx context.Context, userID uuid.UUID) error {
	if userID == uuid.Nil {
		return apperr.ErrInvalidRequest
	}

	err := s.userRepo.Delete(ctx, userID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrUserNotFound
		}
		return apperr.ErrInternal
	}

	return nil
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
	return nil
}

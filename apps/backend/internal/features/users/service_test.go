package users

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
	"github.com/tiredbooy/pkg/crypto"
)

type userServiceRepoStub struct {
	// Embedded nil interface promotes the full Repository method set for
	// compile-time satisfaction; methods implemented below override it.
	Repository
	createdReq       CreateUserReq
	adminCreatedReq  AdminCreateUserParams
	adminHash        string
	adminCreateErr   error
	adminUpdateCalls int
	deactivateCalls  int
	banCalls         int
	unbanCalls       int
	banErr           error
	unbanErr         error
	roleCounts       map[string]UserRoleCounts
	actor            *User
	byID             *User
	byPhone          *User
	updatedReq       UpdateUserReq
	updateCalls      int
}

func (s *userServiceRepoStub) ExistsByEmail(context.Context, string) (bool, error) {
	return false, nil
}

func (s *userServiceRepoStub) Create(
	_ context.Context,
	req CreateUserReq,
	_ string,
) (*User, error) {
	s.createdReq = req
	return &User{Role: req.Role}, nil
}

func (s *userServiceRepoStub) AdminCreate(
	_ context.Context,
	_ uuid.UUID,
	req AdminCreateUserParams,
	passwordHash string,
) (*User, error) {
	s.adminCreatedReq = req
	s.adminHash = passwordHash
	if s.adminCreateErr != nil {
		return nil, s.adminCreateErr
	}
	return &User{UserID: uuid.New(), Email: req.Email, Role: req.Role, IsActive: req.IsActive}, nil
}

func (s *userServiceRepoStub) GetByID(_ context.Context, id uuid.UUID) (*User, error) {
	if s.actor != nil && s.actor.UserID == id {
		return s.actor, nil
	}
	if s.byID != nil && s.byID.UserID == id {
		return s.byID, nil
	}
	return nil, models.ErrNotFound
}

func (s *userServiceRepoStub) GetByPhone(_ context.Context, phone string) (*User, error) {
	if s.byPhone != nil && s.byPhone.Phone != nil && *s.byPhone.Phone == phone {
		return s.byPhone, nil
	}
	return nil, models.ErrNotFound
}

func (s *userServiceRepoStub) Update(_ context.Context, id uuid.UUID, req UpdateUserReq) (*User, error) {
	s.updateCalls++
	s.updatedReq = req
	base := s.byID
	if base == nil {
		base = &User{UserID: id}
	}
	out := *base
	if req.FirstName != nil {
		out.FirstName = req.FirstName
	}
	if req.LastName != nil {
		out.LastName = req.LastName
	}
	if req.Phone != nil {
		out.Phone = req.Phone
	}
	if req.NationalCode != nil {
		out.NationalCode = req.NationalCode
	}
	if req.BirthDate != nil {
		out.BirthDate = req.BirthDate
	}
	if req.Gender != nil {
		out.Gender = req.Gender
	}
	return &out, nil
}

func (s *userServiceRepoStub) GetRoleCounts(context.Context) (map[string]UserRoleCounts, error) {
	return s.roleCounts, nil
}

func (s *userServiceRepoStub) AdminUpdate(
	context.Context,
	uuid.UUID,
	uuid.UUID,
	AdminUpdateUserReq,
) (*User, error) {
	s.adminUpdateCalls++
	return &User{}, nil
}

func (s *userServiceRepoStub) AdminDeactivate(context.Context, uuid.UUID, uuid.UUID) error {
	s.deactivateCalls++
	return nil
}

func (s *userServiceRepoStub) AdminBan(context.Context, uuid.UUID, uuid.UUID) (*User, error) {
	s.banCalls++
	if s.banErr != nil {
		return nil, s.banErr
	}
	return &User{IsBanned: true}, nil
}

func (s *userServiceRepoStub) AdminUnban(context.Context, uuid.UUID, uuid.UUID) (*User, error) {
	s.unbanCalls++
	if s.unbanErr != nil {
		return nil, s.unbanErr
	}
	return &User{IsBanned: false}, nil
}

func TestServicePublicCreateAlwaysForcesCustomer(t *testing.T) {
	repo := &userServiceRepoStub{}
	service := NewService(repo)

	user, err := service.Create(context.Background(), CreateUserReq{
		Email: "buyer@example.com",
		Role:  UserRoleAdmin,
	}, "server-hash")
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if repo.createdReq.Role != UserRoleCustomer || user.Role != UserRoleCustomer {
		t.Fatalf("persisted role = %q, returned role = %q; want customer", repo.createdReq.Role, user.Role)
	}
}

func TestServiceAdminCreateDefaultsAndHashesPassword(t *testing.T) {
	repo := &userServiceRepoStub{}
	service := NewService(repo)
	actorID := uuid.New()
	blank := "   "

	user, err := service.AdminCreate(context.Background(), actorID, AdminCreateUserReq{
		Email:     "  new@example.com  ",
		Password:  "correct horse battery staple",
		FirstName: &blank,
	})
	if err != nil {
		t.Fatalf("admin create: %v", err)
	}
	if user.Role != UserRoleCustomer || !user.IsActive {
		t.Fatalf("created role/status = %q/%v; want customer/true", user.Role, user.IsActive)
	}
	if repo.adminCreatedReq.Email != "new@example.com" || repo.adminCreatedReq.FirstName != nil {
		t.Fatalf("normalized create params = %+v", repo.adminCreatedReq)
	}
	if repo.adminHash == "" || repo.adminHash == "correct horse battery staple" ||
		!crypto.CheckPasswordHash("correct horse battery staple", repo.adminHash) {
		t.Fatal("admin password was not server-hashed")
	}
}

func TestServiceAdminCreateMapsDuplicateIdentityToConflict(t *testing.T) {
	repo := &userServiceRepoStub{adminCreateErr: models.ErrAlreadyExists}
	_, err := NewService(repo).AdminCreate(context.Background(), uuid.New(), AdminCreateUserReq{
		Email: "duplicate@example.com", Password: "password123",
	})
	if !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("error = %v; want ErrConflict", err)
	}
}

func TestServiceAdminCreateRejectsPasswordsBeyondBcryptLimit(t *testing.T) {
	repo := &userServiceRepoStub{}
	_, err := NewService(repo).AdminCreate(context.Background(), uuid.New(), AdminCreateUserReq{
		Email: "long-password@example.com", Password: strings.Repeat("a", 73),
	})
	if !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("error = %v; want ErrInvalidRequest", err)
	}
	if repo.adminHash != "" {
		t.Fatal("password beyond bcrypt's byte limit reached hashing")
	}
}

func TestServiceAdminRolesAreDeterministic(t *testing.T) {
	repo := &userServiceRepoStub{roleCounts: map[string]UserRoleCounts{
		UserRoleAdmin:    {MemberCount: 2, ActiveMemberCount: 1},
		UserRoleCustomer: {MemberCount: 8, ActiveMemberCount: 7},
	}}
	summary, err := NewService(repo).GetAdminRoles(context.Background())
	if err != nil {
		t.Fatalf("get roles: %v", err)
	}
	// AssignableUserRoles order: customer, vendor, admin, staff.
	want := []string{
		UserRoleCustomer,
		UserRoleVendor,
		UserRoleAdmin,
		UserRoleStaff,
	}
	if summary.AuthorizationMode != "role_capabilities" ||
		len(summary.AdminRoles) != 2 ||
		summary.AdminRoles[0] != UserRoleAdmin ||
		summary.AdminRoles[1] != UserRoleStaff ||
		len(summary.Roles) != len(want) {
		t.Fatalf("summary = %+v", summary)
	}
	for i, role := range want {
		if summary.Roles[i].Role != role || !summary.Roles[i].Assignable {
			t.Fatalf("role %d = %+v; want %q assignable", i, summary.Roles[i], role)
		}
		// Panel entry for admin (superuser) and staff (capability-gated).
		if summary.Roles[i].AdminAccess != IsPanelRole(role) {
			t.Fatalf("role %q admin access = %v", role, summary.Roles[i].AdminAccess)
		}
	}
	if summary.Roles[1].MemberCount != 0 || summary.Roles[1].ActiveMemberCount != 0 {
		t.Fatalf("missing vendor counts = %+v; want zero", summary.Roles[1])
	}
	if summary.Roles[3].Role != UserRoleStaff ||
		summary.Roles[3].MemberCount != 0 || summary.Roles[3].ActiveMemberCount != 0 {
		t.Fatalf("missing staff counts = %+v; want zero", summary.Roles[3])
	}
}

func TestServiceRejectsSelfDemotionDeactivationAndDeleteBeforeRepository(t *testing.T) {
	repo := &userServiceRepoStub{}
	service := NewService(repo)
	actorID := uuid.New()
	vendor := UserRoleVendor
	inactive := false

	if _, err := service.AdminUpdate(context.Background(), actorID, actorID, AdminUpdateUserReq{
		Role: models.NullablePatch[string]{Set: true, Value: &vendor},
	}); !errors.Is(err, apperr.ErrAccessDenied) {
		t.Fatalf("self-demotion error = %v; want ErrAccessDenied", err)
	}
	if _, err := service.AdminUpdate(context.Background(), actorID, actorID, AdminUpdateUserReq{
		IsActive: models.NullablePatch[bool]{Set: true, Value: &inactive},
	}); !errors.Is(err, apperr.ErrAccessDenied) {
		t.Fatalf("self-deactivation error = %v; want ErrAccessDenied", err)
	}
	if err := service.AdminDeactivate(context.Background(), actorID, actorID); !errors.Is(err, apperr.ErrAccessDenied) {
		t.Fatalf("self-delete error = %v; want ErrAccessDenied", err)
	}
	if _, err := service.AdminBan(context.Background(), actorID, actorID); !errors.Is(err, apperr.ErrAccessDenied) {
		t.Fatalf("self-ban error = %v; want ErrAccessDenied", err)
	}
	if _, err := service.AdminUnban(context.Background(), actorID, actorID); !errors.Is(err, apperr.ErrAccessDenied) {
		t.Fatalf("self-unban error = %v; want ErrAccessDenied", err)
	}
	if repo.adminUpdateCalls != 0 || repo.deactivateCalls != 0 || repo.banCalls != 0 || repo.unbanCalls != 0 {
		t.Fatalf("repository calls = update %d, deactivate %d, ban %d, unban %d; want zero",
			repo.adminUpdateCalls, repo.deactivateCalls, repo.banCalls, repo.unbanCalls)
	}
}

func TestServiceRejectsNullRoleAndStatusPatches(t *testing.T) {
	repo := &userServiceRepoStub{}
	service := NewService(repo)
	actorID := uuid.New()
	targetID := uuid.New()

	for name, req := range map[string]AdminUpdateUserReq{
		"role":      {Role: models.NullablePatch[string]{Set: true}},
		"is_active": {IsActive: models.NullablePatch[bool]{Set: true}},
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := service.AdminUpdate(context.Background(), actorID, targetID, req); !errors.Is(err, apperr.ErrInvalidRequest) {
				t.Fatalf("error = %v; want ErrInvalidRequest", err)
			}
		})
	}
	if repo.adminUpdateCalls != 0 {
		t.Fatalf("repository calls = %d; want zero", repo.adminUpdateCalls)
	}
}

func TestServiceStaffMayEditCustomerProfileButNotRoleOrStatus(t *testing.T) {
	staffID := uuid.New()
	targetID := uuid.New()
	repo := &userServiceRepoStub{
		actor: &User{UserID: staffID, Role: UserRoleStaff, IsActive: true},
	}
	service := NewService(repo)
	name := "Nika"

	if _, err := service.AdminUpdate(context.Background(), staffID, targetID, AdminUpdateUserReq{
		FirstName: models.NullablePatch[string]{Set: true, Value: &name},
	}); err != nil {
		t.Fatalf("staff profile edit: %v", err)
	}
	if repo.adminUpdateCalls != 1 {
		t.Fatalf("profile edit repo calls = %d; want 1", repo.adminUpdateCalls)
	}

	staff := UserRoleStaff
	if _, err := service.AdminUpdate(context.Background(), staffID, targetID, AdminUpdateUserReq{
		Role: models.NullablePatch[string]{Set: true, Value: &staff},
	}); !errors.Is(err, apperr.ErrAccessDenied) {
		t.Fatalf("staff role write = %v; want ErrAccessDenied", err)
	}
	inactive := false
	if _, err := service.AdminUpdate(context.Background(), staffID, targetID, AdminUpdateUserReq{
		IsActive: models.NullablePatch[bool]{Set: true, Value: &inactive},
	}); !errors.Is(err, apperr.ErrAccessDenied) {
		t.Fatalf("staff status write = %v; want ErrAccessDenied", err)
	}
	if err := service.AdminDeactivate(context.Background(), staffID, targetID); !errors.Is(err, apperr.ErrAccessDenied) {
		t.Fatalf("staff deactivate = %v; want ErrAccessDenied", err)
	}
	if repo.adminUpdateCalls != 1 || repo.deactivateCalls != 0 {
		t.Fatalf("privileged writes leaked to repo: update=%d deactivate=%d", repo.adminUpdateCalls, repo.deactivateCalls)
	}
}

func TestServiceStaffMayCreateCustomerButNotPanelRoles(t *testing.T) {
	staffID := uuid.New()
	repo := &userServiceRepoStub{
		actor: &User{UserID: staffID, Role: UserRoleStaff, IsActive: true},
	}
	service := NewService(repo)

	if _, err := service.AdminCreate(context.Background(), staffID, AdminCreateUserReq{
		Email: "new-customer@example.com", Password: "password123",
	}); err != nil {
		t.Fatalf("staff create customer: %v", err)
	}
	if repo.adminCreatedReq.Role != UserRoleCustomer || !repo.adminCreatedReq.IsActive {
		t.Fatalf("staff create persisted %+v; want active customer", repo.adminCreatedReq)
	}

	admin := UserRoleAdmin
	if _, err := service.AdminCreate(context.Background(), staffID, AdminCreateUserReq{
		Email: "new-admin@example.com", Password: "password123", Role: &admin,
	}); !errors.Is(err, apperr.ErrAccessDenied) {
		t.Fatalf("staff create admin = %v; want ErrAccessDenied", err)
	}
	staff := UserRoleStaff
	if _, err := service.AdminCreate(context.Background(), staffID, AdminCreateUserReq{
		Email: "new-staff@example.com", Password: "password123", Role: &staff,
	}); !errors.Is(err, apperr.ErrAccessDenied) {
		t.Fatalf("staff create staff = %v; want ErrAccessDenied", err)
	}
	inactive := false
	if _, err := service.AdminCreate(context.Background(), staffID, AdminCreateUserReq{
		Email: "inactive@example.com", Password: "password123", IsActive: &inactive,
	}); !errors.Is(err, apperr.ErrAccessDenied) {
		t.Fatalf("staff create inactive = %v; want ErrAccessDenied", err)
	}
	if repo.adminCreatedReq.Email != "new-customer@example.com" {
		t.Fatalf("privileged create reached repo: %+v", repo.adminCreatedReq)
	}
}

func TestServiceAdminMayWriteRoleAndStatus(t *testing.T) {
	adminID := uuid.New()
	targetID := uuid.New()
	repo := &userServiceRepoStub{
		actor: &User{UserID: adminID, Role: UserRoleAdmin, IsActive: true},
	}
	service := NewService(repo)
	staff := UserRoleStaff

	if _, err := service.AdminUpdate(context.Background(), adminID, targetID, AdminUpdateUserReq{
		Role: models.NullablePatch[string]{Set: true, Value: &staff},
	}); err != nil {
		t.Fatalf("admin role write: %v", err)
	}
	if repo.adminUpdateCalls != 1 {
		t.Fatal("admin role write did not reach repository")
	}
	if err := service.AdminDeactivate(context.Background(), adminID, targetID); err != nil {
		t.Fatalf("admin deactivate: %v", err)
	}
	if repo.deactivateCalls != 1 {
		t.Fatal("admin deactivate did not reach repository")
	}
}

func TestServiceStaffMayBanAndUnbanWithoutRoleWriter(t *testing.T) {
	staffID := uuid.New()
	targetID := uuid.New()
	repo := &userServiceRepoStub{
		actor: &User{UserID: staffID, Role: UserRoleStaff, IsActive: true},
	}
	service := NewService(repo)

	banned, err := service.AdminBan(context.Background(), staffID, targetID)
	if err != nil {
		t.Fatalf("staff ban: %v", err)
	}
	if !banned.IsBanned || repo.banCalls != 1 {
		t.Fatalf("staff ban result = %+v calls=%d", banned, repo.banCalls)
	}
	unbanned, err := service.AdminUnban(context.Background(), staffID, targetID)
	if err != nil {
		t.Fatalf("staff unban: %v", err)
	}
	if unbanned.IsBanned || repo.unbanCalls != 1 {
		t.Fatalf("staff unban result = %+v calls=%d", unbanned, repo.unbanCalls)
	}
}

func TestServiceSelfServiceUpdateDoesNotPersistNewPhone(t *testing.T) {
	userID := uuid.New()
	current := "09120000000"
	next := "09121111111"
	name := "Nika"
	repo := &userServiceRepoStub{
		byID: &User{UserID: userID, Phone: &current, FirstName: ptr("Old"), IsActive: true},
	}
	result, err := NewService(repo).Update(context.Background(), userID, UpdateUserReq{
		FirstName: &name,
		Phone:     &next,
	})
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if repo.updateCalls != 1 || repo.updatedReq.Phone != nil {
		t.Fatalf("repo update = calls %d phone %+v; phone must not be persisted", repo.updateCalls, repo.updatedReq.Phone)
	}
	if result.PendingPhone == nil || *result.PendingPhone != next {
		t.Fatalf("pending = %+v; want %s", result.PendingPhone, next)
	}
	if result.User.FirstName == nil || *result.User.FirstName != name {
		t.Fatalf("other fields not persisted: %+v", result.User.FirstName)
	}
	if result.User.Phone == nil || *result.User.Phone != current {
		t.Fatalf("returned phone = %+v; want current %s", result.User.Phone, current)
	}
}

func TestServiceSelfServiceUpdateSamePhoneIsNoop(t *testing.T) {
	userID := uuid.New()
	current := "09120000000"
	sameIntl := "+989120000000"
	repo := &userServiceRepoStub{
		byID: &User{UserID: userID, Phone: &current, IsActive: true},
	}
	result, err := NewService(repo).Update(context.Background(), userID, UpdateUserReq{Phone: &sameIntl})
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if result.PendingPhone != nil {
		t.Fatalf("pending = %v; want nil for same number", *result.PendingPhone)
	}
	if repo.updatedReq.Phone != nil {
		t.Fatal("same number must not rewrite phone")
	}
}

func TestServiceSelfServiceUpdateRejectsTakenAndInvalidPhone(t *testing.T) {
	userID := uuid.New()
	otherID := uuid.New()
	current := "09120000000"
	taken := "09123333333"
	repo := &userServiceRepoStub{
		byID:    &User{UserID: userID, Phone: &current, IsActive: true},
		byPhone: &User{UserID: otherID, Phone: &taken},
	}
	service := NewService(repo)

	if _, err := service.Update(context.Background(), userID, UpdateUserReq{Phone: &taken}); !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("taken phone = %v; want ErrConflict", err)
	}
	bad := "02122334455"
	if _, err := service.Update(context.Background(), userID, UpdateUserReq{Phone: &bad}); !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("invalid phone = %v; want ErrInvalidRequest", err)
	}
	if repo.updateCalls != 0 {
		t.Fatalf("rejected phones reached repo (%d)", repo.updateCalls)
	}
}

func TestServiceApplyVerifiedPhonePersistsAndConflicts(t *testing.T) {
	userID := uuid.New()
	otherID := uuid.New()
	current := "09120000000"
	next := "09124444444"
	taken := "09125555555"
	repo := &userServiceRepoStub{
		byID:    &User{UserID: userID, Phone: &current, IsActive: true},
		byPhone: &User{UserID: otherID, Phone: &taken},
	}
	service := NewService(repo)

	user, err := service.ApplyVerifiedPhone(context.Background(), userID, "+98"+next[1:])
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	if repo.updateCalls != 1 || repo.updatedReq.Phone == nil || *repo.updatedReq.Phone != next {
		t.Fatalf("verified write = calls %d phone %+v; want %s", repo.updateCalls, repo.updatedReq.Phone, next)
	}
	if user.Phone == nil || *user.Phone != next {
		t.Fatalf("returned phone = %+v; want %s", user.Phone, next)
	}

	if _, err := service.ApplyVerifiedPhone(context.Background(), userID, taken); !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("taken apply = %v; want ErrConflict", err)
	}
}

func ptr[T any](v T) *T { return &v }

func TestServiceBanRejectsNilIDsAndMapsRepoErrors(t *testing.T) {
	targetID := uuid.New()
	repo := &userServiceRepoStub{banErr: models.ErrConflict, unbanErr: models.ErrNotFound}
	service := NewService(repo)

	if _, err := service.AdminBan(context.Background(), uuid.Nil, targetID); !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("nil actor ban = %v; want ErrInvalidRequest", err)
	}
	if _, err := service.AdminUnban(context.Background(), uuid.New(), uuid.Nil); !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("nil target unban = %v; want ErrInvalidRequest", err)
	}
	if _, err := service.AdminBan(context.Background(), uuid.New(), targetID); !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("last-admin ban = %v; want ErrConflict", err)
	}
	if _, err := service.AdminUnban(context.Background(), uuid.New(), targetID); !errors.Is(err, apperr.ErrUserNotFound) {
		t.Fatalf("missing unban = %v; want ErrUserNotFound", err)
	}
}

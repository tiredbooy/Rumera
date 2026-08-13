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
	roleCounts       map[string]UserRoleCounts
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
	if repo.adminUpdateCalls != 0 || repo.deactivateCalls != 0 {
		t.Fatalf("repository calls = update %d, deactivate %d; want zero", repo.adminUpdateCalls, repo.deactivateCalls)
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

package users

import (
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/tiredbooy/internal/models"
)

func TestWouldRemoveActiveAdmin(t *testing.T) {
	admin := &User{Role: UserRoleAdmin, IsActive: true}
	staff := UserRoleStaff
	customer := UserRoleCustomer
	inactive := false
	active := true

	if wouldRemoveActiveAdmin(admin, AdminUpdateUserReq{}) {
		t.Fatal("empty patch should not remove admin")
	}
	if !wouldRemoveActiveAdmin(admin, AdminUpdateUserReq{
		Role: models.NullablePatch[string]{Set: true, Value: &staff},
	}) {
		t.Fatal("demote to staff should remove admin")
	}
	if !wouldRemoveActiveAdmin(admin, AdminUpdateUserReq{
		Role: models.NullablePatch[string]{Set: true, Value: &customer},
	}) {
		t.Fatal("demote to customer should remove admin")
	}
	if !wouldRemoveActiveAdmin(admin, AdminUpdateUserReq{
		IsActive: models.NullablePatch[bool]{Set: true, Value: &inactive},
	}) {
		t.Fatal("deactivate should remove admin")
	}
	if wouldRemoveActiveAdmin(admin, AdminUpdateUserReq{
		IsActive: models.NullablePatch[bool]{Set: true, Value: &active},
	}) {
		t.Fatal("keep active should not remove")
	}
	// Already inactive / banned / staff target — not counted as active admin.
	if wouldRemoveActiveAdmin(&User{Role: UserRoleAdmin, IsActive: false}, AdminUpdateUserReq{
		Role: models.NullablePatch[string]{Set: true, Value: &staff},
	}) {
		t.Fatal("inactive admin not in active set")
	}
	if wouldRemoveActiveAdmin(&User{Role: UserRoleStaff, IsActive: true}, AdminUpdateUserReq{
		Role: models.NullablePatch[string]{Set: true, Value: &customer},
	}) {
		t.Fatal("staff target is not an active admin")
	}
}

func TestWouldBanActiveAdmin(t *testing.T) {
	if !wouldBanActiveAdmin(&User{Role: UserRoleAdmin, IsActive: true}) {
		t.Fatal("active unbanned admin should be removable by ban")
	}
	if wouldBanActiveAdmin(&User{Role: UserRoleAdmin, IsActive: true, IsBanned: true}) {
		t.Fatal("already-banned admin is not in the active set")
	}
	if wouldBanActiveAdmin(&User{Role: UserRoleAdmin, IsActive: false}) {
		t.Fatal("inactive admin is not in the active set")
	}
	if wouldBanActiveAdmin(&User{Role: UserRoleStaff, IsActive: true}) {
		t.Fatal("staff is not an active admin")
	}
	if wouldBanActiveAdmin(nil) {
		t.Fatal("nil target is not an active admin")
	}
}

func TestIsLastActiveAdmin(t *testing.T) {
	if !isLastActiveAdmin(0) {
		t.Fatal("0 others => last admin")
	}
	if isLastActiveAdmin(1) {
		t.Fatal("1 other => not last")
	}
}

func TestLiveAdminActorAllowsLivePanelOperators(t *testing.T) {
	id := uuid.New()
	admin, err := liveAdminActor(&User{UserID: id, Email: "a@x", Role: UserRoleAdmin, IsActive: true})
	if err != nil || admin.Role != UserRoleAdmin || admin.UserID != id {
		t.Fatalf("admin actor = %+v err=%v", admin, err)
	}
	staff, err := liveAdminActor(&User{UserID: id, Email: "s@x", Role: UserRoleStaff, IsActive: true})
	if err != nil || staff.Role != UserRoleStaff {
		t.Fatalf("staff actor = %+v err=%v", staff, err)
	}
	for name, user := range map[string]*User{
		"nil":      nil,
		"customer": {Role: UserRoleCustomer, IsActive: true},
		"inactive": {Role: UserRoleAdmin, IsActive: false},
		"banned":   {Role: UserRoleStaff, IsActive: true, IsBanned: true},
	} {
		if _, err := liveAdminActor(user); !errors.Is(err, models.ErrAccessDenied) {
			t.Fatalf("%s actor error = %v; want ErrAccessDenied", name, err)
		}
	}
}

func TestMayMutateRoleOrStatusIsAdminOnly(t *testing.T) {
	if !mayMutateRoleOrStatus(UserRoleAdmin) {
		t.Fatal("admin must write role/status")
	}
	for _, role := range []string{UserRoleStaff, UserRoleCustomer, UserRoleVendor, ""} {
		if mayMutateRoleOrStatus(role) {
			t.Fatalf("role %q must not write role/status", role)
		}
	}
}

func TestPrivilegedUserMutations(t *testing.T) {
	staff := UserRoleStaff
	inactive := false
	if isPrivilegedUserPatch(AdminUpdateUserReq{}) {
		t.Fatal("empty patch is profile-only")
	}
	if isPrivilegedUserPatch(AdminUpdateUserReq{
		FirstName: models.NullablePatch[string]{Set: true},
	}) {
		t.Fatal("name patch is profile-only")
	}
	if !isPrivilegedUserPatch(AdminUpdateUserReq{
		Role: models.NullablePatch[string]{Set: true, Value: &staff},
	}) {
		t.Fatal("role patch is privileged")
	}
	if !isPrivilegedUserPatch(AdminUpdateUserReq{
		IsActive: models.NullablePatch[bool]{Set: true, Value: &inactive},
	}) {
		t.Fatal("status patch is privileged")
	}
	if isPrivilegedUserCreate(UserRoleCustomer, true) {
		t.Fatal("active customer create is the staff path")
	}
	if !isPrivilegedUserCreate(UserRoleAdmin, true) {
		t.Fatal("admin create is privileged")
	}
	if !isPrivilegedUserCreate(UserRoleCustomer, false) {
		t.Fatal("inactive create is privileged")
	}
}

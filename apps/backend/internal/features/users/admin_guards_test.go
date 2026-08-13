package users

import (
	"testing"

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

func TestIsLastActiveAdmin(t *testing.T) {
	if !isLastActiveAdmin(0) {
		t.Fatal("0 others => last admin")
	}
	if isLastActiveAdmin(1) {
		t.Fatal("1 other => not last")
	}
}

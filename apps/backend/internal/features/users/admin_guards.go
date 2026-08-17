package users

import (
	"github.com/google/uuid"
	"github.com/tiredbooy/internal/models"
)

// adminAuditActor is the locked live operator recorded on user-admin audit rows.
type adminAuditActor struct {
	UserID uuid.UUID
	Email  string
	Role   string
}

// liveAdminActor is the persistence actor rule for admin user mutations (PR-040c model B).
//
// Any live panel operator (role=admin or staff, active, not banned) may act.
// That is the non-money customer-edit path: staff with customers:write can
// create a customer and patch profile fields.
//
// Role and is_active writes still require live role=admin (see
// mayMutateRoleOrStatus). roles:manage edits the capability matrix, not
// users.role — assigning panel roles is an admin-superuser persistence rule.
//
// Wallet credit is not gated here. HTTP requires wallet:credit, which is
// not in the default staff seed.
func liveAdminActor(user *User) (adminAuditActor, error) {
	if user == nil || !user.IsActive || user.IsBanned || !IsPanelRole(user.Role) {
		return adminAuditActor{}, models.ErrAccessDenied
	}
	return adminAuditActor{UserID: user.UserID, Email: user.Email, Role: user.Role}, nil
}

// mayMutateRoleOrStatus is the privileged-write rule for users.role / is_active
// and deactivate. Only a live admin (superuser) may change those fields.
func mayMutateRoleOrStatus(actorRole string) bool {
	return actorRole == UserRoleAdmin
}

// isPrivilegedUserPatch is true when the update touches role or account status.
func isPrivilegedUserPatch(req AdminUpdateUserReq) bool {
	return req.Role.Set || req.IsActive.Set
}

// isPrivilegedUserCreate is true when create assigns a non-customer role or
// starts the account inactive. Staff customers:write may only mint customers.
func isPrivilegedUserCreate(role string, isActive bool) bool {
	return role != UserRoleCustomer || !isActive
}

// wouldRemoveActiveAdmin reports whether the patch would stop counting the
// target as an active panel superuser (role=admin, active, not banned).
// Used for last-admin lockout (PH-021b).
func wouldRemoveActiveAdmin(target *User, req AdminUpdateUserReq) bool {
	if target == nil || target.Role != UserRoleAdmin || !target.IsActive || target.IsBanned {
		return false
	}
	if req.Role.Set && req.Role.Value != nil && *req.Role.Value != UserRoleAdmin {
		return true
	}
	if req.IsActive.Set && req.IsActive.Value != nil && !*req.IsActive.Value {
		return true
	}
	return false
}

// wouldBanActiveAdmin is true when banning the target would drop them from
// the active-admin set (PH-021b last-admin lockout).
func wouldBanActiveAdmin(target *User) bool {
	return target != nil && target.Role == UserRoleAdmin && target.IsActive && !target.IsBanned
}

// isLastActiveAdmin is true when otherActiveAdmins is 0 (no remaining admin
// after removing this one).
func isLastActiveAdmin(otherActiveAdmins int64) bool {
	return otherActiveAdmins <= 0
}

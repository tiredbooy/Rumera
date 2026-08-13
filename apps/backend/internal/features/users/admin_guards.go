package users

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

// isLastActiveAdmin is true when otherActiveAdmins is 0 (no remaining admin
// after removing this one).
func isLastActiveAdmin(otherActiveAdmins int64) bool {
	return otherActiveAdmins <= 0
}

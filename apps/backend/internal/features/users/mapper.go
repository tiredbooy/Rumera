package users

import "strconv"

func MapToCreateUserReq(input SignUpInput) CreateUserReq {
	return CreateUserReq{
		FirstName:    input.FirstName,
		LastName:     input.LastName,
		Email:        input.Email,
		Password:     input.Password,
		Phone:        input.Phone,
		NationalCode: input.NationalCode,
		BirthDate:    input.BirthDate,
		Gender:       input.Gender,
		Role:         "customer",
	}
}

func MapToUpdateUserReq(input UpdateProfileInput) UpdateUserReq {
	return UpdateUserReq{
		FirstName:    input.FirstName,
		LastName:     input.LastName,
		Phone:        input.Phone,
		NationalCode: input.NationalCode,
		BirthDate:    input.BirthDate,
		Gender:       input.Gender,
	}
}

func MapToUserResponse(u *User) *UserResponse {
	return &UserResponse{
		UserID:    u.UserID,
		FirstName: u.FirstName,
		LastName:  u.LastName,
		Email:     u.Email,
		Phone:     u.Phone,
		BirthDate: u.BirthDate,
		Gender:    u.Gender,
		Role:      u.Role,
		CreatedAt: u.CreatedAt,
	}
}

func MapToAdminUser(u *User) *AdminUser {
	return &AdminUser{
		UserResponse:    *MapToUserResponse(u),
		NationalCode:    u.NationalCode,
		OAuthProvider:   u.OAuthProvider,
		IsActive:        u.IsActive,
		IsBanned:        u.IsBanned,
		BannedAt:        u.BannedAt,
		EmailVerifiedAt: u.EmailVerifiedAt,
		LastLoginAt:     u.LastLoginAt,
		UpdatedAt:       u.UpdatedAt,
	}
}

// MapToAdminUserWithWallet is the admin *detail* projection (CF-3): identity
// plus the live wallet balance. The create / update / ban responses keep using
// MapToAdminUser — they never looked the balance up, and emitting "0.00" there
// would be a number the caller could act on but nobody read.
func MapToAdminUserWithWallet(u *User, balance float64) *AdminUser {
	out := MapToAdminUser(u)
	out.WalletBalance = strconv.FormatFloat(balance, 'f', 2, 64)
	return out
}

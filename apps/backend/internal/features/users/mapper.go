package users

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

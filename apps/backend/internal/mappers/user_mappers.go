package mappers

import "github.com/tiredbooy/internal/models"

func MapToCreateUserReq(input models.SignUpInput) models.CreateUserReq {
	return models.CreateUserReq{
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

func MapToUpdateUserReq(input models.UpdateProfileInput) models.UpdateUserReq {
	return models.UpdateUserReq{
		FirstName:    input.FirstName,
		LastName:     input.LastName,
		Phone:        input.Phone,
		NationalCode: input.NationalCode,
		BirthDate:    input.BirthDate,
		Gender:       input.Gender,
	}
}

func MapToUserResponse(u *models.User) *models.UserResponse {
	return &models.UserResponse{
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

func MapToAdminUser(u *models.User) *models.AdminUser {
	return &models.AdminUser{
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

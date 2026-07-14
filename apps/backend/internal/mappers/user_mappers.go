package mappers

import (
	"strings"

	"github.com/tiredbooy/internal/models"
)

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
		EmailVerifiedAt: u.EmailVerifiedAt,
		LastLoginAt:     u.LastLoginAt,
		UpdatedAt:       u.UpdatedAt,
	}
}

func MapToUserListItem(u *models.User) *models.UserListItem {
	nameParts := make([]string, 0, 2)
	if u.FirstName != nil {
		nameParts = append(nameParts, *u.FirstName)
	}
	if u.LastName != nil {
		nameParts = append(nameParts, *u.LastName)
	}

	return &models.UserListItem{
		UserID:   u.UserID,
		FullName: strings.TrimSpace(strings.Join(nameParts, " ")),
		Email:    u.Email,
		Phone:    u.Phone,
		Role:     u.Role,
		// The list repository does not aggregate orders yet, so TotalOrders
		// intentionally remains zero rather than presenting invented data.
		TotalOrders: 0,
		IsActive:    u.IsActive,
		CreatedAt:   u.CreatedAt,
	}
}

func MapToUserListItems(users []*models.User) []*models.UserListItem {
	result := make([]*models.UserListItem, len(users))
	for i, u := range users {
		result[i] = MapToUserListItem(u)
	}
	return result
}

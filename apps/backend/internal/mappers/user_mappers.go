package mappers

import "github.com/tiredbooy/internal/models"

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

func MapToUserAdminResponse(u *models.User) *models.UserAdminResponse {
	return &models.UserAdminResponse{
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
	return &models.UserListItem{
		UserID:    u.UserID,
		// FirstName: u.FirstName,
		// LastName:  u.LastName,
		FullName : *u.FirstName + " " + *u.LastName,
		Email:     u.Email,
		Role:      u.Role,
		IsActive:  u.IsActive,
		CreatedAt: u.CreatedAt,
	}
}

func MapToUserListItems(users []*models.User) []*models.UserListItem {
	result := make([]*models.UserListItem, len(users))
	for i, u := range users {
		result[i] = MapToUserListItem(u)
	}
	return result
}

package mappers

import "github.com/tiredbooy/internal/models"

func ToReviewResponse(r *models.Review, userFullName string) models.ReviewResponse {
	return models.ReviewResponse{
		ID:               r.ID,
		Title:            r.Title,
		Content:          r.Content,
		Rating:           r.Rating,
		UserID:           r.UserID,
		UserFullName:     userFullName,
		Images:           r.Images,
		ProductID:        r.ProductID,
		LikeCount:        r.LikeCount,
		DislikeCount:     r.DislikeCount,
		VerifiedPurchase: r.VerifiedPurchase,
		Status:           r.Status,
		CreatedAt:        r.CreatedAt,
	}
}

func ToReviewAdminResponse(r *models.Review, userFullName string) models.ReviewAdminResponse {
	return models.ReviewAdminResponse{
		ReviewResponse: ToReviewResponse(r, userFullName),
		DeletedAt:      r.DeletedAt,
		UpdatedAt:      r.UpdatedAt,
	}
}

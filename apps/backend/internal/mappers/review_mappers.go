package mappers

import "github.com/tiredbooy/internal/models"

func ToReviewResponse(r *models.Review) models.ReviewResponse {
	images := r.Images
	if images == nil {
		images = []models.ReviewImage{}
	}
	return models.ReviewResponse{
		ID:               r.ID,
		Title:            r.Title,
		Content:          r.Content,
		Rating:           r.Rating,
		UserID:           r.UserID,
		UserFullName:     r.UserFullName,
		Images:           images,
		ProductID:        r.ProductID,
		LikeCount:        r.LikeCount,
		DislikeCount:     r.DislikeCount,
		VerifiedPurchase: r.VerifiedPurchase,
		Status:           r.Status,
		CreatedAt:        r.CreatedAt,
	}
}

func ToReviewAdminResponse(r *models.Review) models.ReviewAdminResponse {
	return models.ReviewAdminResponse{
		ReviewResponse: ToReviewResponse(r),
		DeletedAt:      r.DeletedAt,
		UpdatedAt:      r.UpdatedAt,
	}
}

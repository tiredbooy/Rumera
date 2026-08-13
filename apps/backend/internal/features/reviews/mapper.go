package reviews

func ToReviewResponse(r *Review) ReviewResponse {
	images := r.Images
	if images == nil {
		images = []ReviewImage{}
	}
	return ReviewResponse{
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

func ToReviewAdminResponse(r *Review) ReviewAdminResponse {
	return ReviewAdminResponse{
		ReviewResponse: ToReviewResponse(r),
		DeletedAt:      r.DeletedAt,
		UpdatedAt:      r.UpdatedAt,
	}
}

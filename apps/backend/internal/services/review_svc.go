package services

import (
	"context"
	"errors"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
)

type ReviewService struct {
	reviewRepo      repositories.ReviewRepository
	reviewImageRepo repositories.ReviewImageRepository
}

func NewReviewService(
	reviewRepo repositories.ReviewRepository,
	reviewImageRepo repositories.ReviewImageRepository,
) *ReviewService {
	return &ReviewService{
		reviewRepo:      reviewRepo,
		reviewImageRepo: reviewImageRepo,
	}
}

// ── Review ────────────────────────────────────────────────────────────────────

func (s *ReviewService) Create(ctx context.Context, userID int64, req models.CreateReviewReq) (*models.Review, error) {
	if userID <= 0 || req.ProductID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	if err := validateReviewContent(req.Rating, req.Title, req.Content); err != nil {
		return nil, err
	}

	already, err := s.reviewRepo.HasReviewed(ctx, userID, req.ProductID)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	if already {
		return nil, apperr.ErrConflict
	}
	// Non-buyers may leave feedback; verified_purchase badges distinguish trust.
	// HasPurchased still runs so we can stamp the row honestly.
	verifiedPurchase, err := s.reviewRepo.HasPurchased(ctx, userID, req.ProductID)
	if err != nil {
		return nil, apperr.ErrInternal
	}

	review, err := s.reviewRepo.Create(ctx, userID, req, verifiedPurchase)
	if err != nil {
		if errors.Is(err, models.ErrConflict) {
			return nil, apperr.ErrConflict
		}
		return nil, apperr.ErrInternal
	}

	return review, nil
}

func (s *ReviewService) GetMine(ctx context.Context, userID int64) ([]models.AccountReviewResponse, error) {
	if userID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	reviews, err := s.reviewRepo.GetMine(ctx, userID)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	if reviews == nil {
		reviews = []models.AccountReviewResponse{}
	}
	return reviews, nil
}

func (s *ReviewService) GetPending(ctx context.Context, userID int64) ([]models.PendingReviewResponse, error) {
	if userID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	items, err := s.reviewRepo.GetPending(ctx, userID)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	if items == nil {
		items = []models.PendingReviewResponse{}
	}
	return items, nil
}

func (s *ReviewService) GetByID(ctx context.Context, id int64) (*models.Review, error) {
	if id <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	review, err := s.reviewRepo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}

	return review, nil
}

func (s *ReviewService) GetAll(ctx context.Context, filter models.ReviewFilter) ([]*models.Review, int64, error) {
	if filter.Limit <= 0 {
		return nil, 0, apperr.ErrInvalidRequest
	}

	reviews, total, err := s.reviewRepo.GetAll(ctx, filter)
	if err != nil {
		return nil, 0, apperr.ErrInternal
	}

	return reviews, total, nil
}

func (s *ReviewService) Update(ctx context.Context, id int64, userID int64, req models.UpdateReviewReq) (*models.Review, error) {
	if id <= 0 || userID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	if req.Rating != nil && (*req.Rating < 1 || *req.Rating > 5) {
		return nil, apperr.ErrInvalidRequest
	}
	if req.Title != nil && *req.Title == "" {
		return nil, apperr.ErrInvalidRequest
	}

	review, err := s.reviewRepo.Update(ctx, id, userID, req)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}

	return review, nil
}

// UpdateStatus is an admin-only operation — authorization should be enforced
// at the handler level before this is called.
func (s *ReviewService) UpdateStatus(ctx context.Context, id int64, req models.UpdateReviewStatusReq) (*models.Review, error) {
	if id <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	review, err := s.reviewRepo.UpdateStatus(ctx, id, req)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}

	return review, nil
}

// Delete soft-deletes the review and cleans up its images in one logical operation.
// Both steps are scoped to the same userID so a user can never delete another's review.
func (s *ReviewService) Delete(ctx context.Context, id int64, userID int64) error {
	if id <= 0 || userID <= 0 {
		return apperr.ErrInvalidRequest
	}

	if err := s.reviewRepo.Delete(ctx, id, userID); err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrNotFound
		}
		return apperr.ErrInternal
	}

	// Best-effort image cleanup — review is already soft-deleted so
	// orphaned image rows are invisible to users. Don't fail the request.
	_ = s.reviewImageRepo.DeleteImagesByReviewID(ctx, id)

	return nil
}

func (s *ReviewService) GetRatingSummary(ctx context.Context, productID int64) (*models.ProductRatingSummary, error) {
	if productID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	summary, err := s.reviewRepo.GetRatingSummary(ctx, productID)
	if err != nil {
		return nil, apperr.ErrInternal
	}

	return summary, nil
}

func (s *ReviewService) React(ctx context.Context, id int64, userID int64, like bool) error {
	if id <= 0 || userID <= 0 {
		return apperr.ErrInvalidRequest
	}

	if err := s.reviewRepo.React(ctx, id, userID, like); err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrNotFound
		}
		return apperr.ErrInternal
	}

	return nil
}

func (s *ReviewService) HasReviewed(ctx context.Context, userID int64, productID int64) (bool, error) {
	if userID <= 0 || productID <= 0 {
		return false, apperr.ErrInvalidRequest
	}

	has, err := s.reviewRepo.HasReviewed(ctx, userID, productID)
	if err != nil {
		return false, apperr.ErrInternal
	}

	return has, nil
}

// ── Review images ─────────────────────────────────────────────────────────────

func (s *ReviewService) GetImages(ctx context.Context, reviewID int64, userID int64) ([]*models.ReviewImage, error) {
	if reviewID <= 0 || userID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	review, err := s.reviewRepo.GetByID(ctx, reviewID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}
	if review.Status != models.ReviewStatusApproved && review.UserID != userID {
		return nil, apperr.ErrAccessDenied
	}

	images, err := s.reviewImageRepo.GetImagesByReviewID(ctx, reviewID)
	if err != nil {
		return nil, apperr.ErrInternal
	}

	if images == nil {
		images = []*models.ReviewImage{}
	}
	return images, nil
}

func (s *ReviewService) AddImage(ctx context.Context, reviewID int64, userID int64, req *models.ReviewImageReq) (*models.ReviewImage, error) {
	if reviewID <= 0 || userID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	if req.ImageURL == "" {
		return nil, apperr.ErrInvalidRequest
	}

	// Ownership check: a user may only attach images to their OWN review.
	// Without this, any authenticated caller could POST images onto any review
	// by iterating numeric ids (IDOR), and the URL renders on the public PDP.
	review, err := s.reviewRepo.GetByID(ctx, reviewID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}
	if review.UserID != userID {
		return nil, apperr.ErrAccessDenied
	}

	req.ReviewID = reviewID

	image, err := s.reviewImageRepo.CreateReviewImage(ctx, req)
	if err != nil {
		return nil, apperr.ErrInternal
	}

	return image, nil
}

func (s *ReviewService) AddImages(ctx context.Context, reviewID int64, reqs []*models.ReviewImageReq) ([]*models.ReviewImage, error) {
	if reviewID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	if len(reqs) == 0 {
		return nil, apperr.ErrInvalidRequest
	}

	if _, err := s.reviewRepo.GetByID(ctx, reviewID); err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}

	for _, req := range reqs {
		if req.ImageURL == "" {
			return nil, apperr.ErrInvalidRequest
		}
		req.ReviewID = reviewID
	}

	images, err := s.reviewImageRepo.CreateReviewImages(ctx, reqs)
	if err != nil {
		return nil, apperr.ErrInternal
	}

	return images, nil
}

func (s *ReviewService) UpdateImageMeta(ctx context.Context, id int64, altTxt *string, sortOrder *int) (*models.ReviewImage, error) {
	if id <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	if altTxt == nil && sortOrder == nil {
		return nil, apperr.ErrInvalidRequest
	}

	image, err := s.reviewImageRepo.UpdateReviewImageMeta(ctx, id, altTxt, sortOrder)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}

	return image, nil
}

func (s *ReviewService) DeleteImage(ctx context.Context, id int64) error {
	if id <= 0 {
		return apperr.ErrInvalidRequest
	}

	if err := s.reviewImageRepo.DeleteReviewImage(ctx, id); err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrNotFound
		}
		return apperr.ErrInternal
	}

	return nil
}

// ── private validators ────────────────────────────────────────────────────────

func validateReviewContent(rating int, title, content string) error {
	if rating < 1 || rating > 5 {
		return apperr.ErrInvalidRequest
	}
	if title == "" || content == "" {
		return apperr.ErrInvalidRequest
	}
	return nil
}

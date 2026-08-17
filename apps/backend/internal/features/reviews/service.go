package reviews

import (
	"context"
	"errors"
	"net/url"
	"strings"
	"unicode"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

// reviewLoyalty is the optional loyalty earner (verified-purchase review bonus).
// Implemented by *loyalty.Service; nil disables awards.
type reviewLoyalty interface {
	AwardForReview(ctx context.Context, userID, reviewID int64, verifiedPurchase bool) error
}

// Service is the reviews domain surface (CRUD, reactions, images, rating summary).
type Service struct {
	reviewRepo      Repository
	reviewImageRepo ImageRepository
	loyalty         reviewLoyalty
}

func NewService(reviewRepo Repository, reviewImageRepo ImageRepository, loyalty reviewLoyalty) *Service {
	return &Service{
		reviewRepo:      reviewRepo,
		reviewImageRepo: reviewImageRepo,
		loyalty:         loyalty,
	}
}

// ── Review ────────────────────────────────────────────────────────────────────

func (s *Service) Create(ctx context.Context, userID int64, req CreateReviewReq) (*Review, error) {
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

	// PH-040b: verified-purchase review earn is best-effort after insert.
	if s.loyalty != nil && review != nil {
		_ = s.loyalty.AwardForReview(ctx, userID, review.ID, verifiedPurchase)
	}

	return review, nil
}

func (s *Service) GetMine(ctx context.Context, userID int64) ([]AccountReviewResponse, error) {
	if userID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	reviews, err := s.reviewRepo.GetMine(ctx, userID)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	if reviews == nil {
		reviews = []AccountReviewResponse{}
	}
	return reviews, nil
}

func (s *Service) GetPending(ctx context.Context, userID int64) ([]PendingReviewResponse, error) {
	if userID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	items, err := s.reviewRepo.GetPending(ctx, userID)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	if items == nil {
		items = []PendingReviewResponse{}
	}
	return items, nil
}

func (s *Service) GetByID(ctx context.Context, id int64) (*Review, error) {
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

	if err := s.hydrateImages(ctx, review); err != nil {
		return nil, apperr.ErrInternal
	}

	return review, nil
}

func (s *Service) GetAll(ctx context.Context, filter ReviewFilter) ([]*Review, int64, error) {
	if filter.Limit <= 0 {
		return nil, 0, apperr.ErrInvalidRequest
	}

	reviews, total, err := s.reviewRepo.GetAll(ctx, filter)
	if err != nil {
		return nil, 0, apperr.ErrInternal
	}

	if err := s.hydrateImages(ctx, reviews...); err != nil {
		return nil, 0, apperr.ErrInternal
	}

	return reviews, total, nil
}

func (s *Service) Update(ctx context.Context, id int64, userID int64, req UpdateReviewReq) (*Review, error) {
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
func (s *Service) UpdateStatus(ctx context.Context, id int64, req UpdateReviewStatusReq) (*Review, error) {
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
func (s *Service) Delete(ctx context.Context, id int64, userID int64) error {
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
	if s.reviewImageRepo != nil {
		_ = s.reviewImageRepo.DeleteImagesByReviewID(ctx, id)
	}

	return nil
}

func (s *Service) GetRatingSummary(ctx context.Context, productID int64) (*ProductRatingSummary, error) {
	if productID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	summary, err := s.reviewRepo.GetRatingSummary(ctx, productID)
	if err != nil {
		return nil, apperr.ErrInternal
	}

	return summary, nil
}

func (s *Service) React(ctx context.Context, id int64, userID int64, like bool) error {
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

func (s *Service) Unlike(ctx context.Context, id int64, userID int64) error {
	if id <= 0 || userID <= 0 {
		return apperr.ErrInvalidRequest
	}

	if err := s.reviewRepo.Unlike(ctx, id, userID); err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrNotFound
		}
		return apperr.ErrInternal
	}

	return nil
}

func (s *Service) HasReviewed(ctx context.Context, userID int64, productID int64) (bool, error) {
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

func (s *Service) GetImages(ctx context.Context, reviewID int64, userID int64) ([]*ReviewImage, error) {
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
	if review.Status != ReviewStatusApproved && review.UserID != userID {
		return nil, apperr.ErrAccessDenied
	}

	images, err := s.reviewImageRepo.GetImagesByReviewID(ctx, reviewID)
	if err != nil {
		return nil, apperr.ErrInternal
	}

	if images == nil {
		images = []*ReviewImage{}
	}
	return images, nil
}

func (s *Service) AddImage(ctx context.Context, reviewID int64, userID int64, req *ReviewImageReq) (*ReviewImage, error) {
	if reviewID <= 0 || userID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	imageURL, err := normalizeReviewImageURL(req.ImageURL)
	if err != nil {
		return nil, err
	}
	req.ImageURL = imageURL

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

func (s *Service) AddImages(ctx context.Context, reviewID int64, reqs []*ReviewImageReq) ([]*ReviewImage, error) {
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
		imageURL, err := normalizeReviewImageURL(req.ImageURL)
		if err != nil {
			return nil, err
		}
		req.ImageURL = imageURL
		req.ReviewID = reviewID
	}

	images, err := s.reviewImageRepo.CreateReviewImages(ctx, reqs)
	if err != nil {
		return nil, apperr.ErrInternal
	}

	return images, nil
}

func (s *Service) UpdateImageMeta(ctx context.Context, id int64, altTxt *string, sortOrder *int) (*ReviewImage, error) {
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

func (s *Service) DeleteImage(ctx context.Context, id int64) error {
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

// hydrateImages attaches review_images in one batch query. Missing keys become [].
func (s *Service) hydrateImages(ctx context.Context, reviews ...*Review) error {
	ids := make([]int64, 0, len(reviews))
	for _, review := range reviews {
		if review == nil {
			continue
		}
		if review.Images == nil {
			review.Images = []ReviewImage{}
		}
		if review.ID > 0 {
			ids = append(ids, review.ID)
		}
	}
	if s.reviewImageRepo == nil || len(ids) == 0 {
		return nil
	}

	byReview, err := s.reviewImageRepo.GetImagesByReviewIDs(ctx, ids)
	if err != nil {
		return err
	}
	for _, review := range reviews {
		if review == nil {
			continue
		}
		images := byReview[review.ID]
		if images == nil {
			images = []ReviewImage{}
		}
		review.Images = images
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

// Review images render on the public PDP. Allow https hosts, /media/{key},
// and other origin-independent root-relative media paths. Reject javascript:,
// data:, http:, and protocol-relative hosts.
func normalizeReviewImageURL(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" || len(value) > 2048 {
		return "", apperr.ErrInvalidRequest
	}
	decoded, err := url.PathUnescape(value)
	if err != nil || strings.ContainsRune(value, '#') || strings.ContainsRune(decoded, '\\') {
		return "", apperr.ErrInvalidRequest
	}
	for _, r := range decoded {
		if unicode.IsControl(r) {
			return "", apperr.ErrInvalidRequest
		}
	}

	parsed, err := url.ParseRequestURI(value)
	if err != nil || parsed.User != nil || parsed.Fragment != "" {
		return "", apperr.ErrInvalidRequest
	}

	if strings.HasPrefix(value, "/") {
		if strings.HasPrefix(decoded, "//") || parsed.Scheme != "" || parsed.Host != "" {
			return "", apperr.ErrInvalidRequest
		}
		if strings.HasPrefix(value, "/media/") {
			key := strings.TrimPrefix(value, "/media/")
			if key == "" || strings.Contains(decoded, "..") {
				return "", apperr.ErrInvalidRequest
			}
		}
		return value, nil
	}

	if parsed.Scheme != "https" || parsed.Hostname() == "" {
		return "", apperr.ErrInvalidRequest
	}
	return value, nil
}

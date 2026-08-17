package reviews

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

type reviewRepoStub struct {
	createFn       func(context.Context, int64, CreateReviewReq, bool) (*Review, error)
	getByIDFn      func(context.Context, int64) (*Review, error)
	getAllFn       func(context.Context, ReviewFilter) ([]*Review, int64, error)
	hasReviewedFn  func(context.Context, int64, int64) (bool, error)
	hasPurchasedFn func(context.Context, int64, int64) (bool, error)
	getMineFn      func(context.Context, int64) ([]AccountReviewResponse, error)
	getPendingFn   func(context.Context, int64) ([]PendingReviewResponse, error)
	unlikeFn       func(context.Context, int64, int64) error
	unlikeCalls    int
}

func (s *reviewRepoStub) Create(ctx context.Context, userID int64, req CreateReviewReq, verified bool) (*Review, error) {
	return s.createFn(ctx, userID, req, verified)
}
func (s *reviewRepoStub) GetByID(ctx context.Context, id int64) (*Review, error) {
	if s.getByIDFn != nil {
		return s.getByIDFn(ctx, id)
	}
	return nil, models.ErrNotFound
}
func (s *reviewRepoStub) GetAll(ctx context.Context, filter ReviewFilter) ([]*Review, int64, error) {
	if s.getAllFn != nil {
		return s.getAllFn(ctx, filter)
	}
	return nil, 0, nil
}
func (*reviewRepoStub) Update(context.Context, int64, int64, UpdateReviewReq) (*Review, error) {
	return nil, models.ErrNotFound
}
func (*reviewRepoStub) UpdateStatus(context.Context, int64, UpdateReviewStatusReq) (*Review, error) {
	return nil, models.ErrNotFound
}
func (*reviewRepoStub) Delete(context.Context, int64, int64) error { return nil }
func (*reviewRepoStub) GetRatingSummary(context.Context, int64) (*ProductRatingSummary, error) {
	return nil, nil
}
func (*reviewRepoStub) React(context.Context, int64, int64, bool) error { return nil }
func (s *reviewRepoStub) Unlike(ctx context.Context, id, userID int64) error {
	s.unlikeCalls++
	if s.unlikeFn != nil {
		return s.unlikeFn(ctx, id, userID)
	}
	return nil
}
func (s *reviewRepoStub) HasReviewed(ctx context.Context, userID, productID int64) (bool, error) {
	return s.hasReviewedFn(ctx, userID, productID)
}
func (s *reviewRepoStub) HasPurchased(ctx context.Context, userID, productID int64) (bool, error) {
	return s.hasPurchasedFn(ctx, userID, productID)
}
func (s *reviewRepoStub) GetMine(ctx context.Context, userID int64) ([]AccountReviewResponse, error) {
	return s.getMineFn(ctx, userID)
}
func (s *reviewRepoStub) GetPending(ctx context.Context, userID int64) ([]PendingReviewResponse, error) {
	return s.getPendingFn(ctx, userID)
}

func TestReviewCreateAllowsNonBuyerWithUnverifiedFlag(t *testing.T) {
	verified := true
	repo := &reviewRepoStub{
		createFn: func(_ context.Context, _ int64, _ CreateReviewReq, value bool) (*Review, error) {
			verified = value
			return &Review{ID: 22}, nil
		},
		hasReviewedFn:  func(context.Context, int64, int64) (bool, error) { return false, nil },
		hasPurchasedFn: func(context.Context, int64, int64) (bool, error) { return false, nil },
	}
	service := NewService(repo, nil, nil)

	review, err := service.Create(context.Background(), 1, CreateReviewReq{
		ProductID: 7,
		Title:     "Title",
		Content:   "Content",
		Rating:    5,
	})

	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if review.ID != 22 || verified {
		t.Fatalf("review = %#v, verified = %v; want unverified non-buyer review", review, verified)
	}
}

func TestReviewCreateMarksVerifiedPurchase(t *testing.T) {
	verified := false
	repo := &reviewRepoStub{
		createFn: func(_ context.Context, _ int64, _ CreateReviewReq, value bool) (*Review, error) {
			verified = value
			return &Review{ID: 11}, nil
		},
		hasReviewedFn:  func(context.Context, int64, int64) (bool, error) { return false, nil },
		hasPurchasedFn: func(context.Context, int64, int64) (bool, error) { return true, nil },
	}
	service := NewService(repo, nil, nil)

	review, err := service.Create(context.Background(), 1, CreateReviewReq{
		ProductID: 7,
		Title:     "Title",
		Content:   "Content",
		Rating:    5,
	})

	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if review.ID != 11 || !verified {
		t.Fatalf("review = %#v, verified = %v", review, verified)
	}
}

type loyaltyStub struct {
	calls int
	last  struct {
		userID, reviewID int64
		verified         bool
	}
}

func (l *loyaltyStub) AwardForReview(_ context.Context, userID, reviewID int64, verifiedPurchase bool) error {
	l.calls++
	l.last.userID, l.last.reviewID, l.last.verified = userID, reviewID, verifiedPurchase
	return nil
}

func TestReviewCreateAwardsLoyaltyWhenVerified(t *testing.T) {
	repo := &reviewRepoStub{
		createFn: func(_ context.Context, _ int64, _ CreateReviewReq, verified bool) (*Review, error) {
			return &Review{ID: 55}, nil
		},
		hasReviewedFn:  func(context.Context, int64, int64) (bool, error) { return false, nil },
		hasPurchasedFn: func(context.Context, int64, int64) (bool, error) { return true, nil },
	}
	loy := &loyaltyStub{}
	service := NewService(repo, nil, loy)
	if _, err := service.Create(context.Background(), 3, CreateReviewReq{
		ProductID: 7, Title: "T", Content: "C", Rating: 5,
	}); err != nil {
		t.Fatal(err)
	}
	if loy.calls != 1 || loy.last.reviewID != 55 || !loy.last.verified || loy.last.userID != 3 {
		t.Fatalf("loyalty call = %+v", loy)
	}
}

func TestReviewAccountListsReturnEmptyArrays(t *testing.T) {
	repo := &reviewRepoStub{
		getMineFn:    func(context.Context, int64) ([]AccountReviewResponse, error) { return nil, nil },
		getPendingFn: func(context.Context, int64) ([]PendingReviewResponse, error) { return nil, nil },
	}
	service := NewService(repo, nil, nil)

	mine, err := service.GetMine(context.Background(), 1)
	if err != nil || mine == nil || len(mine) != 0 {
		t.Fatalf("GetMine() = %#v, %v; want non-nil empty slice", mine, err)
	}
	pending, err := service.GetPending(context.Background(), 1)
	if err != nil || pending == nil || len(pending) != 0 {
		t.Fatalf("GetPending() = %#v, %v; want non-nil empty slice", pending, err)
	}
}

type imageRepoStub struct {
	createFn         func(context.Context, *ReviewImageReq) (*ReviewImage, error)
	created          *ReviewImageReq
	getByReviewIDsFn func(context.Context, []int64) (map[int64][]ReviewImage, error)
	batchCalls       int
	lastBatchIDs     []int64
}

func (s *imageRepoStub) GetImagesByReviewID(context.Context, int64) ([]*ReviewImage, error) {
	return nil, nil
}
func (s *imageRepoStub) GetImagesByReviewIDs(ctx context.Context, ids []int64) (map[int64][]ReviewImage, error) {
	s.batchCalls++
	s.lastBatchIDs = append([]int64(nil), ids...)
	if s.getByReviewIDsFn != nil {
		return s.getByReviewIDsFn(ctx, ids)
	}
	return map[int64][]ReviewImage{}, nil
}
func (s *imageRepoStub) CreateReviewImage(ctx context.Context, req *ReviewImageReq) (*ReviewImage, error) {
	s.created = req
	if s.createFn != nil {
		return s.createFn(ctx, req)
	}
	return &ReviewImage{ID: 1, ReviewID: req.ReviewID, ImageURL: req.ImageURL}, nil
}
func (*imageRepoStub) CreateReviewImages(context.Context, []*ReviewImageReq) ([]*ReviewImage, error) {
	return nil, nil
}
func (*imageRepoStub) UpdateReviewImageMeta(context.Context, int64, *string, *int) (*ReviewImage, error) {
	return nil, models.ErrNotFound
}
func (*imageRepoStub) DeleteReviewImage(context.Context, int64) error { return nil }
func (*imageRepoStub) DeleteImagesByReviewID(context.Context, int64) error {
	return nil
}

func ownedReviewRepo(userID, reviewID int64) *reviewRepoStub {
	return &reviewRepoStub{
		getByIDFn: func(_ context.Context, id int64) (*Review, error) {
			if id != reviewID {
				return nil, models.ErrNotFound
			}
			return &Review{ID: reviewID, UserID: userID}, nil
		},
	}
}

func TestNormalizeReviewImageURL(t *testing.T) {
	tests := []struct {
		name    string
		value   string
		want    string
		wantErr bool
	}{
		{name: "https", value: " https://cdn.example/img.jpg ", want: "https://cdn.example/img.jpg"},
		{name: "media path", value: "/media/reviews/12/photo.webp", want: "/media/reviews/12/photo.webp"},
		{name: "static path", value: "/images/reviews/bottle.jpg", want: "/images/reviews/bottle.jpg"},
		{name: "javascript", value: "javascript:alert(1)", wantErr: true},
		{name: "data", value: "data:image/png;base64,xxxx", wantErr: true},
		{name: "http host", value: "http://evil.example/tracker.jpg", wantErr: true},
		{name: "protocol-relative", value: "//evil.example/img.jpg", wantErr: true},
		{name: "credentials", value: "https://user:pass@cdn.example/img.jpg", wantErr: true},
		{name: "empty media key", value: "/media/", wantErr: true},
		{name: "parent traversal", value: "/media/../secret.webp", wantErr: true},
		{name: "blank", value: "   ", wantErr: true},
		{name: "too long", value: "https://cdn.example/" + strings.Repeat("a", 2048), wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := normalizeReviewImageURL(tt.value)
			if tt.wantErr {
				if !errors.Is(err, apperr.ErrInvalidRequest) {
					t.Fatalf("error = %v; want invalid request", err)
				}
				return
			}
			if err != nil {
				t.Fatalf("normalizeReviewImageURL: %v", err)
			}
			if got != tt.want {
				t.Fatalf("got %q; want %q", got, tt.want)
			}
		})
	}
}

func TestAddImageAllowsHTTPSAndMedia(t *testing.T) {
	tests := []struct {
		name string
		url  string
	}{
		{name: "https", url: "https://cdn.example/review.webp"},
		{name: "media", url: "/media/reviews/9/photo.webp"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			images := &imageRepoStub{}
			service := NewService(ownedReviewRepo(3, 9), images, nil)
			got, err := service.AddImage(context.Background(), 9, 3, &ReviewImageReq{ImageURL: tt.url})
			if err != nil {
				t.Fatalf("AddImage() error = %v", err)
			}
			if got == nil || got.ImageURL != tt.url {
				t.Fatalf("image = %#v; want url %q", got, tt.url)
			}
			if images.created == nil || images.created.ImageURL != tt.url {
				t.Fatalf("stored = %#v; want url %q", images.created, tt.url)
			}
		})
	}
}

func TestGetByIDHydratesImages(t *testing.T) {
	repo := &reviewRepoStub{
		getByIDFn: func(_ context.Context, id int64) (*Review, error) {
			return &Review{ID: id, Title: "Excellent", Status: ReviewStatusApproved}, nil
		},
	}
	images := &imageRepoStub{
		getByReviewIDsFn: func(_ context.Context, ids []int64) (map[int64][]ReviewImage, error) {
			return map[int64][]ReviewImage{
				12: {{ID: 3, ReviewID: 12, ImageURL: "https://cdn.example/review.webp", SortOrder: 0}},
			}, nil
		},
	}
	service := NewService(repo, images, nil)

	got, err := service.GetByID(context.Background(), 12)
	if err != nil {
		t.Fatalf("GetByID() error = %v", err)
	}
	if images.batchCalls != 1 {
		t.Fatalf("batch calls = %d; want 1", images.batchCalls)
	}
	if len(images.lastBatchIDs) != 1 || images.lastBatchIDs[0] != 12 {
		t.Fatalf("batch ids = %v; want [12]", images.lastBatchIDs)
	}
	if got == nil || len(got.Images) != 1 || got.Images[0].ImageURL != "https://cdn.example/review.webp" {
		t.Fatalf("review images = %#v; want hydrated image", got)
	}
}

func TestGetByIDHydratesEmptyImages(t *testing.T) {
	repo := &reviewRepoStub{
		getByIDFn: func(_ context.Context, id int64) (*Review, error) {
			return &Review{ID: id, Title: "Plain"}, nil
		},
	}
	service := NewService(repo, &imageRepoStub{}, nil)

	got, err := service.GetByID(context.Background(), 8)
	if err != nil {
		t.Fatalf("GetByID() error = %v", err)
	}
	if got == nil || got.Images == nil || len(got.Images) != 0 {
		t.Fatalf("images = %#v; want non-nil empty slice", got)
	}
}

func TestGetAllHydratesImagesInOneBatch(t *testing.T) {
	repo := &reviewRepoStub{
		getAllFn: func(context.Context, ReviewFilter) ([]*Review, int64, error) {
			return []*Review{
				{ID: 10, Title: "A", Status: ReviewStatusApproved},
				{ID: 11, Title: "B", Status: ReviewStatusApproved},
			}, 2, nil
		},
	}
	images := &imageRepoStub{
		getByReviewIDsFn: func(_ context.Context, ids []int64) (map[int64][]ReviewImage, error) {
			return map[int64][]ReviewImage{
				10: {{ID: 1, ReviewID: 10, ImageURL: "https://cdn.example/a.jpg"}},
				11: {
					{ID: 2, ReviewID: 11, ImageURL: "/media/reviews/11/b.webp", SortOrder: 0},
					{ID: 3, ReviewID: 11, ImageURL: "/media/reviews/11/c.webp", SortOrder: 1},
				},
			}, nil
		},
	}
	service := NewService(repo, images, nil)

	filter := ReviewFilter{}
	filter.Limit = 20
	got, total, err := service.GetAll(context.Background(), filter)
	if err != nil {
		t.Fatalf("GetAll() error = %v", err)
	}
	if total != 2 || len(got) != 2 {
		t.Fatalf("GetAll() = %#v, total=%d", got, total)
	}
	if images.batchCalls != 1 {
		t.Fatalf("batch calls = %d; want 1 (no N+1)", images.batchCalls)
	}
	if len(images.lastBatchIDs) != 2 || images.lastBatchIDs[0] != 10 || images.lastBatchIDs[1] != 11 {
		t.Fatalf("batch ids = %v; want [10 11]", images.lastBatchIDs)
	}
	if len(got[0].Images) != 1 || got[0].Images[0].ImageURL != "https://cdn.example/a.jpg" {
		t.Fatalf("review 10 images = %#v", got[0].Images)
	}
	if len(got[1].Images) != 2 || got[1].Images[1].ImageURL != "/media/reviews/11/c.webp" {
		t.Fatalf("review 11 images = %#v", got[1].Images)
	}
}

func TestGetAllHydratesMissingImagesAsEmpty(t *testing.T) {
	repo := &reviewRepoStub{
		getAllFn: func(context.Context, ReviewFilter) ([]*Review, int64, error) {
			return []*Review{{ID: 4, Title: "No photos"}}, 1, nil
		},
	}
	service := NewService(repo, &imageRepoStub{}, nil)

	filter := ReviewFilter{}
	filter.Limit = 20
	got, _, err := service.GetAll(context.Background(), filter)
	if err != nil {
		t.Fatalf("GetAll() error = %v", err)
	}
	if len(got) != 1 || got[0].Images == nil || len(got[0].Images) != 0 {
		t.Fatalf("images = %#v; want non-nil empty slice", got)
	}
}

func TestGetByIDImageLoadError(t *testing.T) {
	repo := &reviewRepoStub{
		getByIDFn: func(context.Context, int64) (*Review, error) {
			return &Review{ID: 1}, nil
		},
	}
	images := &imageRepoStub{
		getByReviewIDsFn: func(context.Context, []int64) (map[int64][]ReviewImage, error) {
			return nil, errors.New("db down")
		},
	}
	service := NewService(repo, images, nil)
	if _, err := service.GetByID(context.Background(), 1); !errors.Is(err, apperr.ErrInternal) {
		t.Fatalf("error = %v; want internal", err)
	}
}

func TestAddImageRejectsUnsafeURL(t *testing.T) {
	images := &imageRepoStub{}
	service := NewService(ownedReviewRepo(3, 9), images, nil)
	for _, raw := range []string{
		"javascript:alert(1)",
		"http://evil.example/tracker.jpg",
		"data:image/gif;base64,xx",
		"//evil.example/img.jpg",
	} {
		_, err := service.AddImage(context.Background(), 9, 3, &ReviewImageReq{ImageURL: raw})
		if !errors.Is(err, apperr.ErrInvalidRequest) {
			t.Fatalf("AddImage(%q) error = %v; want invalid request", raw, err)
		}
		if images.created != nil {
			t.Fatalf("unsafe url %q reached repository", raw)
		}
	}
}

func TestUnlikeIdempotentWhenNoVote(t *testing.T) {
	repo := &reviewRepoStub{
		unlikeFn: func(context.Context, int64, int64) error { return nil },
	}
	service := NewService(repo, nil, nil)
	if err := service.Unlike(context.Background(), 12, 3); err != nil {
		t.Fatalf("Unlike() error = %v; want nil (idempotent)", err)
	}
	if repo.unlikeCalls != 1 {
		t.Fatalf("unlike calls = %d; want 1", repo.unlikeCalls)
	}
}

func TestUnlikeMissingReview(t *testing.T) {
	repo := &reviewRepoStub{
		unlikeFn: func(context.Context, int64, int64) error { return models.ErrNotFound },
	}
	service := NewService(repo, nil, nil)
	if err := service.Unlike(context.Background(), 12, 3); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("Unlike() error = %v; want not found", err)
	}
}

func TestUnlikeRejectsInvalidIDs(t *testing.T) {
	repo := &reviewRepoStub{}
	service := NewService(repo, nil, nil)
	if err := service.Unlike(context.Background(), 0, 1); !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("Unlike(0, 1) error = %v; want invalid request", err)
	}
	if err := service.Unlike(context.Background(), 1, 0); !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("Unlike(1, 0) error = %v; want invalid request", err)
	}
	if repo.unlikeCalls != 0 {
		t.Fatalf("unlike calls = %d; want 0 for invalid ids", repo.unlikeCalls)
	}
}

func TestUnlikeMapsInternalError(t *testing.T) {
	repo := &reviewRepoStub{
		unlikeFn: func(context.Context, int64, int64) error { return errors.New("db down") },
	}
	service := NewService(repo, nil, nil)
	if err := service.Unlike(context.Background(), 12, 3); !errors.Is(err, apperr.ErrInternal) {
		t.Fatalf("Unlike() error = %v; want internal", err)
	}
}

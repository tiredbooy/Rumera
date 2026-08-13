package reviews

import (
	"context"
	"testing"

	"github.com/tiredbooy/internal/models"
)

type reviewRepoStub struct {
	createFn       func(context.Context, int64, CreateReviewReq, bool) (*Review, error)
	hasReviewedFn  func(context.Context, int64, int64) (bool, error)
	hasPurchasedFn func(context.Context, int64, int64) (bool, error)
	getMineFn      func(context.Context, int64) ([]AccountReviewResponse, error)
	getPendingFn   func(context.Context, int64) ([]PendingReviewResponse, error)
}

func (s *reviewRepoStub) Create(ctx context.Context, userID int64, req CreateReviewReq, verified bool) (*Review, error) {
	return s.createFn(ctx, userID, req, verified)
}
func (*reviewRepoStub) GetByID(context.Context, int64) (*Review, error) {
	return nil, models.ErrNotFound
}
func (*reviewRepoStub) GetAll(context.Context, ReviewFilter) ([]*Review, int64, error) {
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

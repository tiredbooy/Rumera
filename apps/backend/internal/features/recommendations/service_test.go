package recommendations

import (
	"context"
	"errors"
	"testing"

	"github.com/tiredbooy/internal/features/taste"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

type repoStub struct {
	Repository

	profile      *UserRecommendationProfile
	profileErr   error
	computed     *UserRecommendationProfile
	computeErr   error
	computeCalls int

	forUser       []*RecommendationItem
	forUserErr    error
	gotForUser    *UserRecommendationProfile
	forUserCalls  int
	trending      []*RecommendationItem
	trendingCalls int
	purchased     []int64

	catIDs    []int64
	tagIDs    []int64
	catLookup []string
	tagLookup []string
	catErr    error
	tagErr    error

	exists      bool
	existsErr   error
	orderIDs    []int64
	orderIDsErr error
	inserted    bool
	recordErr   error
	recordCalls int
	lastUserID  int64
	lastReq     *InteractionReq
	lastWeight  float64
}

func (s *repoStub) GetProfile(context.Context, int64) (*UserRecommendationProfile, error) {
	if s.profileErr != nil {
		return nil, s.profileErr
	}
	return s.profile, nil
}

func (s *repoStub) ComputeProfile(context.Context, int64) (*UserRecommendationProfile, error) {
	s.computeCalls++
	if s.computeErr != nil {
		return nil, s.computeErr
	}
	return s.computed, nil
}

func (s *repoStub) PurchasedProductIDs(context.Context, int64) ([]int64, error) {
	return s.purchased, nil
}

func (s *repoStub) ForUser(_ context.Context, profile *UserRecommendationProfile, _ []int64, _ RecommendationQuery) ([]*RecommendationItem, error) {
	s.forUserCalls++
	s.gotForUser = profile
	return s.forUser, s.forUserErr
}

func (s *repoStub) Trending(context.Context, RecommendationQuery) ([]*RecommendationItem, error) {
	s.trendingCalls++
	return s.trending, nil
}

func (s *repoStub) LookupCategoryIDs(_ context.Context, names []string) ([]int64, error) {
	s.catLookup = append([]string(nil), names...)
	if s.catErr != nil {
		return nil, s.catErr
	}
	return s.catIDs, nil
}

func (s *repoStub) LookupTagIDs(_ context.Context, names []string) ([]int64, error) {
	s.tagLookup = append([]string(nil), names...)
	if s.tagErr != nil {
		return nil, s.tagErr
	}
	return s.tagIDs, nil
}

func (s *repoStub) ProductExists(context.Context, int64) (bool, error) {
	if s.existsErr != nil {
		return false, s.existsErr
	}
	return s.exists, nil
}

func (s *repoStub) OrderProductIDs(context.Context, int64) ([]int64, error) {
	if s.orderIDsErr != nil {
		return nil, s.orderIDsErr
	}
	return s.orderIDs, nil
}

func (s *repoStub) RecordInteraction(_ context.Context, userID int64, req *InteractionReq, weight float64) (bool, error) {
	s.recordCalls++
	s.lastUserID = userID
	s.lastReq = req
	s.lastWeight = weight
	if s.recordErr != nil {
		return false, s.recordErr
	}
	return s.inserted, nil
}

type tasteStub struct {
	profile *taste.TasteProfile
	err     error
	calls   int
}

func (s *tasteStub) Get(context.Context, int64) (*taste.TasteProfile, error) {
	s.calls++
	if s.err != nil {
		return nil, s.err
	}
	return s.profile, nil
}

func TestForYouRejectsZeroUser(t *testing.T) {
	svc := NewService(&repoStub{}, nil)
	_, err := svc.ForYou(context.Background(), 0, RecommendationQuery{})
	if err != apperr.ErrInvalidRequest {
		t.Fatalf("err = %v, want ErrInvalidRequest", err)
	}
}

func TestForYouNoProfileNoTasteStaysTrending(t *testing.T) {
	repo := &repoStub{
		profileErr: models.ErrNotFound,
		computed:   &UserRecommendationProfile{UserID: 9},
		trending:   []*RecommendationItem{{ProductID: 1}},
	}
	items, err := NewService(repo, &tasteStub{profile: &taste.TasteProfile{}}).ForYou(
		context.Background(), 9, RecommendationQuery{Limit: 4},
	)
	if err != nil {
		t.Fatalf("ForYou: %v", err)
	}
	if repo.computeCalls != 1 || repo.forUserCalls != 0 || repo.trendingCalls != 1 {
		t.Fatalf("compute=%d forUser=%d trending=%d", repo.computeCalls, repo.forUserCalls, repo.trendingCalls)
	}
	if len(items) != 1 || items[0].Reason != ReasonTrending {
		t.Fatalf("items = %#v", items)
	}
}

func TestForYouNilTasteReaderKeepsCurrent(t *testing.T) {
	repo := &repoStub{
		profile:  &UserRecommendationProfile{UserID: 3},
		trending: []*RecommendationItem{{ProductID: 2}},
	}
	items, err := NewService(repo, nil).ForYou(context.Background(), 3, RecommendationQuery{Limit: 4})
	if err != nil {
		t.Fatalf("ForYou: %v", err)
	}
	if repo.forUserCalls != 0 || repo.trendingCalls != 1 {
		t.Fatalf("forUser=%d trending=%d", repo.forUserCalls, repo.trendingCalls)
	}
	if items[0].Reason != ReasonTrending {
		t.Fatalf("reason = %s", items[0].Reason)
	}
}

func TestForYouTasteOnlyPersonalizes(t *testing.T) {
	repo := &repoStub{
		profile: &UserRecommendationProfile{UserID: 4},
		catIDs:  []int64{11},
		tagIDs:  []int64{21},
		forUser: []*RecommendationItem{{ProductID: 80, Score: 8}},
	}
	quiz := &taste.TasteProfile{
		Categories: []string{"Whisky"},
		Flavor:     []string{"دودی"},
		Occasions:  []string{"هدیه"},
	}
	items, err := NewService(repo, &tasteStub{profile: quiz}).ForYou(
		context.Background(), 4, RecommendationQuery{Limit: 1},
	)
	if err != nil {
		t.Fatalf("ForYou: %v", err)
	}
	if repo.trendingCalls != 0 || repo.forUserCalls != 1 {
		t.Fatalf("forUser=%d trending=%d", repo.forUserCalls, repo.trendingCalls)
	}
	if !equalStrings(repo.catLookup, []string{"Whisky"}) {
		t.Fatalf("cat lookup = %#v", repo.catLookup)
	}
	if !equalStrings(repo.tagLookup, []string{"دودی", "هدیه"}) {
		t.Fatalf("tag lookup = %#v", repo.tagLookup)
	}
	got := repo.gotForUser
	if got == nil || len(got.TopCategories) != 1 || got.TopCategories[0].ID != 11 || got.TopCategories[0].Score != tasteCategoryWeight {
		t.Fatalf("blended categories = %#v", got)
	}
	if len(got.TopTags) != 1 || got.TopTags[0].ID != 21 || got.TopTags[0].Score != tasteTagWeight {
		t.Fatalf("blended tags = %#v", got)
	}
	if len(items) != 1 || items[0].Reason != ReasonForYou {
		t.Fatalf("items = %#v", items)
	}
}

func TestForYouBlendsTasteOntoBehaviouralProfile(t *testing.T) {
	repo := &repoStub{
		profile: &UserRecommendationProfile{
			UserID:        5,
			TopCategories: []AffinityScore{{ID: 11, Score: 10}},
			TopBrands:     []AffinityScore{{ID: 3, Score: 6}},
		},
		catIDs:  []int64{11, 12},
		tagIDs:  []int64{21},
		forUser: []*RecommendationItem{{ProductID: 81}},
	}
	quiz := &taste.TasteProfile{Categories: []string{"Wine"}, Flavor: []string{"خشک"}}
	_, err := NewService(repo, &tasteStub{profile: quiz}).ForYou(
		context.Background(), 5, RecommendationQuery{Limit: 1},
	)
	if err != nil {
		t.Fatalf("ForYou: %v", err)
	}
	got := repo.gotForUser
	if got.TopCategories[0].Score != 10+tasteCategoryWeight || got.TopCategories[1].ID != 12 {
		t.Fatalf("categories = %#v", got.TopCategories)
	}
	if got.TopBrands[0].Score != 6 {
		t.Fatalf("brands should be untouched: %#v", got.TopBrands)
	}
	if got.TopTags[0].ID != 21 {
		t.Fatalf("tags = %#v", got.TopTags)
	}
}

func TestForYouTasteLookupMissKeepsCurrent(t *testing.T) {
	repo := &repoStub{
		profile:  &UserRecommendationProfile{UserID: 6},
		trending: []*RecommendationItem{{ProductID: 3}},
	}
	quiz := &taste.TasteProfile{Categories: []string{"Gin"}}
	items, err := NewService(repo, &tasteStub{profile: quiz}).ForYou(
		context.Background(), 6, RecommendationQuery{Limit: 4},
	)
	if err != nil {
		t.Fatalf("ForYou: %v", err)
	}
	if repo.forUserCalls != 0 || repo.trendingCalls != 1 {
		t.Fatalf("unresolved quiz should not personalize: forUser=%d trending=%d", repo.forUserCalls, repo.trendingCalls)
	}
	if items[0].Reason != ReasonTrending {
		t.Fatalf("reason = %s", items[0].Reason)
	}
}

func TestForYouTasteGetErrorFallsBack(t *testing.T) {
	repo := &repoStub{
		profile: &UserRecommendationProfile{
			UserID:    7,
			TopBrands: []AffinityScore{{ID: 1, Score: 3}},
		},
		forUser: []*RecommendationItem{{ProductID: 9}},
	}
	_, err := NewService(repo, &tasteStub{err: errors.New("db down")}).ForYou(
		context.Background(), 7, RecommendationQuery{Limit: 1},
	)
	if err != nil {
		t.Fatalf("ForYou: %v", err)
	}
	if repo.forUserCalls != 1 || repo.gotForUser.TopBrands[0].Score != 3 {
		t.Fatalf("taste error should not change behavioural profile: %#v", repo.gotForUser)
	}
	if len(repo.gotForUser.TopCategories) != 0 {
		t.Fatalf("unexpected taste overlay: %#v", repo.gotForUser.TopCategories)
	}
}

func TestForYouCatalogueLookupErrorFallsBackToBehavioural(t *testing.T) {
	repo := &repoStub{
		profile: &UserRecommendationProfile{
			UserID:        8,
			TopCategories: []AffinityScore{{ID: 11, Score: 10}},
		},
		catErr:  errors.New("categories down"),
		tagErr:  errors.New("tags down"),
		forUser: []*RecommendationItem{{ProductID: 1}},
	}
	quiz := &taste.TasteProfile{Categories: []string{"Whisky"}, Flavor: []string{"دودی"}}
	_, err := NewService(repo, &tasteStub{profile: quiz}).ForYou(
		context.Background(), 8, RecommendationQuery{Limit: 1},
	)
	if err != nil {
		t.Fatalf("ForYou: %v", err)
	}
	if repo.gotForUser.TopCategories[0].Score != 10 {
		t.Fatalf("lookup error should leave scores: %#v", repo.gotForUser.TopCategories)
	}
}

func TestRecordInteractionRejectsUnknownProduct(t *testing.T) {
	repo := &repoStub{exists: false}
	err := NewService(repo, nil).RecordInteraction(context.Background(), 3, &InteractionReq{
		ProductID: 99, InteractionType: InteractionView,
	})
	if !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("err = %v, want ErrNotFound", err)
	}
	if repo.recordCalls != 0 {
		t.Fatalf("recordCalls = %d, want 0", repo.recordCalls)
	}
}

func TestRecordInteractionProductExistsErrorIsNotEmptySuccess(t *testing.T) {
	repo := &repoStub{existsErr: errors.New("products down")}
	err := NewService(repo, nil).RecordInteraction(context.Background(), 3, &InteractionReq{
		ProductID: 4, InteractionType: InteractionAddToCart,
	})
	if err == nil {
		t.Fatal("existence lookup failure must not succeed")
	}
	if errors.Is(err, apperr.ErrNotFound) {
		t.Fatal("lookup error must not look like missing product")
	}
	if repo.recordCalls != 0 {
		t.Fatalf("recordCalls = %d, want 0", repo.recordCalls)
	}
}

func TestRecordInteractionInsertsWhenProductExists(t *testing.T) {
	repo := &repoStub{exists: true, inserted: true}
	err := NewService(repo, nil).RecordInteraction(context.Background(), 3, &InteractionReq{
		ProductID: 4, InteractionType: InteractionAddToCart,
	})
	if err != nil {
		t.Fatalf("RecordInteraction: %v", err)
	}
	if repo.recordCalls != 1 || repo.lastUserID != 3 || repo.lastReq.ProductID != 4 {
		t.Fatalf("recorded user=%d req=%#v calls=%d", repo.lastUserID, repo.lastReq, repo.recordCalls)
	}
	if repo.lastWeight != InteractionAddToCart.WeightFor() {
		t.Fatalf("weight = %v", repo.lastWeight)
	}
}

func TestRecordPurchasesForOrderWritesDistinctProducts(t *testing.T) {
	repo := &repoStub{exists: true, inserted: true, orderIDs: []int64{10, 11}}
	err := NewService(repo, nil).RecordPurchasesForOrder(context.Background(), 7, 88)
	if err != nil {
		t.Fatalf("RecordPurchasesForOrder: %v", err)
	}
	if repo.recordCalls != 2 {
		t.Fatalf("recordCalls = %d, want 2", repo.recordCalls)
	}
	if repo.lastReq == nil || repo.lastReq.InteractionType != InteractionPurchase {
		t.Fatalf("last type = %#v", repo.lastReq)
	}
	if repo.lastReq.Source == nil || *repo.lastReq.Source != purchaseSource {
		t.Fatalf("source = %#v", repo.lastReq.Source)
	}
	if got, _ := repo.lastReq.Metadata["order_id"].(string); got != "88" {
		t.Fatalf("order_id metadata = %#v", repo.lastReq.Metadata)
	}
}

func TestRecordPurchasesForOrderSkipsMissingProduct(t *testing.T) {
	repo := &repoStub{exists: false, orderIDs: []int64{10}}
	err := NewService(repo, nil).RecordPurchasesForOrder(context.Background(), 7, 88)
	if err != nil {
		t.Fatalf("missing product must be skipped: %v", err)
	}
	if repo.recordCalls != 0 {
		t.Fatalf("recordCalls = %d, want 0", repo.recordCalls)
	}
}

func TestRecordPurchasesForOrderQueryErrorIsNotEmptySuccess(t *testing.T) {
	repo := &repoStub{orderIDsErr: errors.New("order_items down")}
	err := NewService(repo, nil).RecordPurchasesForOrder(context.Background(), 7, 88)
	if err == nil {
		t.Fatal("order line lookup failure must not succeed as empty")
	}
	if repo.recordCalls != 0 {
		t.Fatalf("recordCalls = %d, want 0", repo.recordCalls)
	}
}

func TestRecordPurchasesForOrderRejectsZeroIDs(t *testing.T) {
	svc := NewService(&repoStub{}, nil)
	if err := svc.RecordPurchasesForOrder(context.Background(), 0, 1); !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("user 0: %v", err)
	}
	if err := svc.RecordPurchasesForOrder(context.Background(), 1, 0); !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("order 0: %v", err)
	}
}

func equalStrings(got, want []string) bool {
	if len(got) != len(want) {
		return false
	}
	for i := range want {
		if got[i] != want[i] {
			return false
		}
	}
	return true
}

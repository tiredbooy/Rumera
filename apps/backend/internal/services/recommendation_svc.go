package services

import (
	"context"
	"errors"
	"fmt"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
)

// Recommendation reason codes returned to the client so the UI can label each
// carousel ("Trending now", "Because you viewed…", "Frequently bought together").
const (
	ReasonTrending = "trending"
	ReasonSimilar  = "similar"
	ReasonFBT      = "frequently_bought_together"
	ReasonForYou   = "for_you"
	ReasonRecipe   = "recipe"
)

type RecommendationService interface {
	RecordInteraction(ctx context.Context, userID int64, req *models.InteractionReq) error

	Trending(ctx context.Context, q models.RecommendationQuery) ([]*models.RecommendationItem, error)
	Similar(ctx context.Context, productID int64, q models.RecommendationQuery) ([]*models.RecommendationItem, error)
	FrequentlyBoughtTogether(ctx context.Context, productID int64, q models.RecommendationQuery) ([]*models.RecommendationItem, error)
	ForYou(ctx context.Context, userID int64, q models.RecommendationQuery) ([]*models.RecommendationItem, error)

	GetProfile(ctx context.Context, userID int64) (*models.UserRecommendationProfile, error)
	RecomputeProfile(ctx context.Context, userID int64) (*models.UserRecommendationProfile, error)
}

type recommendationService struct {
	repo repositories.RecommendationRepository
}

func NewRecommendationService(repo repositories.RecommendationRepository) RecommendationService {
	return &recommendationService{repo: repo}
}

// RecordInteraction logs an implicit-feedback signal, applying the configured
// weight for the interaction type.
func (s *recommendationService) RecordInteraction(ctx context.Context, userID int64, req *models.InteractionReq) error {
	if userID <= 0 || req == nil {
		return apperr.ErrInvalidRequest
	}
	if !req.InteractionType.Valid() || req.ProductID <= 0 {
		return apperr.ErrInvalidRequest
	}
	weight := req.InteractionType.WeightFor()
	if err := s.repo.RecordInteraction(ctx, userID, req, weight); err != nil {
		return fmt.Errorf("recommendationService.RecordInteraction: %w", err)
	}
	return nil
}

func (s *recommendationService) Trending(ctx context.Context, q models.RecommendationQuery) ([]*models.RecommendationItem, error) {
	q.Defaults()
	items, err := s.repo.Trending(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("recommendationService.Trending: %w", err)
	}
	return withReason(items, ReasonTrending), nil
}

func (s *recommendationService) Similar(ctx context.Context, productID int64, q models.RecommendationQuery) ([]*models.RecommendationItem, error) {
	if productID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	q.Defaults()
	items, err := s.repo.Similar(ctx, productID, q)
	if err != nil {
		return nil, fmt.Errorf("recommendationService.Similar: %w", err)
	}
	return withReason(items, ReasonSimilar), nil
}

// FrequentlyBoughtTogether returns order co-occurrence picks, falling back to
// content-similar products when the item is too new to have basket history.
func (s *recommendationService) FrequentlyBoughtTogether(ctx context.Context, productID int64, q models.RecommendationQuery) ([]*models.RecommendationItem, error) {
	if productID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	q.Defaults()
	items, err := s.repo.FrequentlyBoughtTogether(ctx, productID, q)
	if err != nil {
		return nil, fmt.Errorf("recommendationService.FrequentlyBoughtTogether: %w", err)
	}
	if len(items) == 0 {
		return s.Similar(ctx, productID, q)
	}
	return withReason(items, ReasonFBT), nil
}

// ForYou serves personalized recommendations. It lazily builds the profile on a
// cache miss and always backfills to trending so the response is never empty —
// crucial for a storefront homepage.
func (s *recommendationService) ForYou(ctx context.Context, userID int64, q models.RecommendationQuery) ([]*models.RecommendationItem, error) {
	if userID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	q.Defaults()

	profile, err := s.repo.GetProfile(ctx, userID)
	if err != nil {
		if !errors.Is(err, models.ErrNotFound) {
			return nil, fmt.Errorf("recommendationService.ForYou: %w", err)
		}
		// No profile yet — compute one on demand.
		profile, err = s.repo.ComputeProfile(ctx, userID)
		if err != nil {
			return nil, fmt.Errorf("recommendationService.ForYou: compute: %w", err)
		}
	}

	// Cold user with no signal → pure trending.
	if !profile.HasSignal() {
		return s.Trending(ctx, q)
	}

	excluded, err := s.repo.PurchasedProductIDs(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("recommendationService.ForYou: exclusions: %w", err)
	}

	items, err := s.repo.ForUser(ctx, profile, excluded, q)
	if err != nil {
		return nil, fmt.Errorf("recommendationService.ForYou: %w", err)
	}
	items = withReason(items, ReasonForYou)

	// Backfill with trending if personalization is thin.
	if len(items) < q.Limit {
		items = s.backfill(ctx, items, excluded, q)
	}
	return items, nil
}

func (s *recommendationService) GetProfile(ctx context.Context, userID int64) (*models.UserRecommendationProfile, error) {
	if userID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	profile, err := s.repo.GetProfile(ctx, userID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("recommendationService.GetProfile: %w", err)
	}
	return profile, nil
}

func (s *recommendationService) RecomputeProfile(ctx context.Context, userID int64) (*models.UserRecommendationProfile, error) {
	if userID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	profile, err := s.repo.ComputeProfile(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("recommendationService.RecomputeProfile: %w", err)
	}
	return profile, nil
}

// backfill tops up a personalized list with trending products, skipping anything
// already present or already purchased.
func (s *recommendationService) backfill(ctx context.Context, items []*models.RecommendationItem, excluded []int64, q models.RecommendationQuery) []*models.RecommendationItem {
	seen := make(map[int64]struct{}, len(items)+len(excluded))
	for _, it := range items {
		seen[it.ProductID] = struct{}{}
	}
	for _, id := range excluded {
		seen[id] = struct{}{}
	}

	tq := q
	tq.Limit = q.Limit * 2 // over-fetch so we have enough after dedup
	trending, err := s.repo.Trending(ctx, tq)
	if err != nil {
		return items // best-effort; return what we have
	}

	for _, t := range trending {
		if len(items) >= q.Limit {
			break
		}
		if _, dup := seen[t.ProductID]; dup {
			continue
		}
		t.Reason = ReasonTrending
		items = append(items, t)
		seen[t.ProductID] = struct{}{}
	}
	return items
}

func withReason(items []*models.RecommendationItem, reason string) []*models.RecommendationItem {
	for _, it := range items {
		it.Reason = reason
	}
	return items
}

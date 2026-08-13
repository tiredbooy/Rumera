package recommendations

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
	"github.com/tiredbooy/pkg/metrics"
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

type Service interface {
	RecordInteraction(ctx context.Context, userID int64, req *InteractionReq) error

	Trending(ctx context.Context, q RecommendationQuery) ([]*RecommendationItem, error)
	Similar(ctx context.Context, productID int64, q RecommendationQuery) ([]*RecommendationItem, error)
	FrequentlyBoughtTogether(ctx context.Context, productID int64, q RecommendationQuery) ([]*RecommendationItem, error)
	ForYou(ctx context.Context, userID int64, q RecommendationQuery) ([]*RecommendationItem, error)

	GetProfile(ctx context.Context, userID int64) (*UserRecommendationProfile, error)
	RecomputeProfile(ctx context.Context, userID int64) (*UserRecommendationProfile, error)

	// RefreshActiveProfiles rebuilds affinity profiles for users active within the
	// last windowDays (capped at maxUsers). It is meant to be driven by a cron
	// job so /for-you serves from warm profiles. It is resilient: one user's
	// failure is logged-and-skipped, never aborting the batch. Returns the count
	// successfully refreshed.
	RefreshActiveProfiles(ctx context.Context, windowDays, maxUsers int) (int, error)

	// OpsStats returns aggregate interaction/profile counts for admin observability.
	OpsStats(ctx context.Context, windowDays int) (*RecommendationOpsStats, error)
}

type service struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return &service{repo: repo}
}

// RecordInteraction logs an implicit-feedback signal, applying the configured
// weight for the interaction type.
func (s *service) RecordInteraction(ctx context.Context, userID int64, req *InteractionReq) error {
	if userID <= 0 || req == nil {
		return apperr.ErrInvalidRequest
	}
	if !req.InteractionType.Valid() || req.ProductID <= 0 {
		return apperr.ErrInvalidRequest
	}
	weight := req.InteractionType.WeightFor()
	if err := s.repo.RecordInteraction(ctx, userID, req, weight); err != nil {
		return fmt.Errorf("service.RecordInteraction: %w", err)
	}
	metrics.IncRecommendationInteraction(string(req.InteractionType))
	return nil
}

func (s *service) Trending(ctx context.Context, q RecommendationQuery) ([]*RecommendationItem, error) {
	q.Defaults()
	items, err := s.repo.Trending(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("service.Trending: %w", err)
	}
	return withReason(items, ReasonTrending), nil
}

func (s *service) Similar(ctx context.Context, productID int64, q RecommendationQuery) ([]*RecommendationItem, error) {
	if productID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	q.Defaults()
	items, err := s.repo.Similar(ctx, productID, q)
	if err != nil {
		return nil, fmt.Errorf("service.Similar: %w", err)
	}
	return withReason(items, ReasonSimilar), nil
}

// FrequentlyBoughtTogether returns order co-occurrence picks, falling back to
// content-similar products when the item is too new to have basket history.
func (s *service) FrequentlyBoughtTogether(ctx context.Context, productID int64, q RecommendationQuery) ([]*RecommendationItem, error) {
	if productID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	q.Defaults()
	items, err := s.repo.FrequentlyBoughtTogether(ctx, productID, q)
	if err != nil {
		return nil, fmt.Errorf("service.FrequentlyBoughtTogether: %w", err)
	}
	if len(items) == 0 {
		return s.Similar(ctx, productID, q)
	}
	return withReason(items, ReasonFBT), nil
}

// ForYou serves personalized recommendations. It lazily builds the profile on a
// cache miss and always backfills to trending so the response is never empty —
// crucial for a storefront homepage.
func (s *service) ForYou(ctx context.Context, userID int64, q RecommendationQuery) ([]*RecommendationItem, error) {
	if userID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	q.Defaults()

	profile, err := s.repo.GetProfile(ctx, userID)
	if err != nil {
		if !errors.Is(err, models.ErrNotFound) {
			return nil, fmt.Errorf("service.ForYou: %w", err)
		}
		// No profile yet — compute one on demand.
		profile, err = s.repo.ComputeProfile(ctx, userID)
		if err != nil {
			return nil, fmt.Errorf("service.ForYou: compute: %w", err)
		}
	}

	// Cold user with no signal → pure trending.
	if !profile.HasSignal() {
		return s.Trending(ctx, q)
	}

	excluded, err := s.repo.PurchasedProductIDs(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("service.ForYou: exclusions: %w", err)
	}

	items, err := s.repo.ForUser(ctx, profile, excluded, q)
	if err != nil {
		return nil, fmt.Errorf("service.ForYou: %w", err)
	}
	items = withReason(items, ReasonForYou)

	// Backfill with trending if personalization is thin.
	if len(items) < q.Limit {
		items = s.backfill(ctx, items, excluded, q)
	}
	return items, nil
}

func (s *service) GetProfile(ctx context.Context, userID int64) (*UserRecommendationProfile, error) {
	if userID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	profile, err := s.repo.GetProfile(ctx, userID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("service.GetProfile: %w", err)
	}
	return profile, nil
}

func (s *service) RecomputeProfile(ctx context.Context, userID int64) (*UserRecommendationProfile, error) {
	if userID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	profile, err := s.repo.ComputeProfile(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("service.RecomputeProfile: %w", err)
	}
	return profile, nil
}

// RefreshActiveProfiles rebuilds profiles for recently-active users so the
// personalization hot path never has to compute on demand.
func (s *service) RefreshActiveProfiles(ctx context.Context, windowDays, maxUsers int) (int, error) {
	ids, err := s.repo.ActiveUserIDs(ctx, windowDays, maxUsers)
	if err != nil {
		return 0, fmt.Errorf("service.RefreshActiveProfiles: %w", err)
	}

	refreshed := 0
	for _, id := range ids {
		// Honour cancellation/deadline so a long batch shuts down cleanly.
		if err := ctx.Err(); err != nil {
			return refreshed, err
		}
		if _, err := s.repo.ComputeProfile(ctx, id); err != nil {
			s.logRefreshSkip(id, err)
			continue
		}
		refreshed++
	}
	return refreshed, nil
}

func (s *service) logRefreshSkip(userID int64, err error) {
	slog.Warn("recommendation profile refresh: skipping user",
		"user_id", userID, "err", err)
}

func (s *service) OpsStats(ctx context.Context, windowDays int) (*RecommendationOpsStats, error) {
	stats, err := s.repo.OpsStats(ctx, windowDays)
	if err != nil {
		return nil, fmt.Errorf("service.OpsStats: %w", err)
	}
	return stats, nil
}

// backfill tops up a personalized list with trending products, skipping anything
// already present or already purchased.
func (s *service) backfill(ctx context.Context, items []*RecommendationItem, excluded []int64, q RecommendationQuery) []*RecommendationItem {
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

func withReason(items []*RecommendationItem, reason string) []*RecommendationItem {
	for _, it := range items {
		it.Reason = reason
	}
	return items
}

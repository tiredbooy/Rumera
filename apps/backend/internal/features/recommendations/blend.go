package recommendations

import (
	"context"
	"log/slog"
	"strings"

	"github.com/tiredbooy/internal/features/taste"
)

// Explicit quiz preferences sit between wishlist and purchase on the
// interaction-weight scale so they move ranking without drowning order history.
const (
	tasteCategoryWeight = 8.0
	tasteTagWeight      = 4.0
)

// TasteProfileReader is the narrow quiz read ForYou needs. Wired from
// taste.Service so recommendations does not own taste_profiles rows.
type TasteProfileReader interface {
	Get(ctx context.Context, userID int64) (*taste.TasteProfile, error)
}

func tasteHasPrefs(p *taste.TasteProfile) bool {
	if p == nil {
		return false
	}
	return len(p.Categories) > 0 || len(p.Flavor) > 0 || len(p.Occasions) > 0
}

func tasteTagNames(p *taste.TasteProfile) []string {
	if p == nil {
		return nil
	}
	names := make([]string, 0, len(p.Flavor)+len(p.Occasions))
	names = append(names, p.Flavor...)
	names = append(names, p.Occasions...)
	return names
}

func (s *service) loadTaste(ctx context.Context, userID int64) *taste.TasteProfile {
	if s.taste == nil {
		return nil
	}
	prefs, err := s.taste.Get(ctx, userID)
	if err != nil {
		slog.Warn("for-you: taste profile unavailable", "user_id", userID, "err", err)
		return nil
	}
	return prefs
}

// applyTaste overlays resolved quiz affinities onto a behavioural profile.
// It mutates profile in place. Missing/empty ids are a no-op.
func applyTaste(profile *UserRecommendationProfile, categoryIDs, tagIDs []int64) {
	if profile == nil {
		return
	}
	profile.TopCategories = mergeAffinity(profile.TopCategories, categoryIDs, tasteCategoryWeight)
	profile.TopTags = mergeAffinity(profile.TopTags, tagIDs, tasteTagWeight)
}

func mergeAffinity(existing []AffinityScore, ids []int64, add float64) []AffinityScore {
	if add == 0 || len(ids) == 0 {
		return existing
	}

	byID := make(map[int64]float64, len(existing)+len(ids))
	order := make([]int64, 0, len(existing)+len(ids))
	for _, a := range existing {
		if a.ID <= 0 {
			continue
		}
		if _, seen := byID[a.ID]; !seen {
			order = append(order, a.ID)
		}
		byID[a.ID] = a.Score
	}

	seenNew := make(map[int64]struct{}, len(ids))
	for _, id := range ids {
		if id <= 0 {
			continue
		}
		if _, dup := seenNew[id]; dup {
			continue
		}
		seenNew[id] = struct{}{}
		if _, known := byID[id]; !known {
			order = append(order, id)
		}
		byID[id] += add
	}

	out := make([]AffinityScore, 0, len(order))
	for _, id := range order {
		out = append(out, AffinityScore{ID: id, Score: byID[id]})
	}
	return out
}

func normalizeNames(names []string) []string {
	if len(names) == 0 {
		return nil
	}
	out := make([]string, 0, len(names))
	seen := make(map[string]struct{}, len(names))
	for _, raw := range names {
		key := strings.ToLower(strings.TrimSpace(raw))
		if key == "" {
			continue
		}
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, key)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

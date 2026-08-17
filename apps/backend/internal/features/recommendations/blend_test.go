package recommendations

import (
	"testing"

	"github.com/tiredbooy/internal/features/taste"
)

func TestTasteHasPrefs(t *testing.T) {
	t.Parallel()
	if tasteHasPrefs(nil) {
		t.Fatal("nil profile must be empty")
	}
	if tasteHasPrefs(&taste.TasteProfile{}) {
		t.Fatal("zero profile must be empty")
	}
	if !tasteHasPrefs(&taste.TasteProfile{Categories: []string{"Wine"}}) {
		t.Fatal("categories must count as prefs")
	}
	if !tasteHasPrefs(&taste.TasteProfile{Flavor: []string{"peat"}}) {
		t.Fatal("flavor must count as prefs")
	}
	if !tasteHasPrefs(&taste.TasteProfile{Occasions: []string{"gift"}}) {
		t.Fatal("occasions must count as prefs")
	}
}

func TestTasteTagNames(t *testing.T) {
	t.Parallel()
	got := tasteTagNames(&taste.TasteProfile{
		Flavor:    []string{"peat", "citrus"},
		Occasions: []string{"gift"},
	})
	if len(got) != 3 || got[0] != "peat" || got[1] != "citrus" || got[2] != "gift" {
		t.Fatalf("tasteTagNames = %v; want peat,citrus,gift", got)
	}
	if tasteTagNames(nil) != nil {
		t.Fatal("nil profile must yield nil tag names")
	}
}

func TestApplyTasteMergesWithoutDrowningHistory(t *testing.T) {
	t.Parallel()
	profile := &UserRecommendationProfile{
		TopCategories: []AffinityScore{{ID: 4, Score: 12}},
		TopTags:       []AffinityScore{{ID: 9, Score: 3}},
	}
	applyTaste(profile, []int64{4, 7}, []int64{9, 11})

	if len(profile.TopCategories) != 2 {
		t.Fatalf("categories = %#v; want 2", profile.TopCategories)
	}
	if profile.TopCategories[0].ID != 4 || profile.TopCategories[0].Score != 20 {
		t.Fatalf("existing wine score = %#v; want id=4 score=20", profile.TopCategories[0])
	}
	if profile.TopCategories[1].ID != 7 || profile.TopCategories[1].Score != tasteCategoryWeight {
		t.Fatalf("new category = %#v; want id=7 score=%.0f", profile.TopCategories[1], tasteCategoryWeight)
	}
	if !profile.HasSignal() {
		t.Fatal("quiz overlay must produce a signal")
	}
}

func TestApplyTasteNoOpOnEmptyIDs(t *testing.T) {
	t.Parallel()
	profile := &UserRecommendationProfile{
		TopCategories: []AffinityScore{{ID: 1, Score: 2}},
	}
	applyTaste(profile, nil, nil)
	if len(profile.TopCategories) != 1 || profile.TopCategories[0].Score != 2 {
		t.Fatalf("empty overlay must not rewrite %#v", profile.TopCategories)
	}
	applyTaste(nil, []int64{1}, nil) // must not panic
}

func TestNormalizeNames(t *testing.T) {
	t.Parallel()
	got := normalizeNames([]string{" Wine ", "wine", "GIN", "", "  "})
	if len(got) != 2 || got[0] != "wine" || got[1] != "gin" {
		t.Fatalf("normalizeNames = %v; want wine,gin", got)
	}
	if normalizeNames(nil) != nil {
		t.Fatal("empty input must stay nil")
	}
}

func TestMergeAffinitySkipsNonPositiveIDs(t *testing.T) {
	t.Parallel()
	got := mergeAffinity(
		[]AffinityScore{{ID: 0, Score: 9}, {ID: 2, Score: 1}},
		[]int64{0, -3, 2, 2},
		tasteTagWeight,
	)
	if len(got) != 1 || got[0].ID != 2 || got[0].Score != 1+tasteTagWeight {
		t.Fatalf("mergeAffinity = %#v", got)
	}
}

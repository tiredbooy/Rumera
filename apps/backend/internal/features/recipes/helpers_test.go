package recipes

import (
	"testing"
	"time"
)

func TestIsPubliclyLiveHonorsPublishedAtSchedule(t *testing.T) {
	now := time.Date(2026, time.August, 16, 12, 0, 0, 0, time.UTC)
	future := now.Add(time.Minute)
	past := now.Add(-time.Minute)
	if isPubliclyLive(RecipeStatusPublished, &future, now) {
		t.Fatal("future published_at must stay hidden")
	}
	if !isPubliclyLive(RecipeStatusPublished, &past, now) {
		t.Fatal("past published_at must be live")
	}
	if !isPubliclyLive(RecipeStatusPublished, &now, now) {
		t.Fatal("published_at equal to now must be live")
	}
	if !isPubliclyLive(RecipeStatusPublished, nil, now) {
		t.Fatal("null published_at must stay live")
	}
	if isPubliclyLive(RecipeStatusDraft, &past, now) {
		t.Fatal("draft must stay hidden")
	}
}

func TestApplyPublicListFilterForcesPublishedLiveOnly(t *testing.T) {
	draft := RecipeStatusDraft
	filter := RecipeFilter{Status: &draft}
	applyPublicListFilter(&filter)
	if filter.Status == nil || *filter.Status != RecipeStatusPublished {
		t.Fatalf("status = %v, want published", filter.Status)
	}
	if !filter.LiveOnly {
		t.Fatal("LiveOnly must be set for public list")
	}
}

func TestPublicLivePublishedAtSQL(t *testing.T) {
	got := publicLivePublishedAtSQL("r.published_at")
	want := "(r.published_at IS NULL OR r.published_at <= NOW())"
	if got != want {
		t.Fatalf("sql = %q, want %q", got, want)
	}
}

package recipes

import (
	"strings"
	"time"
)

// publicLivePublishedAtSQL is the storefront schedule window. A published
// recipe with a future published_at stays hidden until that stamp. NULL means
// already live (legacy rows that never received a schedule).
func publicLivePublishedAtSQL(column string) string {
	return "(" + column + " IS NULL OR " + column + " <= NOW())"
}

func isPubliclyLive(status RecipeStatus, publishedAt *time.Time, now time.Time) bool {
	if status != RecipeStatusPublished {
		return false
	}
	return publishedAt == nil || !publishedAt.After(now)
}

func applyPublicListFilter(f *RecipeFilter) {
	published := RecipeStatusPublished
	f.Status = &published
	f.LiveOnly = true
}

func nullableArg[T any](value *T) any {
	if value == nil {
		return nil
	}
	return *value
}

func escapeLikePattern(value string) string {
	replacer := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)
	return replacer.Replace(value)
}

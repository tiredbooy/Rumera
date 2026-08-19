package recipes

import (
	"regexp"
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

// ── Method steps ─────────────────────────────────────────────────────────────
//
// CE-5. The method is stored as the canonical ordered list `<ol><li>…</li></ol>`
// the recipe step editor writes. Reading only that list keeps an unrelated
// bullet list (tips, warnings) out of `recipeInstructions`, and gives the
// JSON-LD real HowToStep entries instead of a wall of HTML.

var (
	orderedListOpenRe = regexp.MustCompile(`(?is)<ol\b[^>]*>`)
	listTagRe         = regexp.MustCompile(`(?is)<(/?)ol\b[^>]*>`)
	itemTagRe         = regexp.MustCompile(`(?is)<(/?)li\b[^>]*>`)
	paragraphRe       = regexp.MustCompile(`(?is)<p\b[^>]*>(.*?)</p>`)
	tagRe             = regexp.MustCompile(`(?s)<[^>]+>`)
	whitespaceRe      = regexp.MustCompile(`\s+`)
	entityReplacer    = strings.NewReplacer(
		"&nbsp;", " ", "&amp;", "&", "&lt;", "<", "&gt;", ">", "&quot;", `"`, "&#39;", "'",
	)
)

// plainContentText strips markup and collapses whitespace.
func plainContentText(value string) string {
	return strings.TrimSpace(whitespaceRe.ReplaceAllString(
		entityReplacer.Replace(tagRe.ReplaceAllString(value, " ")), " ",
	))
}

// topLevelItems returns the inner HTML of the direct <li> children of inner.
func topLevelItems(inner string) []string {
	var (
		items []string
		depth int
		start = -1
	)
	for _, match := range itemTagRe.FindAllStringSubmatchIndex(inner, -1) {
		closing := match[3] > match[2]
		if closing {
			depth--
			if depth == 0 && start >= 0 {
				items = append(items, inner[start:match[0]])
				start = -1
			}
			continue
		}
		if depth == 0 {
			start = match[1]
		}
		depth++
	}
	return items
}

// orderedListItems returns the inner HTML of the first <ol>'s direct items.
// Regex cannot balance tags, so the closing tag is found by counting depth.
func orderedListItems(content string) []string {
	open := orderedListOpenRe.FindStringIndex(content)
	if open == nil {
		return nil
	}
	depth := 0
	end := -1
	for _, match := range listTagRe.FindAllStringSubmatchIndex(content[open[0]:], -1) {
		if match[3] > match[2] {
			if depth == 1 {
				end = open[0] + match[0]
				break
			}
			depth--
			continue
		}
		depth++
	}
	if end < 0 {
		return nil
	}
	return topLevelItems(content[open[1]:end])
}

// methodSteps renders a recipe body as ordered, plain-text method steps.
func methodSteps(content string) []string {
	if strings.TrimSpace(content) == "" {
		return nil
	}
	sources := orderedListItems(content)
	if len(sources) == 0 {
		sources = topLevelItems(content)
	}
	if len(sources) == 0 {
		for _, match := range paragraphRe.FindAllStringSubmatch(content, -1) {
			sources = append(sources, match[1])
		}
	}

	steps := make([]string, 0, len(sources))
	for _, source := range sources {
		if text := plainContentText(source); text != "" {
			steps = append(steps, text)
		}
	}
	if len(steps) > 0 {
		return steps
	}
	if text := plainContentText(content); text != "" {
		return []string{text}
	}
	return nil
}

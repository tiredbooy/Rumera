// Package searchtext provides Persian-aware text normalization for ILIKE search.
//
// Go Normalize must stay lockstep with the SQL function rumera_search_normalize
// (migration PH-030a). Both sides of every product free-text match use the same
// rules so Arabic/Persian confusables and ZWNJ do not create false misses.
package searchtext

import (
	"strings"
	"unicode"
)

// Normalize prepares free-text for Persian-aware substring search.
//
// Rules (must match rumera_search_normalize in Postgres):
//  1. Arabic ك (U+0643) → Persian ک (U+06A9)
//  2. Arabic ي (U+064A) and ى (U+0649) → Persian ی (U+06CC)
//  3. Strip ZWNJ (U+200C) and ZWJ (U+200D)
//  4. Unicode lower-case (ASCII brand names)
//  5. Strip all Unicode whitespace so "می خواهم" matches "می‌خواهم"
//
// Empty / whitespace-only / ZWNJ-only inputs become "".
func Normalize(s string) string {
	if s == "" {
		return ""
	}

	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		switch r {
		case '\u0643': // Arabic kaf
			r = '\u06A9' // Persian kaf
		case '\u064A', '\u0649': // Arabic yeh, alef maksura
			r = '\u06CC' // Persian yeh
		case '\u200C', '\u200D': // ZWNJ, ZWJ
			continue
		}
		if unicode.IsSpace(r) {
			continue
		}
		b.WriteRune(unicode.ToLower(r))
	}
	return b.String()
}

// EscapeLike escapes \, %, and _ for use with ILIKE … ESCAPE E'\\'.
func EscapeLike(value string) string {
	return strings.NewReplacer(
		`\`, `\\`,
		`%`, `\%`,
		`_`, `\_`,
	).Replace(value)
}

// LikeContains builds an escaped "%pattern%" for ILIKE after Normalize.
// Returns "" when the normalized query is empty (caller should skip the clause).
func LikeContains(rawQuery string) string {
	norm := Normalize(rawQuery)
	if norm == "" {
		return ""
	}
	return "%" + EscapeLike(norm) + "%"
}

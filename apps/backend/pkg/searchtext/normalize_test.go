package searchtext

import "testing"

func TestNormalizePersianConfusables(t *testing.T) {
	// Arabic kaf/yeh → Persian forms
	if got, want := Normalize("كتابي"), "کتابی"; got != want {
		t.Fatalf("Arabic confusables: got %q want %q", got, want)
	}
	// Alef maksura → yeh
	if got, want := Normalize("مصطفى"), "مصطفی"; got != want {
		t.Fatalf("alef maksura: got %q want %q", got, want)
	}
}

func TestNormalizeZWNJAndWhitespace(t *testing.T) {
	// ZWNJ stripped; spaces stripped so half-space vs space match
	withZWNJ := "می\u200cخواهم"
	withSpace := "می خواهم"
	glued := "میخواهم"
	if got := Normalize(withZWNJ); got != glued {
		t.Fatalf("ZWNJ form: got %q want %q", got, glued)
	}
	if got := Normalize(withSpace); got != glued {
		t.Fatalf("space form: got %q want %q", got, glued)
	}
	if Normalize("\u200c\u200d  \t") != "" {
		t.Fatal("ZWNJ/space-only should collapse to empty")
	}
}

func TestNormalizeASCIICase(t *testing.T) {
	if got, want := Normalize("Jack Daniel's"), "jackdaniel's"; got != want {
		t.Fatalf("ASCII: got %q want %q", got, want)
	}
}

func TestLikeContainsEscapesWildcards(t *testing.T) {
	if got, want := LikeContains(`100%_`), `%100\%\_%`; got != want {
		t.Fatalf("LikeContains = %q; want %q", got, want)
	}
	if LikeContains("  \u200c ") != "" {
		t.Fatal("empty query should yield empty pattern")
	}
	// Backslash
	if got, want := LikeContains(`a\b`), `%a\\b%`; got != want {
		t.Fatalf("backslash escape = %q; want %q", got, want)
	}
}

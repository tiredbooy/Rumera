package product

import "testing"

func TestNormalizePublicSlugKeepsUnicodeAndRemovesPathSeparators(t *testing.T) {
	for input, want := range map[string]string{
		"  Single / Malt? ": "single-malt",
		"ویسکی / ویژه":      "ویسکی-ویژه",
		"---":               "",
	} {
		if got := normalizePublicSlug(input); got != want {
			t.Errorf("normalizePublicSlug(%q) = %q; want %q", input, got, want)
		}
	}
}

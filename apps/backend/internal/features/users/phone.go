package users

import "strings"

// NormalizeIranPhone canonicalises common Iranian mobile inputs to "09XXXXXXXXX".
// Accepts ASCII/Persian/Arabic digits and +98 / 0098 / 98 / 9… prefixes.
func NormalizeIranPhone(raw string) (string, bool) {
	var b strings.Builder
	for _, r := range raw {
		switch {
		case r >= '0' && r <= '9':
			b.WriteRune(r)
		case r >= '۰' && r <= '۹': // Persian digits U+06F0..U+06F9
			b.WriteRune('0' + (r - '۰'))
		case r >= '٠' && r <= '٩': // Arabic-Indic digits U+0660..U+0669
			b.WriteRune('0' + (r - '٠'))
		}
	}
	d := b.String()

	switch {
	case strings.HasPrefix(d, "0098"):
		d = "0" + d[4:]
	case strings.HasPrefix(d, "98") && len(d) == 12:
		d = "0" + d[2:]
	case strings.HasPrefix(d, "9") && len(d) == 10:
		d = "0" + d
	}

	if len(d) == 11 && strings.HasPrefix(d, "09") {
		return d, true
	}
	return "", false
}

func sameCanonicalPhone(current *string, candidate string) bool {
	if current == nil {
		return false
	}
	existing, ok := NormalizeIranPhone(*current)
	if !ok {
		return *current == candidate
	}
	return existing == candidate
}

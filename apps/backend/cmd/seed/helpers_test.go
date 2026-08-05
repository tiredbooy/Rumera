package main

import (
	"math"
	"testing"
)

func TestParsePrice(t *testing.T) {
	t.Parallel()

	got, err := parsePrice("12500000")
	if err != nil {
		t.Fatalf("parsePrice: %v", err)
	}
	if got != 12_500_000 {
		t.Fatalf("got %v; want 12500000", got)
	}

	if _, err := parsePrice("not-a-number"); err == nil {
		t.Fatal("expected error for invalid price string")
	}

	// Decimal fractions must round-trip through shopspring without NaN.
	frac, err := parsePrice("39.9")
	if err != nil {
		t.Fatalf("fractional parsePrice: %v", err)
	}
	if math.Abs(frac-39.9) > 1e-9 {
		t.Fatalf("fractional price = %v", frac)
	}
}

func TestCountsTrackCreatedAndSkipped(t *testing.T) {
	t.Parallel()

	c := newCounts()
	c.created1("brand")
	c.created1("brand")
	c.skipped1("brand")
	c.created1("product")

	if c.created["brand"] != 2 || c.skipped["brand"] != 1 || c.created["product"] != 1 {
		t.Fatalf("counts = created %#v skipped %#v", c.created, c.skipped)
	}
}

func TestResolveKeysPreservesOrderAndOmitsUnknown(t *testing.T) {
	t.Parallel()

	lookup := map[string]int64{"premium": 7, "gift": 9}
	got := resolveKeys(lookup, "gift", "missing", "premium", "gift")
	want := []int64{9, 7, 9}
	if len(got) != len(want) {
		t.Fatalf("got %#v; want %#v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("got %#v; want %#v", got, want)
		}
	}
	if resolveKeys(lookup) != nil {
		t.Fatal("empty keys should return nil")
	}
}

func TestParentIDForRootsAndChildren(t *testing.T) {
	t.Parallel()

	seeded := map[string]int64{"wine": 3}
	root, err := parentIDFor(seeded, "wine", "")
	if err != nil || root != nil {
		t.Fatalf("root parent = %v, %v; want nil, nil", root, err)
	}

	child, err := parentIDFor(seeded, "wine-red", "wine")
	if err != nil || child == nil || *child != 3 {
		t.Fatalf("child parent = %v, %v; want 3", child, err)
	}

	if _, err := parentIDFor(seeded, "orphan", "missing"); err == nil {
		t.Fatal("expected error for unknown parent")
	}
}

func TestOptionalVariantID(t *testing.T) {
	t.Parallel()

	variants := map[string]int64{"glen-highland-12yo": 42}
	if got := optionalVariantID(variants, "glen-highland-12yo"); got == nil || *got != 42 {
		t.Fatalf("got %v; want 42", got)
	}
	if optionalVariantID(variants, "missing") != nil {
		t.Fatal("missing slug should be nil")
	}
	if optionalVariantID(variants, "") != nil {
		t.Fatal("empty slug should be nil")
	}
}

func TestPointerHelpers(t *testing.T) {
	t.Parallel()

	if *sp("x") != "x" || *ip(3) != 3 || *i64p(9) != 9 || *f64p(1.5) != 1.5 || !*bp(true) {
		t.Fatal("pointer helpers returned unexpected values")
	}
	d := dec("10.5")
	if d == nil || d.String() != "10.5" {
		t.Fatalf("dec helper = %v", d)
	}
}

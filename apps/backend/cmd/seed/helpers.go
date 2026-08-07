package main

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/shopspring/decimal"
)

// counts tracks what the run created vs skipped so the final log line is a
// useful, glanceable summary.
type counts struct {
	created map[string]int
	skipped map[string]int
}

func newCounts() *counts {
	return &counts{created: map[string]int{}, skipped: map[string]int{}}
}

func (c *counts) created1(kind string) { c.created[kind]++ }
func (c *counts) skipped1(kind string) { c.skipped[kind]++ }

// ── helpers ─────────────────────────────────────────────────────────────────

func sp(s string) *string     { return &s }
func ip(i int) *int           { return &i }
func i16p(i int16) *int16     { return &i }
func i64p(i int64) *int64     { return &i }
func f64p(f float64) *float64 { return &f }
func bp(b bool) *bool         { return &b }
func dec(v string) *decimal.Decimal {
	d, _ := decimal.NewFromString(v)
	return &d
}

// scalarID runs a single-column `SELECT id ... LIMIT 1` and reports whether a
// row was found. Used for every idempotency check so re-runs skip cleanly.
func (s *seeder) scalarID(ctx context.Context, query string, arg any) (int64, bool, error) {
	var id int64
	err := s.pool.QueryRow(ctx, query, arg).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, false, nil
	}
	if err != nil {
		return 0, false, err
	}
	return id, true, nil
}

// ── price parsing ───────────────────────────────────────────────────────────

// parsePrice turns a Toman numeric string into the float64 the variant request
// expects, keeping all the literal prices above readable and grep-able.
func parsePrice(s string) (float64, error) {
	d, err := decimal.NewFromString(s)
	if err != nil {
		return 0, fmt.Errorf("parse price %q: %w", s, err)
	}
	f, _ := d.Float64()
	return f, nil
}

// resolveKeys maps stable seed keys onto database ids, preserving order and
// omitting unknown keys so partial fixtures still seed cleanly.
func resolveKeys(lookup map[string]int64, keys ...string) []int64 {
	if len(keys) == 0 {
		return nil
	}
	out := make([]int64, 0, len(keys))
	for _, key := range keys {
		if id, ok := lookup[key]; ok {
			out = append(out, id)
		}
	}
	return out
}

// parentIDFor looks up a category parent key after roots have been seeded.
// Empty parentKey means a root category (no parent).
func parentIDFor(seeded map[string]int64, childKey, parentKey string) (*int64, error) {
	if parentKey == "" {
		return nil, nil
	}
	pid, ok := seeded[parentKey]
	if !ok {
		return nil, fmt.Errorf("category %q references unknown parent %q", childKey, parentKey)
	}
	return i64p(pid), nil
}

// optionalVariantID returns a pointer to a seeded variant id, or nil when that
// product was skipped so recipe links stay optional.
func optionalVariantID(variants map[string]int64, productSlug string) *int64 {
	if productSlug == "" {
		return nil
	}
	id, ok := variants[productSlug]
	if !ok || id == 0 {
		return nil
	}
	return i64p(id)
}

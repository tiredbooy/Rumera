package main

import (
	"context"
	"fmt"

	"github.com/tiredbooy/internal/features/catalog/tag"
	"go.uber.org/zap"
)

// ── tags ────────────────────────────────────────────────────────────────────

func (s *seeder) seedTags(ctx context.Context) (map[string]int64, error) {
	items := map[string]string{
		"premium":   "ممتاز",
		"organic":   "ارگانیک",
		"aged":      "کهنه",
		"cocktail":  "کوکتل",
		"gift":      "هدیه",
		"bestselle": "پرفروش",
	}
	out := make(map[string]int64, len(items))
	for key, title := range items {
		id, found, err := s.scalarID(ctx, `SELECT id FROM tags WHERE title = $1`, title)
		if err != nil {
			return nil, err
		}
		if found {
			out[key] = id
			s.c.skipped1("tag")
			continue
		}
		t, err := s.tag.Create(ctx, tag.CreateTagReq{Title: title})
		if err != nil {
			return nil, fmt.Errorf("create tag %q: %w", title, err)
		}
		out[key] = t.ID
		s.c.created1("tag")
		s.log.Info("created tag", zap.String("title", t.Title), zap.Int64("id", t.ID))
	}
	return out, nil
}

package main

import (
	"context"
	"fmt"

	"github.com/tiredbooy/internal/models"
	"go.uber.org/zap"
)

// ── categories (with a parent/child tree) ────────────────────────────────────

func (s *seeder) seedCategories(ctx context.Context) (map[string]int64, error) {
	// A two-level tree: "شراب" is a parent of "شراب قرمز" / "شراب سفید".
	type cat struct {
		key       string
		name      string
		slug      string
		desc      string
		parentKey string // "" = root
		image     string
		featured  bool
		cardSize  string
		order     int16
	}
	items := []cat{
		{"wine", "شراب", "wine", "گزیده‌ای از بهترین شراب‌های جهان، از بوردو تا توسکانی.", "", "/images/wine.jpg", true, "large", 0},
		{"wine-red", "شراب قرمز", "red-wine", "شراب‌های قرمز پرمایه با تانن‌های مخملی.", "wine", "/images/wine.jpg", false, "small", 3},
		{"wine-white", "شراب سفید", "white-wine", "شراب‌های سفید خنک و معطر برای هر مناسبت.", "wine", "/images/champaign.jpg", false, "small", 4},
		{"whisky", "ویسکی", "whisky", "ویسکی‌های تک‌مالت و ترکیبی کهنه‌شده.", "", "/images/whiskey.jpg", true, "small", 1},
		{"tequila", "تکیلا", "tequila", "تکیلای ناب از قلب مکزیک.", "", "/images/tequila.jpg", true, "small", 2},
	}

	out := make(map[string]int64, len(items))
	// Insert roots first so children can reference their parent_id.
	for _, pass := range []bool{true, false} { // pass 1 = roots, pass 2 = children
		for _, it := range items {
			isRoot := it.parentKey == ""
			if isRoot != pass {
				continue
			}
			id, found, err := s.scalarID(ctx, `SELECT id FROM categories WHERE title = $1`, it.name)
			if err != nil {
				return nil, err
			}
			if found {
				parentID, err := parentIDFor(out, it.key, it.parentKey)
				if err != nil {
					return nil, err
				}
				if _, err := s.pool.Exec(ctx, `
					UPDATE categories SET
						description = $2, parent_id = $3, slug = $4, image_url = $5,
						is_featured = $6, card_size = $7, display_order = $8
					WHERE id = $1`,
					id, it.desc, parentID, it.slug, it.image, it.featured, it.cardSize, it.order,
				); err != nil {
					return nil, fmt.Errorf("refresh category %q: %w", it.name, err)
				}
				out[it.key] = id
				s.c.skipped1("category")
				s.log.Info("skip category (exists)", zap.String("name", it.name))
				continue
			}
			req := models.CreateCategoryReq{
				Title:        it.name,
				Slug:         sp(it.slug),
				Description:  sp(it.desc),
				ImageURL:     sp(it.image),
				IsFeatured:   bp(it.featured),
				CardSize:     sp(it.cardSize),
				DisplayOrder: i16p(it.order),
			}
			if !isRoot {
				parentID, err := parentIDFor(out, it.key, it.parentKey)
				if err != nil {
					return nil, err
				}
				req.ParentID = parentID
			}
			c, err := s.category.Create(ctx, req)
			if err != nil {
				return nil, fmt.Errorf("create category %q: %w", it.name, err)
			}
			out[it.key] = c.ID
			s.c.created1("category")
			s.log.Info("created category", zap.String("name", c.Title), zap.Int64("id", c.ID))
		}
	}
	return out, nil
}

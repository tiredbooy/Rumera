package main

import (
	"context"
	"fmt"

	"github.com/tiredbooy/internal/models"
	"go.uber.org/zap"
)

// ── brands ──────────────────────────────────────────────────────────────────

func (s *seeder) seedBrands(ctx context.Context) (map[string]int64, error) {
	type brand struct {
		key string
		req models.CreateBrandReq
	}
	items := []brand{
		{"chateau-margaux", models.CreateBrandReq{
			Title:       "شاتو مارگو",
			Country:     sp("فرانسه"),
			FoundedYear: ip(1815),
			ImageURL:    sp("https://images.unsplash.com/photo-1474722883778-792e7990302f?auto=format&fit=crop&w=600&q=80"),
			Description: sp("یکی از کهن‌ترین تاکستان‌های بوردو، نماد ظرافت و اصالت در شراب‌سازی فرانسوی."),
		}},
		{"glen-highland", models.CreateBrandReq{
			Title:       "گلن هایلند",
			Country:     sp("اسکاتلند"),
			FoundedYear: ip(1824),
			ImageURL:    sp("https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=600&q=80"),
			Description: sp("تقطیرکننده‌ای افسانه‌ای از ارتفاعات اسکاتلند با ویسکی‌های مالت تک‌خاستگاه."),
		}},
		{"casa-del-sol", models.CreateBrandReq{
			Title:       "کاسا دل سول",
			Country:     sp("مکزیک"),
			FoundedYear: ip(1942),
			ImageURL:    sp("https://images.unsplash.com/photo-1516535794938-6063878f08cc?auto=format&fit=crop&w=600&q=80"),
			Description: sp("تکیلای دست‌ساز از آگاو آبی خالص، رسیده در بشکه‌های بلوط آمریکایی."),
		}},
	}

	out := make(map[string]int64, len(items))
	for _, it := range items {
		id, found, err := s.scalarID(ctx, `SELECT id FROM brands WHERE title = $1`, it.req.Title)
		if err != nil {
			return nil, err
		}
		if found {
			out[it.key] = id
			s.c.skipped1("brand")
			s.log.Info("skip brand (exists)", zap.String("title", it.req.Title))
			continue
		}
		b, err := s.brand.Create(ctx, it.req)
		if err != nil {
			return nil, fmt.Errorf("create brand %q: %w", it.req.Title, err)
		}
		out[it.key] = b.ID
		s.c.created1("brand")
		s.log.Info("created brand", zap.String("title", b.Title), zap.Int64("id", b.ID))
	}
	return out, nil
}

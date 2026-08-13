package main

import (
	"context"
	"fmt"

	"github.com/tiredbooy/internal/features/hero"
	"go.uber.org/zap"
)

// ── hero slides ─────────────────────────────────────────────────────────────

func (s *seeder) seedHeroSlides(ctx context.Context) error {
	slides := []*hero.HeroSlideReq{
		{
			Eyebrow:           sp("کلکسیون ویژه"),
			Title:             "سلر رومرا، جایی برای انتخاب‌های بی‌نظیر",
			Subtitle:          sp("گزیده‌ای از نادرترین شراب‌ها و نوشیدنی‌های جهان، مستقیماً به دست شما."),
			Badge:             sp("جدید"),
			ImageURL:          sp("https://images.unsplash.com/photo-1547595628-c61a29f496f0?auto=format&fit=crop&w=1920&q=80"),
			MobileImageURL:    sp("https://images.unsplash.com/photo-1547595628-c61a29f496f0?auto=format&fit=crop&w=800&q=80"),
			ImageAlt:          sp("قفسه‌های سلر شراب رومرا"),
			CTALabel:          sp("کاوش در کلکسیون"),
			CTAHref:           sp("/products"),
			SecondaryCTALabel: sp("داستان ما"),
			SecondaryCTAHref:  sp("/about"),
			Theme:             sp("dark"),
			SortOrder:         ip(0),
			IsActive:          bp(true),
		},
		{
			Eyebrow:        sp("بوردو ۲۰۱۵"),
			Title:          "شاتو مارگو، شکوه یک برداشت تاریخی",
			Subtitle:       sp("برداشت استثنایی ۲۰۱۵ اکنون در دسترس است؛ تعداد محدود."),
			Badge:          sp("ممتاز"),
			ImageURL:       sp("https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=1920&q=80"),
			MobileImageURL: sp("https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=800&q=80"),
			ImageAlt:       sp("بطری شراب شاتو مارگو"),
			CTALabel:       sp("مشاهده محصول"),
			CTAHref:        sp("/products/chateau-margaux-grand-cru-2015"),
			Theme:          sp("dark"),
			SortOrder:      ip(1),
			IsActive:       bp(true),
		},
		{
			Eyebrow:        sp("ارتفاعات اسکاتلند"),
			Title:          "ویسکی‌های کهنه گلن هایلند",
			Subtitle:       sp("تک‌مالت‌های ۱۲ و ۱۸ ساله، رسیده در بشکه‌های شری."),
			Badge:          sp("هدیه ایده‌آل"),
			ImageURL:       sp("https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=1920&q=80"),
			MobileImageURL: sp("https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=800&q=80"),
			ImageAlt:       sp("لیوان ویسکی تک‌مالت"),
			CTALabel:       sp("کشف ویسکی‌ها"),
			CTAHref:        sp("/products?category=whisky"),
			Theme:          sp("light"),
			SortOrder:      ip(2),
			IsActive:       bp(true),
		},
	}

	for _, sl := range slides {
		if _, found, err := s.scalarID(ctx, `SELECT id FROM hero_slides WHERE title = $1`, sl.Title); err != nil {
			return err
		} else if found {
			s.c.skipped1("hero_slide")
			s.log.Info("skip hero slide (exists)", zap.String("title", sl.Title))
			continue
		}
		if _, err := s.hero.Create(ctx, sl); err != nil {
			return fmt.Errorf("create hero slide %q: %w", sl.Title, err)
		}
		s.c.created1("hero_slide")
		s.log.Info("created hero slide", zap.String("title", sl.Title))
	}
	return nil
}

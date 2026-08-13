package main

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/tiredbooy/internal/features/blog"
	"go.uber.org/zap"
)

// ── blogs / journal ─────────────────────────────────────────────────────────

func (s *seeder) seedBlogs(ctx context.Context) error {
	// Blogs require a real author (FK → users.id). Reuse the bootstrap admin; if
	// it's missing fall back to the first user. If there is no user at all we skip
	// journal seeding rather than fail the whole run.
	author, err := s.resolveAuthorID(ctx)
	if err != nil {
		return err
	}
	if author == 0 {
		s.log.Warn("no user found — skipping journal/blog seed (run the API once to seed the admin)")
		return nil
	}

	// blog_categories first so posts can be assigned to one.
	catID, err := s.ensureBlogCategory(ctx, "یادداشت‌های سلر", "cellar-notes",
		"یادداشت‌ها و راهنماهای دنیای شراب و نوشیدنی‌های ناب.")
	if err != nil {
		return err
	}

	type post struct {
		title, slug, excerpt, body, cover, metaTitle, metaDesc string
		minutes                                                int
	}
	posts := []post{
		{
			title:     "راهنمای نگهداری شراب در سلر خانگی",
			slug:      "home-cellar-guide",
			excerpt:   "دما، رطوبت و نور؛ سه راز ماندگاری شراب شما.",
			body:      "<p>شراب موجودی زنده است. آن را در دمای ثابت ۱۲ تا ۱۴ درجه، دور از نور و لرزش و به‌صورت خوابیده نگه دارید تا چوب‌پنبه خشک نشود.</p><p>رطوبت ۷۰ درصد ایده‌آل است.</p>",
			cover:     "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?auto=format&fit=crop&w=1200&q=80",
			metaTitle: "راهنمای نگهداری شراب در سلر خانگی | رومرا",
			metaDesc:  "اصول حرفه‌ای نگهداری شراب: دما، رطوبت و نور.",
			minutes:   6,
		},
		{
			title:     "هنر چشیدن ویسکی تک‌مالت",
			slug:      "art-of-tasting-whisky",
			excerpt:   "از رنگ تا پایانه؛ چگونه یک ویسکی را حرفه‌ای بچشیم.",
			body:      "<p>ویسکی را در گیلاس توليپ بریزید، رنگش را بسنجید، عطرش را با دهان نیمه‌باز ببویید و جرعه‌ای کوچک روی زبان بچرخانید. کمی آب، درها را باز می‌کند.</p>",
			cover:     "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=1200&q=80",
			metaTitle: "هنر چشیدن ویسکی تک‌مالت | رومرا",
			metaDesc:  "راهنمای گام‌به‌گام چشیدن حرفه‌ای ویسکی.",
			minutes:   5,
		},
		{
			title:     "جفت‌سازی شراب و غذای ایرانی",
			slug:      "wine-persian-food-pairing",
			excerpt:   "کدام شراب در کنار خورش‌های ایرانی می‌درخشد؟",
			body:      "<p>شراب‌های سفید معطر همراه با غذاهای زعفرانی و سفید، و شراب‌های قرمز پرمایه در کنار کباب و خورش‌های گوشتی بهترین همراهی را می‌سازند.</p>",
			cover:     "https://images.unsplash.com/photo-1474722883778-792e7990302f?auto=format&fit=crop&w=1200&q=80",
			metaTitle: "جفت‌سازی شراب و غذای ایرانی | رومرا",
			metaDesc:  "راهنمای همراهی شراب با غذاهای ایرانی.",
			minutes:   7,
		},
		{
			title:     "تکیلا فراتر از مارگاریتا",
			slug:      "tequila-beyond-margarita",
			excerpt:   "چرا تکیلای ناب را باید خالص و آرام نوشید.",
			body:      "<p>تکیلای آنیخوی خوب را مانند یک ویسکی خوب، خالص و در دمای اتاق بنوشید تا لایه‌های کارامل و آگاو پخته را کشف کنید.</p>",
			cover:     "https://images.unsplash.com/photo-1516535794938-6063878f08cc?auto=format&fit=crop&w=1200&q=80",
			metaTitle: "تکیلا فراتر از مارگاریتا | رومرا",
			metaDesc:  "راهنمای نوشیدن تکیلای ناب به‌صورت خالص.",
			minutes:   4,
		},
	}

	now := time.Now().UTC()
	for i, p := range posts {
		if _, found, err := s.scalarID(ctx, `SELECT id FROM blogs WHERE slug = $1`, p.slug); err != nil {
			return err
		} else if found {
			s.c.skipped1("blog")
			s.log.Info("skip blog (exists)", zap.String("slug", p.slug))
			continue
		}

		// blogs now carry a dedicated cover (image_url) — surface it on cards and
		// use it as the detail hero. Must be status=published with published_at so
		// the public, published-only /blogs list returns the post.
		req := &blog.BlogReq{
			AuthorID:        author,
			Title:           p.title,
			Slug:            p.slug,
			Content:         p.body,
			Excerpt:         sp(p.excerpt),
			ImageURL:        sp(p.cover),
			TimeToRead:      p.minutes,
			Status:          blog.BlogStatusPublished,
			IsFeatured:      i == 0, // first post is the featured lead story
			MetaTitle:       sp(p.metaTitle),
			MetaDescription: sp(p.metaDesc),
			PublishedAt:     &now,
			CategoryIDs:     []int64{catID},
		}
		if _, err := s.blog.Create(ctx, req); err != nil {
			return fmt.Errorf("create blog %q: %w", p.slug, err)
		}
		s.c.created1("blog")
		s.log.Info("created blog", zap.String("slug", p.slug))
	}

	return nil
}

func (s *seeder) resolveAuthorID(ctx context.Context) (int64, error) {
	// Prefer any admin; otherwise the lowest user id. Raw SQL keeps this trivial.
	var id int64
	err := s.pool.QueryRow(ctx,
		`SELECT id FROM users ORDER BY (role = 'admin') DESC, id ASC LIMIT 1`).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("resolve blog author: %w", err)
	}
	return id, nil
}

func (s *seeder) ensureBlogCategory(ctx context.Context, name, slug, desc string) (int64, error) {
	if id, found, err := s.scalarID(ctx, `SELECT id FROM blog_categories WHERE slug = $1`, slug); err != nil {
		return 0, err
	} else if found {
		s.c.skipped1("blog_category")
		return id, nil
	}
	const q = `INSERT INTO blog_categories (name, description, slug)
		VALUES ($1, $2, $3) RETURNING id`
	var id int64
	if err := s.pool.QueryRow(ctx, q, name, desc, slug).Scan(&id); err != nil {
		return 0, fmt.Errorf("create blog category: %w", err)
	}
	s.c.created1("blog_category")
	s.log.Info("created blog category", zap.String("slug", slug), zap.Int64("id", id))
	return id, nil
}

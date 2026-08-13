package main

import (
	"context"
	"fmt"
	"time"

	recipesfeat "github.com/tiredbooy/internal/features/recipes"
	"go.uber.org/zap"
)

// ── recipes ─────────────────────────────────────────────────────────────────

func (s *seeder) seedRecipes(ctx context.Context, variants, tags map[string]int64) error {
	now := time.Now().UTC()

	recipes := []struct {
		req      *recipesfeat.RecipeReq
		products []struct {
			slug      string
			role      string
			primary   bool
			qty, unit string
		}
		ingredients []struct {
			slug, name, qty, unit, notes string
			optional                     bool
		}
	}{
		{
			req: &recipesfeat.RecipeReq{
				Title:             "مارگاریتای کلاسیک",
				Slug:              "classic-margarita",
				Excerpt:           sp("کوکتل افسانه‌ای مکزیکی با تکیلا، لیموترش و کوآنترو."),
				Description:       sp("متعادل، ترش و سرحال‌کننده — مارگاریتا هرگز از مد نمی‌افتد."),
				Content:           "<p>لبه لیوان را با نمک بپوشانید. تکیلا، آب لیموترش تازه و کوآنترو را با یخ شیک کنید و در لیوان سرو کنید.</p>",
				Difficulty:        recipesfeat.RecipeDifficultyEasy,
				PrepTimeMinutes:   5,
				CookTimeMinutes:   0,
				Servings:          1,
				Calories:          ip(210),
				CocktailType:      sp("کلاسیک"),
				GlassType:         sp("لیوان مارگاریتا"),
				ServingSuggestion: sp("با لبه نمکی و یک قاچ لیموترش سرو شود."),
				ImageURL:          sp("https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=1200&q=80"),
				Status:            recipesfeat.RecipeStatusPublished,
				IsFeatured:        true,
				PublishedAt:       &now,
				MetaTitle:         sp("طرز تهیه مارگاریتای کلاسیک | رومرا"),
				MetaDescription:   sp("دستور کامل مارگاریتای کلاسیک با تکیلای بلانکو."),
				MetaKeywords:      []string{"مارگاریتا", "کوکتل", "تکیلا"},
			},
			products: []struct {
				slug, role string
				primary    bool
				qty, unit  string
			}{
				{"casa-del-sol-blanco", "base", true, "50", "میلی‌لیتر"},
			},
			ingredients: []struct {
				slug, name, qty, unit, notes string
				optional                     bool
			}{
				{"casa-del-sol-blanco", "تکیلای بلانکو", "50", "میلی‌لیتر", "", false},
				{"", "آب لیموترش تازه", "25", "میلی‌لیتر", "", false},
				{"", "کوآنترو", "20", "میلی‌لیتر", "", false},
				{"", "نمک درشت", "1", "قاشق", "برای لبه لیوان", true},
			},
		},
		{
			req: &recipesfeat.RecipeReq{
				Title:             "اولد فشن",
				Slug:              "old-fashioned",
				Excerpt:           sp("سلطان کوکتل‌های ویسکی؛ ساده، قدرتمند و بی‌زمان."),
				Description:       sp("ترکیب ویسکی، شکر و انگوستورا روی یخ درشت."),
				Content:           "<p>یک حبه قند را با چند قطره انگوستورا خیس کنید، ویسکی بیفزایید و روی یخ درشت هم بزنید. با پوست پرتقال تزئین کنید.</p>",
				Difficulty:        recipesfeat.RecipeDifficultyMedium,
				PrepTimeMinutes:   4,
				CookTimeMinutes:   0,
				Servings:          1,
				Calories:          ip(180),
				CocktailType:      sp("کلاسیک"),
				GlassType:         sp("لیوان راکس"),
				ServingSuggestion: sp("با یخ درشت و پوست پرتقال سرو شود."),
				ImageURL:          sp("https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=1200&q=80"),
				Status:            recipesfeat.RecipeStatusPublished,
				IsFeatured:        true,
				PublishedAt:       &now,
				MetaTitle:         sp("طرز تهیه اولد فشن | رومرا"),
				MetaDescription:   sp("دستور کلاسیک اولد فشن با ویسکی تک‌مالت."),
				MetaKeywords:      []string{"اولد فشن", "ویسکی", "کوکتل"},
			},
			products: []struct {
				slug, role string
				primary    bool
				qty, unit  string
			}{
				{"glen-highland-12yo", "base", true, "60", "میلی‌لیتر"},
			},
			ingredients: []struct {
				slug, name, qty, unit, notes string
				optional                     bool
			}{
				{"glen-highland-12yo", "ویسکی تک‌مالت", "60", "میلی‌لیتر", "", false},
				{"", "حبه قند", "1", "عدد", "", false},
				{"", "بیترز انگوستورا", "2", "قطره", "", false},
				{"", "پوست پرتقال", "1", "عدد", "برای تزئین", true},
			},
		},
		{
			req: &recipesfeat.RecipeReq{
				Title:             "همراهی شراب قرمز و استیک",
				Slug:              "red-wine-steak-pairing",
				Excerpt:           sp("راهنمای جفت‌سازی شراب قرمز پرمایه با استیک آبدار."),
				Description:       sp("چرا تانن و چربی بهترین دوست یکدیگرند."),
				Content:           "<p>تانن‌های شراب قرمز پرمایه چربی استیک را می‌شکنند و طعم گوشت را برجسته می‌کنند. بارولو یا مارگو را در دمای اتاق سرو کنید.</p>",
				Difficulty:        recipesfeat.RecipeDifficultyEasy,
				PrepTimeMinutes:   10,
				CookTimeMinutes:   15,
				Servings:          2,
				CocktailType:      nil,
				GlassType:         sp("گیلاس بوردو"),
				ServingSuggestion: sp("شراب را ۳۰ دقیقه پیش از سرو باز کنید تا تنفس کند."),
				ImageURL:          sp("https://images.unsplash.com/photo-1432139555190-58524dae6a55?auto=format&fit=crop&w=1200&q=80"),
				Status:            recipesfeat.RecipeStatusPublished,
				IsFeatured:        false,
				PublishedAt:       &now,
				MetaTitle:         sp("جفت‌سازی شراب قرمز و استیک | رومرا"),
				MetaDescription:   sp("راهنمای همراهی شراب قرمز بوردو با استیک."),
				MetaKeywords:      []string{"شراب قرمز", "استیک", "جفت‌سازی"},
			},
			products: []struct {
				slug, role string
				primary    bool
				qty, unit  string
			}{
				{"barolo-riserva-2016", "pairing", true, "1", "بطری"},
				{"chateau-margaux-grand-cru-2015", "pairing", false, "1", "بطری"},
			},
			ingredients: []struct {
				slug, name, qty, unit, notes string
				optional                     bool
			}{
				{"barolo-riserva-2016", "بارولو ریزروا", "1", "بطری", "", false},
				{"", "استیک ریب‌آی", "300", "گرم", "", false},
				{"", "نمک دریا و فلفل", "1", "قاشق", "", false},
			},
		},
		{
			req: &recipesfeat.RecipeReq{
				Title:             "اسپریتز شراب سفید",
				Slug:              "white-wine-spritz",
				Excerpt:           sp("نوشیدنی خنک تابستانی با شراب سفید و سودا."),
				Description:       sp("سبک، حباب‌دار و سرحال‌کننده برای عصرهای گرم."),
				Content:           "<p>شراب سفید خنک را با آب گازدار و کمی شربت آبلیمو ترکیب کنید، یخ و نعنا بیفزایید.</p>",
				Difficulty:        recipesfeat.RecipeDifficultyEasy,
				PrepTimeMinutes:   3,
				CookTimeMinutes:   0,
				Servings:          1,
				Calories:          ip(120),
				CocktailType:      sp("اسپریتز"),
				GlassType:         sp("گیلاس شراب"),
				ServingSuggestion: sp("با برگ نعنا و قاچ لیمو سرو شود."),
				ImageURL:          sp("https://images.unsplash.com/photo-1541557435984-1c79685a082b?auto=format&fit=crop&w=1200&q=80"),
				Status:            recipesfeat.RecipeStatusPublished,
				IsFeatured:        false,
				PublishedAt:       &now,
				MetaTitle:         sp("اسپریتز شراب سفید | رومرا"),
				MetaDescription:   sp("اسپریتز خنک با شابلی یا سانسر سفید."),
				MetaKeywords:      []string{"اسپریتز", "شراب سفید", "تابستان"},
			},
			products: []struct {
				slug, role string
				primary    bool
				qty, unit  string
			}{
				{"sancerre-blanc-2021", "base", true, "100", "میلی‌لیتر"},
			},
			ingredients: []struct {
				slug, name, qty, unit, notes string
				optional                     bool
			}{
				{"sancerre-blanc-2021", "شراب سفید سانسر", "100", "میلی‌لیتر", "", false},
				{"", "آب گازدار", "60", "میلی‌لیتر", "", false},
				{"", "برگ نعنا", "4", "عدد", "برای تزئین", true},
			},
		},
	}

	for _, r := range recipes {
		// Idempotency by slug.
		if _, found, err := s.scalarID(ctx, `SELECT id FROM recipes WHERE slug = $1`, r.req.Slug); err != nil {
			return err
		} else if found {
			s.c.skipped1("recipe")
			s.log.Info("skip recipe (exists)", zap.String("slug", r.req.Slug))
			continue
		}

		// Wire shoppable products → real product_variant_id values.
		for i, p := range r.products {
			vid := variants[p.slug]
			if vid == 0 {
				continue // product wasn't seeded; skip the link
			}
			sortOrder := i
			r.req.Products = append(r.req.Products, &recipesfeat.RecipeProductReq{
				ProductVariantID: vid,
				Quantity:         dec(p.qty),
				Unit:             sp(p.unit),
				SortOrder:        ip(sortOrder),
				IsPrimary:        p.primary,
				Role:             sp(p.role),
			})
		}

		// Ingredients — some linked to a real variant, some free-text.
		for i, ing := range r.ingredients {
			sortOrder := i
			req := &recipesfeat.RecipeIngredientReq{
				IngredientName: ing.name,
				Quantity:       dec(ing.qty),
				Unit:           sp(ing.unit),
				Optional:       ing.optional,
				SortOrder:      ip(sortOrder),
			}
			if ing.notes != "" {
				req.Notes = sp(ing.notes)
			}
			if ing.slug != "" {
				req.ProductVariantID = optionalVariantID(variants, ing.slug)
			}
			r.req.Ingredients = append(r.req.Ingredients, req)
		}

		// Tags by cocktail/role.
		switch r.req.Slug {
		case "classic-margarita", "old-fashioned", "white-wine-spritz":
			r.req.TagIDs = resolveKeys(tags, "cocktail")
		default:
			r.req.TagIDs = resolveKeys(tags, "premium")
		}

		if _, err := s.recipe.Create(ctx, r.req); err != nil {
			return fmt.Errorf("create recipe %q: %w", r.req.Slug, err)
		}
		s.c.created1("recipe")
		s.log.Info("created recipe", zap.String("slug", r.req.Slug))
	}

	return nil
}

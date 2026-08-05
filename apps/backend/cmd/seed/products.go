package main

import (
	"context"
	"fmt"

	"github.com/tiredbooy/internal/models"
	"go.uber.org/zap"
)

// ── products + variants + images + inventory ────────────────────────────────

// productSpec is the local seed shape; it carries everything needed to create a
// product plus its single seeded variant, gallery images and starting stock.
type productSpec struct {
	slug        string
	code        string
	title       string
	categoryKey string
	brandKey    string
	tagKeys     []string
	description string
	country     string
	abv         float64
	weight      float64
	sku         string
	price       string // Toman, as a numeric string
	compareAt   string // optional strike-through price ("" = none)
	stock       int
	images      []string // unsplash/picsum URLs; first is primary
	metaTitle   string
	metaDesc    string
}

func (s *seeder) seedProducts(ctx context.Context, brands, cats, tags map[string]int64) (map[string]int64, error) {
	specs := []productSpec{
		{
			slug: "chateau-margaux-grand-cru-2015", code: "WINE-MARGAUX-2015",
			title: "شاتو مارگو گرند کرو ۲۰۱۵", categoryKey: "wine-red", brandKey: "chateau-margaux",
			tagKeys:     []string{"premium", "aged", "bestselle"},
			description: "برداشت استثنایی سال ۲۰۱۵ از تاکستان مارگو؛ عطر بنفشه و توت سیاه با پایانه‌ای طولانی و مخملی. ایده‌آل برای نگهداری در سلر.",
			country:     "فرانسه", abv: 13.5, weight: 1.4,
			sku: "MARGAUX-2015-750", price: "12500000", compareAt: "14000000", stock: 24,
			images: []string{
				"https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=1200&q=80",
				"https://picsum.photos/seed/margaux2015/1200/800",
			},
			metaTitle: "شاتو مارگو ۲۰۱۵ | رومرا", metaDesc: "خرید شاتو مارگو گرند کرو ۲۰۱۵، شراب قرمز ممتاز بوردو.",
		},
		{
			slug: "barolo-riserva-2016", code: "WINE-BAROLO-2016",
			title: "بارولو ریزروا ۲۰۱۶", categoryKey: "wine-red", brandKey: "chateau-margaux",
			tagKeys:     []string{"premium", "aged"},
			description: "شراب قرمز ایتالیایی از انگور نبیولو؛ تانن‌های قدرتمند با عطر گل سرخ، قطران و گیلاس کهنه.",
			country:     "ایتالیا", abv: 14.0, weight: 1.4,
			sku: "BAROLO-2016-750", price: "8900000", compareAt: "", stock: 18,
			images: []string{
				"https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?auto=format&fit=crop&w=1200&q=80",
				"https://picsum.photos/seed/barolo2016/1200/800",
			},
			metaTitle: "بارولو ریزروا ۲۰۱۶ | رومرا", metaDesc: "بارولو ریزروا، شاهکار پیه‌مونته ایتالیا.",
		},
		{
			slug: "chablis-grand-cru-2020", code: "WINE-CHABLIS-2020",
			title: "شابلی گرند کرو ۲۰۲۰", categoryKey: "wine-white", brandKey: "chateau-margaux",
			tagKeys:     []string{"premium", "organic"},
			description: "شاردونی خالص از بورگاندی؛ خنک، مینرال و تُرد با عطر مرکبات و سنگ چخماق. سرو در دمای ۱۰ درجه.",
			country:     "فرانسه", abv: 12.5, weight: 1.3,
			sku: "CHABLIS-2020-750", price: "6200000", compareAt: "7000000", stock: 30,
			images: []string{
				"https://images.unsplash.com/photo-1566452348683-79a7b6f30b06?auto=format&fit=crop&w=1200&q=80",
				"https://picsum.photos/seed/chablis2020/1200/800",
			},
			metaTitle: "شابلی گرند کرو ۲۰۲۰ | رومرا", metaDesc: "شابلی سفید بورگاندی، شاردونی مینرال و معطر.",
		},
		{
			slug: "sancerre-blanc-2021", code: "WINE-SANCERRE-2021",
			title: "سانسر بلان ۲۰۲۱", categoryKey: "wine-white", brandKey: "chateau-margaux",
			tagKeys:     []string{"organic", "bestselle"},
			description: "سوویون بلان درخشان از دره لوآر؛ سرزنده با عطر گریپ‌فروت، علف تازه و کمی نمک دریا.",
			country:     "فرانسه", abv: 13.0, weight: 1.3,
			sku: "SANCERRE-2021-750", price: "4800000", compareAt: "", stock: 40,
			images: []string{
				"https://images.unsplash.com/photo-1474722883778-792e7990302f?auto=format&fit=crop&w=1200&q=80",
				"https://picsum.photos/seed/sancerre2021/1200/800",
			},
			metaTitle: "سانسر بلان ۲۰۲۱ | رومرا", metaDesc: "سانسر سوویون بلان دره لوآر، سرزنده و معطر.",
		},
		{
			slug: "glen-highland-18yo", code: "WHISKY-GLEN-18",
			title: "گلن هایلند ۱۸ ساله", categoryKey: "whisky", brandKey: "glen-highland",
			tagKeys:     []string{"premium", "aged", "gift", "bestselle"},
			description: "ویسکی تک‌مالت ۱۸ ساله رسیده در بشکه شری؛ عطر عسل، میوه خشک و دودِ ملایم با پایانه‌ای گرم.",
			country:     "اسکاتلند", abv: 43.0, weight: 1.5,
			sku: "GLEN-18-700", price: "9800000", compareAt: "11000000", stock: 15,
			images: []string{
				"https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=1200&q=80",
				"https://picsum.photos/seed/glen18/1200/800",
			},
			metaTitle: "گلن هایلند ۱۸ ساله | رومرا", metaDesc: "ویسکی تک‌مالت ۱۸ ساله رسیده در بشکه شری.",
		},
		{
			slug: "glen-highland-12yo", code: "WHISKY-GLEN-12",
			title: "گلن هایلند ۱۲ ساله", categoryKey: "whisky", brandKey: "glen-highland",
			tagKeys:     []string{"aged", "cocktail"},
			description: "ورودی محبوب خانواده گلن هایلند؛ متعادل و نرم با عطر وانیل، سیب و کمی ادویه. پایه‌ای عالی برای کوکتل.",
			country:     "اسکاتلند", abv: 40.0, weight: 1.5,
			sku: "GLEN-12-700", price: "5400000", compareAt: "", stock: 35,
			images: []string{
				"https://images.unsplash.com/photo-1582819509237-d6c3c8a4b8f3?auto=format&fit=crop&w=1200&q=80",
				"https://picsum.photos/seed/glen12/1200/800",
			},
			metaTitle: "گلن هایلند ۱۲ ساله | رومرا", metaDesc: "ویسکی تک‌مالت ۱۲ ساله، نرم و متعادل.",
		},
		{
			slug: "casa-del-sol-anejo", code: "TEQUILA-CASA-ANEJO",
			title: "کاسا دل سول آنیخو", categoryKey: "tequila", brandKey: "casa-del-sol",
			tagKeys:     []string{"premium", "cocktail", "gift"},
			description: "تکیلای آنیخو رسیده ۱۸ ماه در بشکه بلوط؛ عطر کارامل، وانیل و آگاو پخته با بافتی مخملی.",
			country:     "مکزیک", abv: 40.0, weight: 1.4,
			sku: "CASA-ANEJO-750", price: "7200000", compareAt: "8000000", stock: 22,
			images: []string{
				"https://images.unsplash.com/photo-1514218953589-2d7d37efd2dc?auto=format&fit=crop&w=1200&q=80",
				"https://picsum.photos/seed/casaanejo/1200/800",
			},
			metaTitle: "کاسا دل سول آنیخو | رومرا", metaDesc: "تکیلای آنیخو رسیده در بشکه بلوط، مخملی و معطر.",
		},
		{
			slug: "casa-del-sol-blanco", code: "TEQUILA-CASA-BLANCO",
			title: "کاسا دل سول بلانکو", categoryKey: "tequila", brandKey: "casa-del-sol",
			tagKeys:     []string{"cocktail", "organic"},
			description: "تکیلای بلانکوی شفاف از آگاو آبی خالص؛ تازه، فلفلی و مرکباتی. قلب هر مارگاریتای کلاسیک.",
			country:     "مکزیک", abv: 38.0, weight: 1.4,
			sku: "CASA-BLANCO-750", price: "4100000", compareAt: "", stock: 48,
			images: []string{
				"https://images.unsplash.com/photo-1551538827-9c037cb4f32a?auto=format&fit=crop&w=1200&q=80",
				"https://picsum.photos/seed/casablanco/1200/800",
			},
			metaTitle: "کاسا دل سول بلانکو | رومرا", metaDesc: "تکیلای بلانکو از آگاو آبی خالص، تازه و فلفلی.",
		},
	}

	// variants maps a product slug → its primary variant id, so recipes can wire
	// shoppable products to real product_variant_id values.
	variants := make(map[string]int64, len(specs))

	for _, spec := range specs {
		// Idempotency: skip the whole product if its slug already exists, but still
		// resolve the existing variant id so recipes can reference it.
		if pid, found, err := s.scalarID(ctx, `SELECT id FROM products WHERE slug = $1`, spec.slug); err != nil {
			return nil, err
		} else if found {
			s.c.skipped1("product")
			s.log.Info("skip product (exists)", zap.String("slug", spec.slug))
			if vid, vfound, vErr := s.scalarID(ctx,
				`SELECT id FROM product_variants WHERE product_id = $1 ORDER BY id LIMIT 1`, pid); vErr != nil {
				return nil, vErr
			} else if vfound {
				variants[spec.slug] = vid
			}
			continue
		}

		catID := cats[spec.categoryKey]
		brandID := brands[spec.brandKey]
		tagIDs := resolveKeys(tags, spec.tagKeys...)

		req := models.CreateProductReq{
			Title:           spec.title,
			Code:            sp(spec.code),
			Slug:            sp(spec.slug),
			CategoryID:      i64p(catID),
			BrandID:         i64p(brandID),
			Description:     sp(spec.description),
			CountryOfOrigin: sp(spec.country),
			ABV:             f64p(spec.abv),
			Weight:          f64p(spec.weight),
			MetaTitle:       sp(spec.metaTitle),
			MetaDescription: sp(spec.metaDesc),
			MetaTags:        spec.tagKeys,
		}
		p, err := s.product.Create(ctx, req)
		if err != nil {
			return nil, fmt.Errorf("create product %q: %w", spec.slug, err)
		}
		if len(tagIDs) > 0 {
			if err := s.product.AttachTags(ctx, p.ID, tagIDs); err != nil {
				return nil, fmt.Errorf("attach tags to %q: %w", spec.slug, err)
			}
		}
		s.c.created1("product")
		s.log.Info("created product", zap.String("slug", spec.slug), zap.Int64("id", p.ID))

		// Variant — price/compare_at live here, not on the product row.
		price, err := parsePrice(spec.price)
		if err != nil {
			return nil, fmt.Errorf("product %q price: %w", spec.slug, err)
		}
		vReq := models.CreateVariantReq{SKU: sp(spec.sku), Price: price}
		if spec.compareAt != "" {
			comparePrice, err := parsePrice(spec.compareAt)
			if err != nil {
				return nil, fmt.Errorf("product %q compare_at: %w", spec.slug, err)
			}
			vReq.CompareAtPrice = f64p(comparePrice)
		}
		v, err := s.variant.Create(ctx, p.ID, vReq)
		if err != nil {
			return nil, fmt.Errorf("create variant for %q: %w", spec.slug, err)
		}
		variants[spec.slug] = v.ID
		s.c.created1("variant")

		// Gallery images (product-level). First image is primary.
		for i, url := range spec.images {
			img := &models.ProductImage{
				ProductID: i64p(p.ID),
				ImageURL:  url,
				AltText:   sp(spec.title),
				SortOrder: i,
				IsPrimary: i == 0,
			}
			if _, err := s.image.Create(ctx, img); err != nil {
				return nil, fmt.Errorf("create image for %q: %w", spec.slug, err)
			}
			s.c.created1("image")
		}

		// Starting stock — there is no auto-create trigger on the inventory table,
		// so insert the row directly (idempotent via the UNIQUE variant_id).
		if err := s.ensureInventory(ctx, v.ID, spec.stock); err != nil {
			return nil, fmt.Errorf("seed inventory for %q: %w", spec.slug, err)
		}
		s.c.created1("inventory")
	}

	return variants, nil
}

// ensureInventory inserts a starting stock row for a variant, doing nothing if
// one already exists (the table has a UNIQUE constraint on product_variant_id).
func (s *seeder) ensureInventory(ctx context.Context, variantID int64, stock int) error {
	const q = `
		INSERT INTO inventory (product_variant_id, stock_on_hand, reorder_point, reorder_quantity, last_restock_at)
		VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT (product_variant_id) DO NOTHING`
	_, err := s.pool.Exec(ctx, q, variantID, stock, 5, 24)
	return err
}

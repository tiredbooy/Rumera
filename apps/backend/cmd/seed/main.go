// Command seed inserts realistic, on-brand Persian test data into the main
// database so the storefront (hero, categories, brands, products, recipes,
// journal) renders like a real luxury wine & spirits cellar in development.
//
// It is fully IDEMPOTENT: every entity is looked up by its natural key
// (slug / code / title) before insertion and skipped if it already exists, so
// re-running is always safe. Run it once the dev stack is up (migrations have
// applied) with:  make seed   (or)   go run ./cmd/seed
package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/shopspring/decimal"
	config "github.com/tiredbooy/configs"
	"github.com/tiredbooy/internal/logger"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/internal/services"
	"github.com/tiredbooy/pkg/database"
	"go.uber.org/zap"
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

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("seed: config: %v", err)
	}

	zlog, err := logger.New(cfg.Env, "logs")
	if err != nil {
		// Logging is non-fatal for a one-shot tool — fall back to a no-op logger.
		zlog = zap.NewNop()
	}
	defer func() { _ = zlog.Sync() }()

	// Mirror cmd/api's pool construction, but only the MAIN database — seed never
	// touches analytics. Migrations are owned by the API boot, so we just connect.
	pool, err := database.NewDB(cfg, zlog)
	if err != nil {
		log.Fatalf("seed: connect main db: %v", err)
	}
	defer pool.Close()

	s := newSeeder(pool, zlog)
	if err := s.run(ctx); err != nil {
		log.Fatalf("seed: %v", err)
	}

	zlog.Info("seed complete",
		zap.Any("created", s.c.created),
		zap.Any("skipped", s.c.skipped),
	)
}

// seeder owns the wired services + the raw pool used for the small idempotency
// look-ups and the few direct inserts (inventory, product images) that have no
// dedicated write service exposed here.
type seeder struct {
	pool *pgxpool.Pool
	log  *zap.Logger
	c    *counts

	brand    services.BrandService
	category services.CategoryService
	tag      *services.TagService
	product  *services.ProductService
	variant  *services.VariantService
	image    repositories.ProductImageRepository
	recipe   services.RecipeService
	blog     services.BlogService
	hero     services.HeroSlideService
}

func newSeeder(pool *pgxpool.Pool, zlog *zap.Logger) *seeder {
	return &seeder{
		pool:     pool,
		log:      zlog,
		c:        newCounts(),
		brand:    services.NewBrandService(repositories.NewBrandRepository(pool)),
		category: services.NewCategoryService(repositories.NewCategoryRepository(pool)),
		tag:      services.NewTagService(repositories.NewTagRepository(pool)),
		product:  services.NewProductService(repositories.NewProductRepository(pool)),
		variant:  services.NewVariantService(repositories.NewVariantRepository(pool)),
		image:    repositories.NewProductImageRepository(pool),
		recipe:   services.NewRecipeService(repositories.NewRecipeRepository(pool), pool),
		blog:     services.NewBlogService(repositories.NewBlogRepository(pool), pool),
		hero:     services.NewHeroSlideService(repositories.NewHeroSlideRepository(pool)),
	}
}

func (s *seeder) run(ctx context.Context) error {
	// FK order: brands + categories + tags → products → variants → images →
	// inventory → recipes (referencing variants) → blogs → hero slides.
	brandIDs, err := s.seedBrands(ctx)
	if err != nil {
		return fmt.Errorf("brands: %w", err)
	}
	catIDs, err := s.seedCategories(ctx)
	if err != nil {
		return fmt.Errorf("categories: %w", err)
	}
	tagIDs, err := s.seedTags(ctx)
	if err != nil {
		return fmt.Errorf("tags: %w", err)
	}
	variants, err := s.seedProducts(ctx, brandIDs, catIDs, tagIDs)
	if err != nil {
		return fmt.Errorf("products: %w", err)
	}
	if err := s.seedRecipes(ctx, variants, tagIDs); err != nil {
		return fmt.Errorf("recipes: %w", err)
	}
	if err := s.seedBlogs(ctx); err != nil {
		return fmt.Errorf("blogs: %w", err)
	}
	if err := s.seedHeroSlides(ctx); err != nil {
		return fmt.Errorf("hero slides: %w", err)
	}
	return nil
}

// ── helpers ─────────────────────────────────────────────────────────────────

func sp(s string) *string     { return &s }
func ip(i int) *int           { return &i }
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

// ── categories (with a parent/child tree) ────────────────────────────────────

func (s *seeder) seedCategories(ctx context.Context) (map[string]int64, error) {
	// A two-level tree: "شراب" is a parent of "شراب قرمز" / "شراب سفید".
	type cat struct {
		key       string
		name      string
		slug      string
		desc      string
		parentKey string // "" = root
	}
	items := []cat{
		{"wine", "شراب", "wine", "گزیده‌ای از بهترین شراب‌های جهان، از بوردو تا توسکانی.", ""},
		{"wine-red", "شراب قرمز", "red-wine", "شراب‌های قرمز پرمایه با تانن‌های مخملی.", "wine"},
		{"wine-white", "شراب سفید", "white-wine", "شراب‌های سفید خنک و معطر برای هر مناسبت.", "wine"},
		{"whisky", "ویسکی", "whisky", "ویسکی‌های تک‌مالت و ترکیبی کهنه‌شده.", ""},
		{"tequila", "تکیلا", "tequila", "تکیلای ناب از قلب مکزیک.", ""},
	}

	out := make(map[string]int64, len(items))
	// Insert roots first so children can reference their parent_id.
	for _, pass := range []bool{true, false} { // pass 1 = roots, pass 2 = children
		for _, it := range items {
			isRoot := it.parentKey == ""
			if isRoot != pass {
				continue
			}
			id, found, err := s.scalarID(ctx, `SELECT id FROM categories WHERE name = $1`, it.name)
			if err != nil {
				return nil, err
			}
			if found {
				out[it.key] = id
				s.c.skipped1("category")
				s.log.Info("skip category (exists)", zap.String("name", it.name))
				continue
			}
			req := models.CreateCategoryReq{
				Name:        it.name,
				Slug:        sp(it.slug),
				Description: sp(it.desc),
			}
			if !isRoot {
				pid, ok := out[it.parentKey]
				if !ok {
					return nil, fmt.Errorf("category %q references unknown parent %q", it.key, it.parentKey)
				}
				req.ParentID = i64p(pid)
			}
			c, err := s.category.Create(ctx, req)
			if err != nil {
				return nil, fmt.Errorf("create category %q: %w", it.name, err)
			}
			out[it.key] = c.ID
			s.c.created1("category")
			s.log.Info("created category", zap.String("name", c.Name), zap.Int64("id", c.ID))
		}
	}
	return out, nil
}

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
		t, err := s.tag.Create(ctx, models.CreateTagReq{Title: title})
		if err != nil {
			return nil, fmt.Errorf("create tag %q: %w", title, err)
		}
		out[key] = t.ID
		s.c.created1("tag")
		s.log.Info("created tag", zap.String("title", t.Title), zap.Int64("id", t.ID))
	}
	return out, nil
}

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
		var tagIDs []int64
		for _, tk := range spec.tagKeys {
			if id, ok := tags[tk]; ok {
				tagIDs = append(tagIDs, id)
			}
		}

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

// ── recipes ─────────────────────────────────────────────────────────────────

func (s *seeder) seedRecipes(ctx context.Context, variants, tags map[string]int64) error {
	// variantFor returns the seeded variant id for a product slug, or nil so the
	// shoppable/ingredient link is simply omitted if that product wasn't seeded.
	variantFor := func(slug string) *int64 {
		if id, ok := variants[slug]; ok {
			return i64p(id)
		}
		return nil
	}
	tagList := func(keys ...string) []int64 {
		var out []int64
		for _, k := range keys {
			if id, ok := tags[k]; ok {
				out = append(out, id)
			}
		}
		return out
	}

	now := time.Now().UTC()

	recipes := []struct {
		req      *models.RecipeReq
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
			req: &models.RecipeReq{
				Title:             "مارگاریتای کلاسیک",
				Slug:              "classic-margarita",
				Excerpt:           sp("کوکتل افسانه‌ای مکزیکی با تکیلا، لیموترش و کوآنترو."),
				Description:       sp("متعادل، ترش و سرحال‌کننده — مارگاریتا هرگز از مد نمی‌افتد."),
				Content:           "<p>لبه لیوان را با نمک بپوشانید. تکیلا، آب لیموترش تازه و کوآنترو را با یخ شیک کنید و در لیوان سرو کنید.</p>",
				Difficulty:        models.RecipeDifficultyEasy,
				PrepTimeMinutes:   5,
				CookTimeMinutes:   0,
				Servings:          1,
				Calories:          ip(210),
				CocktailType:      sp("کلاسیک"),
				GlassType:         sp("لیوان مارگاریتا"),
				ServingSuggestion: sp("با لبه نمکی و یک قاچ لیموترش سرو شود."),
				ImageURL:          sp("https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=1200&q=80"),
				Status:            models.RecipeStatusPublished,
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
			req: &models.RecipeReq{
				Title:             "اولد فشن",
				Slug:              "old-fashioned",
				Excerpt:           sp("سلطان کوکتل‌های ویسکی؛ ساده، قدرتمند و بی‌زمان."),
				Description:       sp("ترکیب ویسکی، شکر و انگوستورا روی یخ درشت."),
				Content:           "<p>یک حبه قند را با چند قطره انگوستورا خیس کنید، ویسکی بیفزایید و روی یخ درشت هم بزنید. با پوست پرتقال تزئین کنید.</p>",
				Difficulty:        models.RecipeDifficultyMedium,
				PrepTimeMinutes:   4,
				CookTimeMinutes:   0,
				Servings:          1,
				Calories:          ip(180),
				CocktailType:      sp("کلاسیک"),
				GlassType:         sp("لیوان راکس"),
				ServingSuggestion: sp("با یخ درشت و پوست پرتقال سرو شود."),
				ImageURL:          sp("https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=1200&q=80"),
				Status:            models.RecipeStatusPublished,
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
			req: &models.RecipeReq{
				Title:             "همراهی شراب قرمز و استیک",
				Slug:              "red-wine-steak-pairing",
				Excerpt:           sp("راهنمای جفت‌سازی شراب قرمز پرمایه با استیک آبدار."),
				Description:       sp("چرا تانن و چربی بهترین دوست یکدیگرند."),
				Content:           "<p>تانن‌های شراب قرمز پرمایه چربی استیک را می‌شکنند و طعم گوشت را برجسته می‌کنند. بارولو یا مارگو را در دمای اتاق سرو کنید.</p>",
				Difficulty:        models.RecipeDifficultyEasy,
				PrepTimeMinutes:   10,
				CookTimeMinutes:   15,
				Servings:          2,
				CocktailType:      nil,
				GlassType:         sp("گیلاس بوردو"),
				ServingSuggestion: sp("شراب را ۳۰ دقیقه پیش از سرو باز کنید تا تنفس کند."),
				ImageURL:          sp("https://images.unsplash.com/photo-1432139555190-58524dae6a55?auto=format&fit=crop&w=1200&q=80"),
				Status:            models.RecipeStatusPublished,
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
			req: &models.RecipeReq{
				Title:             "اسپریتز شراب سفید",
				Slug:              "white-wine-spritz",
				Excerpt:           sp("نوشیدنی خنک تابستانی با شراب سفید و سودا."),
				Description:       sp("سبک، حباب‌دار و سرحال‌کننده برای عصرهای گرم."),
				Content:           "<p>شراب سفید خنک را با آب گازدار و کمی شربت آبلیمو ترکیب کنید، یخ و نعنا بیفزایید.</p>",
				Difficulty:        models.RecipeDifficultyEasy,
				PrepTimeMinutes:   3,
				CookTimeMinutes:   0,
				Servings:          1,
				Calories:          ip(120),
				CocktailType:      sp("اسپریتز"),
				GlassType:         sp("گیلاس شراب"),
				ServingSuggestion: sp("با برگ نعنا و قاچ لیمو سرو شود."),
				ImageURL:          sp("https://images.unsplash.com/photo-1541557435984-1c79685a082b?auto=format&fit=crop&w=1200&q=80"),
				Status:            models.RecipeStatusPublished,
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
			r.req.Products = append(r.req.Products, &models.RecipeProductReq{
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
			req := &models.RecipeIngredientReq{
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
				req.ProductVariantID = variantFor(ing.slug)
			}
			r.req.Ingredients = append(r.req.Ingredients, req)
		}

		// Tags by cocktail/role.
		switch r.req.Slug {
		case "classic-margarita", "old-fashioned", "white-wine-spritz":
			r.req.TagIDs = tagList("cocktail")
		default:
			r.req.TagIDs = tagList("premium")
		}

		if _, err := s.recipe.Create(ctx, r.req); err != nil {
			return fmt.Errorf("create recipe %q: %w", r.req.Slug, err)
		}
		s.c.created1("recipe")
		s.log.Info("created recipe", zap.String("slug", r.req.Slug))
	}

	return nil
}

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
		req := &models.BlogReq{
			AuthorID:        author,
			Title:           p.title,
			Slug:            p.slug,
			Content:         p.body,
			Excerpt:         sp(p.excerpt),
			ImageURL:        sp(p.cover),
			TimeToRead:      p.minutes,
			Status:          models.BlogStatusPublished,
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

// ── hero slides ─────────────────────────────────────────────────────────────

func (s *seeder) seedHeroSlides(ctx context.Context) error {
	slides := []*models.HeroSlideReq{
		{
			Eyebrow:           sp("کلکسیون ویژه"),
			Title:             "سلر رومرا، جایی برای انتخاب‌های بی‌نظیر",
			Subtitle:          sp("گزیده‌ای از نادرترین شراب‌ها و نوشیدنی‌های جهان، مستقیماً به دست شما."),
			Badge:             sp("جدید"),
			ImageURL:          "https://images.unsplash.com/photo-1547595628-c61a29f496f0?auto=format&fit=crop&w=1920&q=80",
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
			ImageURL:       "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=1920&q=80",
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
			ImageURL:       "https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=1920&q=80",
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

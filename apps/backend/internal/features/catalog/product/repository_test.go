package product

import (
	"fmt"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/tiredbooy/internal/models"
)

func TestIsForeignKeyViolationRecognizesWrappedPostgresError(t *testing.T) {
	err := fmt.Errorf("delete product: %w", &pgconn.PgError{Code: "23503"})
	if !isForeignKeyViolation(err) {
		t.Fatal("wrapped foreign-key violation was not recognized")
	}
	if isForeignKeyViolation(&pgconn.PgError{Code: "23505"}) {
		t.Fatal("unique violation was incorrectly recognized as a foreign-key violation")
	}
}

func TestBuildProductFilterSQLScopesCategoryDescendantsInDatabase(t *testing.T) {
	categoryID := int64(7)
	brandID := int64(3)
	brandSlug := "jack-daniel"
	active := true
	filter := ProductFilter{
		BaseFilter:         models.BaseFilter{Search: "single malt"},
		CategoryID:         &categoryID,
		IncludeDescendants: true,
		BrandID:            &brandID,
		BrandSlug:          &brandSlug,
		IsActive:           &active,
	}

	query := buildProductFilterSQL(filter)
	if !strings.Contains(query.categoryScope, "RECURSIVE category_scope") {
		t.Fatalf("missing recursive category scope: %q", query.categoryScope)
	}
	if !strings.Contains(query.categoryScope, "SELECT CAST(@category_id AS BIGINT)") {
		t.Fatalf("selected category is not the recursive anchor: %q", query.categoryScope)
	}
	if !strings.Contains(query.categoryScope, "UNION\n") || strings.Contains(query.categoryScope, "UNION ALL") {
		t.Fatalf("recursive category scope must deduplicate cycles with UNION: %q", query.categoryScope)
	}
	if !strings.Contains(query.whereSQL, "p.category_id IN (SELECT id FROM category_scope)") {
		t.Fatalf("product filter does not use recursive category scope: %q", query.whereSQL)
	}
	for _, clause := range []string{
		"rumera_search_normalize(p.title) ILIKE @search ESCAPE",
		"rumera_search_normalize(p.description) ILIKE @search ESCAPE",
		"rumera_search_normalize(p.code) ILIKE @search ESCAPE",
		"search_brand.title",
		"search_cat.title",
		"rumera_search_normalize(search_sku.sku) ILIKE @search ESCAPE",
		"rumera_search_normalize(search_tag.title) ILIKE @search ESCAPE",
		"p.brand_id = @brand_id",
		"filter_brand.slug = @brand_slug",
		"p.is_active = @is_active",
	} {
		if !strings.Contains(query.whereSQL, clause) {
			t.Fatalf("global filter %q was lost: %q", clause, query.whereSQL)
		}
	}
	// PH-030a: whitespace stripped after normalize ("single malt" → "singlemalt")
	if query.args["category_id"] != categoryID || query.args["search"] != "%singlemalt%" {
		t.Fatalf("query args = %#v", query.args)
	}
	if query.args["brand_slug"] != brandSlug {
		t.Fatalf("brand slug arg = %#v", query.args["brand_slug"])
	}
}

func TestBuildProductFilterSQLEscapesLiteralSearchWildcards(t *testing.T) {
	query := buildProductFilterSQL(ProductFilter{
		BaseFilter: models.BaseFilter{Search: `100%_\ proof`},
	})

	// Normalize strips spaces; wildcards still escaped for literal match.
	// Input `100%_\ proof` → strip space → escape % _ \ → wrap.
	if got, want := query.args["search"], `%100\%\_\\proof%`; got != want {
		t.Fatalf("escaped search = %q; want %q", got, want)
	}
	if !strings.Contains(query.whereSQL, `ESCAPE E'\\'`) {
		t.Fatalf("search clause does not declare its escape character: %q", query.whereSQL)
	}
}

func TestBuildProductFilterSQLPersianNormalizeOnQuery(t *testing.T) {
	// Arabic yeh/kaf in query → Persian forms in the bound pattern.
	query := buildProductFilterSQL(ProductFilter{
		BaseFilter: models.BaseFilter{Search: "شراب" + "\u064A" + " " + "\u0643" + "لاسيك"},
	})
	// After normalize: ی and ک, no spaces.
	got, _ := query.args["search"].(string)
	if !strings.Contains(got, "شرابی") || !strings.Contains(got, "کلاسیک") {
		t.Fatalf("Persian normalize missing in pattern: %q", got)
	}
	if strings.Contains(got, "\u064A") || strings.Contains(got, "\u0643") {
		t.Fatalf("Arabic confusables still present: %q", got)
	}
}

func TestBuildProductFilterSQLSkipsEmptyAfterNormalize(t *testing.T) {
	query := buildProductFilterSQL(ProductFilter{
		BaseFilter: models.BaseFilter{Search: " \u200c\t "},
	})
	if _, ok := query.args["search"]; ok {
		t.Fatalf("empty normalized search should omit clause; args=%#v sql=%q", query.args, query.whereSQL)
	}
	if strings.Contains(query.whereSQL, "ILIKE") {
		t.Fatalf("empty search must not emit ILIKE: %q", query.whereSQL)
	}
}

func TestBuildProductFilterSQLPriceBoundsRequireActiveVariants(t *testing.T) {
	minPrice := 100.0
	maxPrice := 200.0

	minOnly := buildProductFilterSQL(ProductFilter{MinPrice: &minPrice})
	if !strings.Contains(minOnly.whereSQL, "pv.is_active") {
		t.Fatalf("min_price EXISTS omitted pv.is_active: %q", minOnly.whereSQL)
	}
	if !strings.Contains(minOnly.whereSQL, "pv.price >= @min_price") {
		t.Fatalf("min_price bound missing: %q", minOnly.whereSQL)
	}
	if strings.Contains(minOnly.whereSQL, "pv.price <= @max_price") {
		t.Fatalf("min-only filter emitted max_price: %q", minOnly.whereSQL)
	}
	if minOnly.args["min_price"] != minPrice {
		t.Fatalf("min_price arg = %#v", minOnly.args["min_price"])
	}

	maxOnly := buildProductFilterSQL(ProductFilter{MaxPrice: &maxPrice})
	if !strings.Contains(maxOnly.whereSQL, "pv.is_active") {
		t.Fatalf("max_price EXISTS omitted pv.is_active: %q", maxOnly.whereSQL)
	}
	if !strings.Contains(maxOnly.whereSQL, "pv.price <= @max_price") {
		t.Fatalf("max_price bound missing: %q", maxOnly.whereSQL)
	}
	if strings.Contains(maxOnly.whereSQL, "pv.price >= @min_price") {
		t.Fatalf("max-only filter emitted min_price: %q", maxOnly.whereSQL)
	}
	if maxOnly.args["max_price"] != maxPrice {
		t.Fatalf("max_price arg = %#v", maxOnly.args["max_price"])
	}

	both := buildProductFilterSQL(ProductFilter{MinPrice: &minPrice, MaxPrice: &maxPrice})
	if got := strings.Count(both.whereSQL, "pv.is_active"); got < 2 {
		t.Fatalf("combined price filter must require active variants on each EXISTS; got %d in %q", got, both.whereSQL)
	}
	if !strings.Contains(both.whereSQL, "pv.price >= @min_price") || !strings.Contains(both.whereSQL, "pv.price <= @max_price") {
		t.Fatalf("combined price bounds missing: %q", both.whereSQL)
	}
	if both.args["min_price"] != minPrice || both.args["max_price"] != maxPrice {
		t.Fatalf("combined price args = %#v", both.args)
	}

	// Guard: a price EXISTS without is_active would let retired SKUs match.
	for name, sql := range map[string]string{
		"min":  minOnly.whereSQL,
		"max":  maxOnly.whereSQL,
		"both": both.whereSQL,
	} {
		for _, bound := range []string{"pv.price >= @min_price", "pv.price <= @max_price"} {
			if !strings.Contains(sql, bound) {
				continue
			}
			if !strings.Contains(sql, "pv.is_active AND "+bound) && !strings.Contains(sql, bound+" AND pv.is_active") {
				t.Fatalf("%s price EXISTS does not AND pv.is_active with %s: %q", name, bound, sql)
			}
		}
	}
}

func TestBuildProductFilterSQLKeepsDirectCategoryContract(t *testing.T) {
	categoryID := int64(11)
	direct := buildProductFilterSQL(ProductFilter{CategoryID: &categoryID})
	if direct.categoryScope != "" || !strings.Contains(direct.whereSQL, "p.category_id = @category_id") {
		t.Fatalf("direct category filter = %+v", direct)
	}

	unused := buildProductFilterSQL(ProductFilter{IncludeDescendants: true})
	if unused.categoryScope != "" || strings.Contains(unused.whereSQL, "category_id") {
		t.Fatalf("descendant flag without category changed query = %+v", unused)
	}
}

func TestProductListSortExprAllowlist(t *testing.T) {
	cases := map[string]string{
		"title":      "p.title",
		"updated_at": "p.updated_at",
		"created_at": "p.created_at",
		"price":      "MIN(pv.price)",
		"discount":   "p.created_at", // unsupported → default
		"p.id;--":    "p.created_at", // never interpolate raw input
		"":           "p.created_at",
	}
	for input, wantFragment := range cases {
		got := productListSortExpr(input)
		if !strings.Contains(got, wantFragment) {
			t.Fatalf("sort %q → %q; want fragment %q", input, got, wantFragment)
		}
		// Guard against interpolating client-controlled identifiers into SQL.
		if input != "title" && input != "updated_at" && input != "created_at" && input != "price" && input != "" {
			if strings.Contains(got, input) {
				t.Fatalf("untrusted sort value leaked into SQL: input=%q expr=%q", input, got)
			}
		}
	}

	if productListSortDirection("asc") != "ASC" || productListSortDirection("ASC") != "ASC" {
		t.Fatal("ASC direction not recognized")
	}
	if productListSortDirection("desc") != "DESC" || productListSortDirection("") != "DESC" {
		t.Fatal("default direction should be DESC")
	}
}

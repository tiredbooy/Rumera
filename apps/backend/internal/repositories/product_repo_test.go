package repositories

import (
	"strings"
	"testing"

	"github.com/tiredbooy/internal/models"
)

func TestBuildProductFilterSQLScopesCategoryDescendantsInDatabase(t *testing.T) {
	categoryID := int64(7)
	brandID := int64(3)
	active := true
	filter := models.ProductFilter{
		BaseFilter:         models.BaseFilter{Search: "single malt"},
		CategoryID:         &categoryID,
		IncludeDescendants: true,
		BrandID:            &brandID,
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
	for _, clause := range []string{"p.title ILIKE @search ESCAPE", "p.brand_id = @brand_id", "p.is_active = @is_active"} {
		if !strings.Contains(query.whereSQL, clause) {
			t.Fatalf("global filter %q was lost: %q", clause, query.whereSQL)
		}
	}
	if query.args["category_id"] != categoryID || query.args["search"] != "%single malt%" {
		t.Fatalf("query args = %#v", query.args)
	}
}

func TestBuildProductFilterSQLEscapesLiteralSearchWildcards(t *testing.T) {
	query := buildProductFilterSQL(models.ProductFilter{
		BaseFilter: models.BaseFilter{Search: `100%_\ proof`},
	})

	if got, want := query.args["search"], `%100\%\_\\ proof%`; got != want {
		t.Fatalf("escaped search = %q; want %q", got, want)
	}
	if !strings.Contains(query.whereSQL, `ESCAPE E'\\'`) {
		t.Fatalf("search clause does not declare its escape character: %q", query.whereSQL)
	}
}

func TestBuildProductFilterSQLKeepsDirectCategoryContract(t *testing.T) {
	categoryID := int64(11)
	direct := buildProductFilterSQL(models.ProductFilter{CategoryID: &categoryID})
	if direct.categoryScope != "" || !strings.Contains(direct.whereSQL, "p.category_id = @category_id") {
		t.Fatalf("direct category filter = %+v", direct)
	}

	unused := buildProductFilterSQL(models.ProductFilter{IncludeDescendants: true})
	if unused.categoryScope != "" || strings.Contains(unused.whereSQL, "category_id") {
		t.Fatalf("descendant flag without category changed query = %+v", unused)
	}
}

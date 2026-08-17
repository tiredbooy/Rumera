package blog

import (
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
)

func TestApplyListSearchUsesNormalize(t *testing.T) {
	where, args := applyListSearch(nil, pgx.NamedArgs{}, "single malt")
	if len(where) != 1 {
		t.Fatalf("where clauses = %#v", where)
	}
	for _, clause := range []string{
		"rumera_search_normalize(b.title) ILIKE @search ESCAPE",
		"rumera_search_normalize(b.excerpt) ILIKE @search ESCAPE",
	} {
		if !strings.Contains(where[0], clause) {
			t.Fatalf("missing %q in %q", clause, where[0])
		}
	}
	if args["search"] != "%singlemalt%" {
		t.Fatalf("search arg = %#v", args["search"])
	}
}

func TestApplyListSearchEscapesLiteralSearchWildcards(t *testing.T) {
	where, args := applyListSearch(nil, pgx.NamedArgs{}, `100%_\ proof`)
	if got, want := args["search"], `%100\%\_\\proof%`; got != want {
		t.Fatalf("escaped search = %q; want %q", got, want)
	}
	if len(where) == 0 || !strings.Contains(where[0], `ESCAPE E'\\'`) {
		t.Fatalf("search clause does not declare its escape character: %#v", where)
	}
}

func TestApplyListSearchPersianNormalizeOnQuery(t *testing.T) {
	_, args := applyListSearch(nil, pgx.NamedArgs{}, "شراب"+"\u064A"+" "+"\u0643"+"لاسيك")
	got, _ := args["search"].(string)
	if !strings.Contains(got, "شرابی") || !strings.Contains(got, "کلاسیک") {
		t.Fatalf("Persian normalize missing in pattern: %q", got)
	}
	if strings.Contains(got, "\u064A") || strings.Contains(got, "\u0643") {
		t.Fatalf("Arabic confusables still present: %q", got)
	}
}

func TestApplyListSearchSkipsEmptyAfterNormalize(t *testing.T) {
	where, args := applyListSearch(nil, pgx.NamedArgs{}, " \u200c\t ")
	if _, ok := args["search"]; ok {
		t.Fatalf("empty normalized search should omit clause; args=%#v where=%#v", args, where)
	}
	if len(where) != 0 {
		t.Fatalf("empty search must not emit ILIKE: %#v", where)
	}
}

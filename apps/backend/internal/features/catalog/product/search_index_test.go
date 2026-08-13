package product

import (
	"context"
	"strings"
	"testing"

	"github.com/tiredbooy/internal/models"
)

func TestDocumentsFromIndexRowsPersianNormalize(t *testing.T) {
	arabicYeh := "شراب" + "\u064A" // ends with Arabic yeh
	brand := "Jack Daniel's"
	cat := "ویسکی"
	desc := "می\u200cخواهم"
	rows := []SearchIndexRow{{
		ID:            7,
		Title:         arabicYeh,
		Description:   &desc,
		BrandTitle:    &brand,
		CategoryTitle: &cat,
		TagTitles:     []string{"premium"},
		MinPrice:      10,
		MaxPrice:      20,
		IsActive:      true,
	}}
	docs := DocumentsFromIndexRows(rows)
	if len(docs) != 1 {
		t.Fatalf("len = %d", len(docs))
	}
	d := docs[0]
	if d.ID != 7 || d.Title != arabicYeh {
		t.Fatalf("display fields = %+v", d)
	}
	if strings.Contains(d.TitleSearch, "\u064A") {
		t.Fatalf("title_search still has Arabic yeh: %q", d.TitleSearch)
	}
	if d.TitleSearch != "شرابی" {
		t.Fatalf("title_search = %q; want شرابی", d.TitleSearch)
	}
	if d.DescriptionSearch != "میخواهم" {
		t.Fatalf("description_search = %q", d.DescriptionSearch)
	}
	if d.BrandSearch != "jackdaniel's" {
		t.Fatalf("brand_search = %q", d.BrandSearch)
	}
	if d.BrandTitle == nil || *d.BrandTitle != brand {
		t.Fatalf("brand_title = %v", d.BrandTitle)
	}
	if d.MinPrice != 10 || d.MaxPrice != 20 {
		t.Fatalf("prices = %v %v", d.MinPrice, d.MaxPrice)
	}
	if len(d.Tags) != 1 || d.Tags[0] != "premium" {
		t.Fatalf("tags = %v", d.Tags)
	}
}

func TestToMeiliProductNilTags(t *testing.T) {
	doc := ToMeiliProduct(&Product{ID: 1, Title: "A"}, nil, nil, nil, 0, 0)
	if doc.Tags == nil {
		t.Fatal("tags should be empty slice not nil for stable JSON")
	}
	if doc.TitleSearch != "a" {
		t.Fatalf("title_search = %q", doc.TitleSearch)
	}
}

type stubSource struct {
	rows []SearchIndexRow
	err  error
}

func (s stubSource) ListForSearchIndex(ctx context.Context) ([]SearchIndexRow, error) {
	return s.rows, s.err
}

type stubWriter struct {
	ensure, deleteAll, upserts int
	lastDocs                   any
	failEnsure                 error
}

func (w *stubWriter) EnsureProductsIndex(ctx context.Context) error {
	w.ensure++
	return w.failEnsure
}
func (w *stubWriter) DeleteAllDocuments(ctx context.Context) error {
	w.deleteAll++
	return nil
}
func (w *stubWriter) UpsertDocuments(ctx context.Context, docs any) error {
	w.upserts++
	w.lastDocs = docs
	return nil
}

func TestMeiliIndexerFullReindex(t *testing.T) {
	src := stubSource{rows: []SearchIndexRow{{ID: 1, Title: "Test", IsActive: true}}}
	w := &stubWriter{}
	idx := NewMeiliIndexer(src, w, nil)
	idx.batchSize = 50
	if err := idx.FullReindex(context.Background()); err != nil {
		t.Fatal(err)
	}
	if w.ensure != 1 || w.deleteAll != 1 || w.upserts != 1 {
		t.Fatalf("calls ensure=%d delete=%d upsert=%d", w.ensure, w.deleteAll, w.upserts)
	}
	docs, ok := w.lastDocs.([]models.MeiliProduct)
	if !ok || len(docs) != 1 || docs[0].TitleSearch != "test" {
		t.Fatalf("lastDocs = %#v", w.lastDocs)
	}
}

func TestMeiliIndexerNotConfigured(t *testing.T) {
	idx := &MeiliIndexer{}
	if err := idx.FullReindex(context.Background()); err == nil {
		t.Fatal("expected error")
	}
}

func TestMeiliIndexerBatches(t *testing.T) {
	rows := make([]SearchIndexRow, 5)
	for i := range rows {
		rows[i] = SearchIndexRow{ID: int64(i + 1), Title: "P"}
	}
	w := &stubWriter{}
	idx := NewMeiliIndexer(stubSource{rows: rows}, w, nil)
	idx.batchSize = 2
	if err := idx.FullReindex(context.Background()); err != nil {
		t.Fatal(err)
	}
	// 5 docs / batch 2 → 3 upserts
	if w.upserts != 3 {
		t.Fatalf("upserts = %d; want 3", w.upserts)
	}
}

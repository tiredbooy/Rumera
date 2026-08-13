package product

import (
	"context"
	"fmt"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/meili"
	"go.uber.org/zap"
)

// SearchIndexRow is the Postgres projection used to build MeiliProduct documents.
type SearchIndexRow struct {
	ID              int64
	Title           string
	Code            *string
	Slug            *string
	Description     *string
	BrandID         *int64
	BrandTitle      *string
	CategoryID      *int64
	CategoryTitle   *string
	IsActive        bool
	CountryOfOrigin *string
	MetaTags        []string
	TagTitles       []string
	MinPrice        float64
	MaxPrice        float64
}

// ListForSearchIndex returns all products for a full Meili rebuild.
func (r *repository) ListForSearchIndex(ctx context.Context) ([]SearchIndexRow, error) {
	const q = `
		SELECT
			p.id,
			p.title,
			p.code,
			p.slug,
			p.description,
			p.brand_id,
			b.title AS brand_title,
			p.category_id,
			c.title AS category_title,
			p.is_active,
			p.country_of_origin,
			COALESCE(p.meta_tags, ARRAY[]::TEXT[]) AS meta_tags,
			COALESCE((
				SELECT ARRAY_AGG(t.title ORDER BY t.title, t.id)
				FROM product_tags pt
				INNER JOIN tags t ON t.id = pt.tag_id
				WHERE pt.product_id = p.id
			), ARRAY[]::TEXT[]) AS tag_titles,
			COALESCE((
				SELECT MIN(pv.price)
				FROM product_variants pv
				WHERE pv.product_id = p.id AND pv.is_active
			), 0) AS min_price,
			COALESCE((
				SELECT MAX(pv.price)
				FROM product_variants pv
				WHERE pv.product_id = p.id AND pv.is_active
			), 0) AS max_price
		FROM products p
		LEFT JOIN brands b ON b.id = p.brand_id
		LEFT JOIN categories c ON c.id = p.category_id
		ORDER BY p.id`

	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("ListForSearchIndex: %w", err)
	}
	defer rows.Close()

	out := make([]SearchIndexRow, 0, 128)
	for rows.Next() {
		var row SearchIndexRow
		if err := rows.Scan(
			&row.ID,
			&row.Title,
			&row.Code,
			&row.Slug,
			&row.Description,
			&row.BrandID,
			&row.BrandTitle,
			&row.CategoryID,
			&row.CategoryTitle,
			&row.IsActive,
			&row.CountryOfOrigin,
			&row.MetaTags,
			&row.TagTitles,
			&row.MinPrice,
			&row.MaxPrice,
		); err != nil {
			return nil, fmt.Errorf("ListForSearchIndex scan: %w", err)
		}
		if row.MetaTags == nil {
			row.MetaTags = []string{}
		}
		if row.TagTitles == nil {
			row.TagTitles = []string{}
		}
		out = append(out, row)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("ListForSearchIndex rows: %w", err)
	}
	return out, nil
}

// DocumentsFromIndexRows maps SQL rows to Meili documents (pure; unit-tested).
func DocumentsFromIndexRows(rows []SearchIndexRow) []models.MeiliProduct {
	docs := make([]models.MeiliProduct, 0, len(rows))
	for i := range rows {
		row := &rows[i]
		p := &Product{
			ID:              row.ID,
			Title:           row.Title,
			Code:            row.Code,
			Slug:            row.Slug,
			Description:     row.Description,
			BrandID:         row.BrandID,
			CategoryID:      row.CategoryID,
			IsActive:        row.IsActive,
			CountryOfOrigin: row.CountryOfOrigin,
			MetaTags:        row.MetaTags,
		}
		docs = append(docs, ToMeiliProduct(
			p,
			row.BrandTitle,
			row.CategoryTitle,
			row.TagTitles,
			row.MinPrice,
			row.MaxPrice,
		))
	}
	return docs
}

// MeiliDocumentSource loads index rows (narrow interface for the indexer).
type MeiliDocumentSource interface {
	ListForSearchIndex(ctx context.Context) ([]SearchIndexRow, error)
}

// MeiliWriter is the Meili client surface used by FullReindex.
type MeiliWriter interface {
	EnsureProductsIndex(ctx context.Context) error
	DeleteAllDocuments(ctx context.Context) error
	UpsertDocuments(ctx context.Context, docs any) error
}

// MeiliIndexer rebuilds the products index from Postgres (PH-030b).
// Does not change the storefront query path.
type MeiliIndexer struct {
	src    MeiliDocumentSource
	client MeiliWriter
	log    *zap.Logger
	// batchSize caps documents per Meili upsert (default 200).
	batchSize int
}

// NewMeiliIndexer wires Postgres source + Meili client.
func NewMeiliIndexer(src MeiliDocumentSource, client MeiliWriter, log *zap.Logger) *MeiliIndexer {
	if log == nil {
		log = zap.NewNop()
	}
	return &MeiliIndexer{src: src, client: client, log: log, batchSize: 200}
}

// FullReindex ensures settings, clears the index, and upserts all documents.
func (i *MeiliIndexer) FullReindex(ctx context.Context) error {
	if i == nil || i.client == nil || i.src == nil {
		return fmt.Errorf("meili indexer not configured")
	}
	if err := i.client.EnsureProductsIndex(ctx); err != nil {
		return err
	}
	rows, err := i.src.ListForSearchIndex(ctx)
	if err != nil {
		return err
	}
	docs := DocumentsFromIndexRows(rows)
	// Clear first so deleted products disappear (full rebuild semantics).
	if err := i.client.DeleteAllDocuments(ctx); err != nil {
		return err
	}
	batch := i.batchSize
	if batch <= 0 {
		batch = 200
	}
	for start := 0; start < len(docs); start += batch {
		end := start + batch
		if end > len(docs) {
			end = len(docs)
		}
		if err := i.client.UpsertDocuments(ctx, docs[start:end]); err != nil {
			return fmt.Errorf("meili upsert batch %d-%d: %w", start, end, err)
		}
	}
	i.log.Info("meili full reindex complete",
		zap.Int("documents", len(docs)),
		zap.Int("batches", (len(docs)+batch-1)/batch),
	)
	return nil
}

// Compile-time check: meili.Client satisfies MeiliWriter.
var _ MeiliWriter = (*meili.Client)(nil)

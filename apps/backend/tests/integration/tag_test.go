//go:build integration

package integration

import (
	"context"
	"errors"
	"github.com/tiredbooy/internal/features/catalog/product"
	"github.com/tiredbooy/internal/features/catalog/tag"
	"os"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/tiredbooy/internal/models"
)

func TestEnsureTagSlugsUpgradesLegacySchema(t *testing.T) {
	requireDB(t)
	ctx := context.Background()
	conn, err := testPool.Acquire(ctx)
	if err != nil {
		t.Fatalf("acquire connection: %v", err)
	}
	defer func() {
		_, _ = conn.Exec(context.Background(), `DROP TABLE IF EXISTS pg_temp.tags`)
		conn.Release()
	}()

	if _, err := conn.Exec(ctx, `
		CREATE TEMP TABLE tags (
			id BIGSERIAL PRIMARY KEY,
			title VARCHAR(255) NOT NULL UNIQUE,
			description TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`); err != nil {
		t.Fatalf("create legacy tags table: %v", err)
	}
	if _, err := conn.Exec(ctx,
		`INSERT INTO tags (title) VALUES ('legacy one'), ('legacy two')`,
	); err != nil {
		t.Fatalf("seed legacy tags: %v", err)
	}

	migration, err := os.ReadFile("../../migrations/main/20260719110000_ensure_tag_slugs.sql")
	if err != nil {
		t.Fatalf("read tag slug migration: %v", err)
	}
	for run := 1; run <= 2; run++ {
		if _, err := conn.Exec(ctx, string(migration), pgx.QueryExecModeSimpleProtocol); err != nil {
			t.Fatalf("run tag slug migration %d: %v", run, err)
		}
	}

	rows, err := conn.Query(ctx, `SELECT slug FROM tags ORDER BY id`)
	if err != nil {
		t.Fatalf("query migrated slugs: %v", err)
	}
	defer rows.Close()

	var slugs []string
	for rows.Next() {
		var slug string
		if err := rows.Scan(&slug); err != nil {
			t.Fatalf("scan migrated slug: %v", err)
		}
		slugs = append(slugs, slug)
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate migrated slugs: %v", err)
	}
	if len(slugs) != 2 || slugs[0] != "tag-1" || slugs[1] != "tag-2" {
		t.Fatalf("migrated slugs = %v; want [tag-1 tag-2]", slugs)
	}

	var slugNotNull bool
	if err := conn.QueryRow(ctx, `
		SELECT attnotnull
		FROM pg_attribute
		WHERE attrelid = 'tags'::regclass AND attname = 'slug'`,
	).Scan(&slugNotNull); err != nil {
		t.Fatalf("inspect slug nullability: %v", err)
	}
	if !slugNotNull {
		t.Fatal("tags.slug must be NOT NULL after migration")
	}
	if _, err := conn.Exec(ctx,
		`INSERT INTO tags (title, slug) VALUES ('duplicate slug', 'tag-1')`,
	); err == nil {
		t.Fatal("duplicate slug insert succeeded; want unique constraint violation")
	}
}

func TestTagRepositoryCRUDListAndConflicts(t *testing.T) {
	requireDB(t)
	resetTables(t, "products", "tags")
	ctx := context.Background()
	repo := tag.NewRepository(testPool)
	description := "seasonal bottles"

	created, err := repo.Create(ctx, tag.CreateTagReq{
		Title:       "Summer",
		Slug:        "summer",
		Description: &description,
	})
	if err != nil {
		t.Fatalf("create tag: %v", err)
	}
	if created.Slug != "summer" || created.Description == nil || *created.Description != description {
		t.Fatalf("created tag = %+v", created)
	}

	byID, err := repo.GetByID(ctx, created.ID)
	if err != nil || byID.Slug != created.Slug {
		t.Fatalf("get tag = %+v, %v", byID, err)
	}

	filter := tag.TagFilter{BaseFilter: models.BaseFilter{
		PaginationParams: models.PaginationParams{Page: 1, Limit: 20},
		SortBy:           "title",
		OrderBy:          "asc",
		Search:           "summ",
	}}
	rows, total, err := repo.GetAll(ctx, filter)
	if err != nil || total != 1 || len(rows) != 1 || rows[0].ID != created.ID {
		t.Fatalf("list tags = %+v, total %d, err %v", rows, total, err)
	}

	if _, err := repo.Create(ctx, tag.CreateTagReq{Title: "Summer", Slug: "other"}); !errors.Is(err, models.ErrConflict) {
		t.Fatalf("duplicate title err = %v; want ErrConflict", err)
	}
	if _, err := repo.Create(ctx, tag.CreateTagReq{Title: "Other", Slug: "summer"}); !errors.Is(err, models.ErrConflict) {
		t.Fatalf("duplicate slug err = %v; want ErrConflict", err)
	}
	other, err := repo.Create(ctx, tag.CreateTagReq{Title: "Other", Slug: "other"})
	if err != nil {
		t.Fatalf("create conflict target: %v", err)
	}
	conflictingSlug := other.Slug
	if _, err := repo.Update(ctx, created.ID, tag.UpdateTagReq{Slug: &conflictingSlug}); !errors.Is(err, models.ErrConflict) {
		t.Fatalf("duplicate update err = %v; want ErrConflict", err)
	}
	if err := repo.Delete(ctx, other.ID); err != nil {
		t.Fatalf("delete conflict target: %v", err)
	}

	title := "Summer edit"
	slug := "summer-edit"
	update := tag.UpdateTagReq{Title: &title, Slug: &slug}
	update.Description.Set = true
	updated, err := repo.Update(ctx, created.ID, update)
	if err != nil {
		t.Fatalf("update tag: %v", err)
	}
	if updated.Title != title || updated.Slug != slug || updated.Description != nil {
		t.Fatalf("updated tag = %+v", updated)
	}

	productID := seedProduct(t)
	productRepo := product.NewRepository(testPool)
	if err := productRepo.AttachTags(ctx, productID, []int64{created.ID}); err != nil {
		t.Fatalf("attach product tag: %v", err)
	}
	productTags, err := productRepo.GetTags(ctx, productID)
	if err != nil || len(productTags) != 1 || productTags[0].ID != created.ID {
		t.Fatalf("product tags = %+v, err %v", productTags, err)
	}

	filter.Page = 99
	filter.Limit = 1
	filter.Search = ""
	rows, total, err = repo.GetAll(ctx, filter)
	if err != nil || total != 1 || len(rows) != 0 {
		t.Fatalf("out-of-range list = %+v, total %d, err %v", rows, total, err)
	}

	if err := repo.Delete(ctx, created.ID); err != nil {
		t.Fatalf("delete tag: %v", err)
	}
	if _, err := repo.GetByID(ctx, created.ID); !errors.Is(err, models.ErrNotFound) {
		t.Fatalf("get deleted err = %v; want ErrNotFound", err)
	}
	if err := repo.Delete(ctx, created.ID); !errors.Is(err, models.ErrNotFound) {
		t.Fatalf("delete missing err = %v; want ErrNotFound", err)
	}
}

//go:build integration

package integration

import (
	"context"
	"errors"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/tiredbooy/internal/features/catalog/category"
	"github.com/tiredbooy/internal/models"
)

func categoryPatchValue[T any](value T) models.NullablePatch[T] {
	return models.NullablePatch[T]{Set: true, Value: &value}
}

func TestCategorySlugMigrationNormalizesLegacyRows(t *testing.T) {
	requireDB(t)
	ctx := context.Background()
	conn, err := testPool.Acquire(ctx)
	if err != nil {
		t.Fatalf("acquire connection: %v", err)
	}
	defer func() {
		_, _ = conn.Exec(context.Background(), `DROP TABLE IF EXISTS pg_temp.categories`)
		conn.Release()
	}()

	if _, err := conn.Exec(ctx, `CREATE TEMP TABLE categories (id BIGSERIAL PRIMARY KEY, slug TEXT)`); err != nil {
		t.Fatalf("create legacy categories table: %v", err)
	}
	if _, err := conn.Exec(ctx, `
		INSERT INTO categories (slug) VALUES
			('Single_Malt'),
			('single.malt'),
			('   '),
			(E'\t\n'),
			(U&'\00A0\3000'),
			('ویسکی / ویژه'),
			('---')`); err != nil {
		t.Fatalf("seed legacy category slugs: %v", err)
	}

	migration, err := os.ReadFile("../../migrations/main/20260721160000_ensure_category_slug_identity.sql")
	if err != nil {
		t.Fatalf("read category slug migration: %v", err)
	}
	upSQL := strings.SplitN(string(migration), "-- +goose Down", 2)[0]
	if _, err := conn.Exec(ctx, upSQL, pgx.QueryExecModeSimpleProtocol); err != nil {
		t.Fatalf("run category slug migration: %v", err)
	}

	rows, err := conn.Query(ctx, `SELECT slug FROM categories ORDER BY id`)
	if err != nil {
		t.Fatalf("query migrated slugs: %v", err)
	}
	defer rows.Close()

	var slugs []*string
	for rows.Next() {
		var slug *string
		if err := rows.Scan(&slug); err != nil {
			t.Fatalf("scan migrated slug: %v", err)
		}
		slugs = append(slugs, slug)
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate migrated slugs: %v", err)
	}
	want := []*string{
		stringPointer("single-malt"),
		stringPointer("single-malt-2-1"),
		nil,
		nil,
		nil,
		stringPointer("ویسکی-ویژه"),
		stringPointer("category-7"),
	}
	if len(slugs) != len(want) {
		t.Fatalf("migrated slugs = %v; want %v", slugs, want)
	}
	for i := range want {
		if (slugs[i] == nil) != (want[i] == nil) || (slugs[i] != nil && *slugs[i] != *want[i]) {
			t.Fatalf("migrated slug %d = %v; want %v", i, slugs[i], want[i])
		}
	}
}

func stringPointer(value string) *string { return &value }

func TestCategorySlugIdentityConstraints(t *testing.T) {
	requireDB(t)
	resetTables(t, "categories")
	ctx := context.Background()

	if _, err := testPool.Exec(ctx,
		`INSERT INTO categories (title, slug) VALUES ('First', 'single-malt')`,
	); err != nil {
		t.Fatalf("insert canonical category: %v", err)
	}
	if _, err := testPool.Exec(ctx,
		`INSERT INTO categories (title, slug) VALUES ('Duplicate', 'single-malt')`,
	); err == nil {
		t.Fatal("duplicate category slug insert succeeded")
	}
	if _, err := testPool.Exec(ctx,
		`INSERT INTO categories (title, slug) VALUES ('Broken path', 'single/malt')`,
	); err == nil {
		t.Fatal("path-breaking category slug insert succeeded")
	}
	if _, err := testPool.Exec(ctx,
		`INSERT INTO categories (title, slug) VALUES ('Structural A', NULL), ('Structural B', NULL)`,
	); err != nil {
		t.Fatalf("optional structural slugs: %v", err)
	}
}

func TestCategoryRepositoryClearsNullableFields(t *testing.T) {
	requireDB(t)
	resetTables(t, "categories")
	ctx := context.Background()
	repo := category.NewRepository(testPool)

	var parentID int64
	if err := testPool.QueryRow(ctx,
		`INSERT INTO categories (title, slug) VALUES ('Parent', 'parent') RETURNING id`,
	).Scan(&parentID); err != nil {
		t.Fatalf("insert parent: %v", err)
	}
	var childID int64
	if err := testPool.QueryRow(ctx, `
		INSERT INTO categories (title, slug, parent_id, description, image_url)
		VALUES ('Child', 'child', $1, 'description', '/media/child.webp')
		RETURNING id`, parentID).Scan(&childID); err != nil {
		t.Fatalf("insert child: %v", err)
	}

	updated, err := repo.Update(ctx, childID, category.UpdateCategoryReq{
		Slug:        models.NullablePatch[string]{Set: true},
		ParentID:    models.NullablePatch[int64]{Set: true},
		Description: models.NullablePatch[string]{Set: true},
		ImageURL:    models.NullablePatch[string]{Set: true},
	})
	if err != nil {
		t.Fatalf("clear category fields: %v", err)
	}
	if updated.Slug != nil || updated.ParentID != nil || updated.Description != nil || updated.ImageURL != nil {
		t.Fatalf("cleared category = %+v", updated)
	}
}

func TestCategoryRepositorySerializesConcurrentParentSwaps(t *testing.T) {
	requireDB(t)
	resetTables(t, "categories")
	ctx := context.Background()
	repo := category.NewRepository(testPool)

	var firstID, secondID int64
	if err := testPool.QueryRow(ctx,
		`INSERT INTO categories (title, slug) VALUES ('First', 'first') RETURNING id`,
	).Scan(&firstID); err != nil {
		t.Fatalf("insert first category: %v", err)
	}
	if err := testPool.QueryRow(ctx,
		`INSERT INTO categories (title, slug) VALUES ('Second', 'second') RETURNING id`,
	).Scan(&secondID); err != nil {
		t.Fatalf("insert second category: %v", err)
	}

	start := make(chan struct{})
	results := make(chan error, 2)
	go func() {
		<-start
		_, err := repo.Update(ctx, firstID, category.UpdateCategoryReq{
			ParentID: categoryPatchValue(secondID),
		})
		results <- err
	}()
	go func() {
		<-start
		_, err := repo.Update(ctx, secondID, category.UpdateCategoryReq{
			ParentID: categoryPatchValue(firstID),
		})
		results <- err
	}()
	close(start)

	succeeded := 0
	rejected := 0
	for range 2 {
		err := <-results
		switch {
		case err == nil:
			succeeded++
		case errors.Is(err, models.ErrInvalidState):
			rejected++
		default:
			t.Fatalf("concurrent parent update error = %v", err)
		}
	}
	if succeeded != 1 || rejected != 1 {
		t.Fatalf("parent swap outcomes: succeeded=%d rejected=%d", succeeded, rejected)
	}
}

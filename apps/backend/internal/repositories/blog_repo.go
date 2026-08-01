package repositories

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
)

type BlogCategoryRepository interface {
	GetByID(ctx context.Context, id int64) (*models.BlogCategory, error)
	GetAll(ctx context.Context) ([]*models.BlogCategory, error)
	Create(ctx context.Context, req *models.BlogCategoryReq) (*models.BlogCategory, error)
	Update(ctx context.Context, id int64, req *models.BlogCategoryUpdateReq) (*models.BlogCategory, error)
	Delete(ctx context.Context, id int64) error
}

type BlogRepository interface {
	GetByID(ctx context.Context, id int64) (*models.Blog, error)
	GetBySlug(ctx context.Context, slug string) (*models.Blog, error)
	GetPublishedBySlug(ctx context.Context, slug string) (*models.Blog, error)
	GetAll(ctx context.Context) ([]*models.Blog, error)
	List(ctx context.Context, filter models.BlogFilter) ([]*models.Blog, int64, error)
	Create(ctx context.Context, req *models.BlogReq) (*models.Blog, error)
	Update(ctx context.Context, id int64, req *models.BlogUpdateReq) (*models.Blog, error)
	SoftDelete(ctx context.Context, id int64) error
	IncrementReads(ctx context.Context, id int64) error
	SlugExists(ctx context.Context, slug string) (bool, error)
	WithTx(tx pgx.Tx) BlogRepository

	// relations
	AssignCategories(ctx context.Context, blogID int64, categoryIDs []int64) error
	RemoveCategories(ctx context.Context, blogID int64) error
	GetCategoriesByBlogID(ctx context.Context, blogID int64) ([]*models.BlogCategory, error)

	AssignProducts(ctx context.Context, blogID int64, productIDs []int64) error
	RemoveProducts(ctx context.Context, blogID int64) error
	GetProductIDsByBlogID(ctx context.Context, blogID int64) ([]int64, error)

	AssignTags(ctx context.Context, blogID int64, tagIDs []int64) error
	RemoveTags(ctx context.Context, blogID int64) error
	GetTagIDsByBlogID(ctx context.Context, blogID int64) ([]int64, error)
}

// ── BlogCategory ──────────────────────────────────────────────────────────────

type blogCategoryRepository struct{ db *pgxpool.Pool }

const blogCategoryHierarchyLockKey int64 = 7278134300001

func NewBlogCategoryRepository(db *pgxpool.Pool) BlogCategoryRepository {
	return &blogCategoryRepository{db: db}
}

func (r *blogCategoryRepository) GetByID(ctx context.Context, id int64) (*models.BlogCategory, error) {
	query := `SELECT id, name, description, slug, parent_id, created_at, updated_at
			  FROM blog_categories WHERE id = $1`

	c := &models.BlogCategory{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&c.ID, &c.Name, &c.Description, &c.Slug, &c.ParentID, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("getting blog category: %w", err)
	}
	return c, nil
}

func (r *blogCategoryRepository) GetAll(ctx context.Context) ([]*models.BlogCategory, error) {
	query := `SELECT id, name, description, slug, parent_id, created_at, updated_at
			  FROM blog_categories ORDER BY name ASC`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("querying blog categories: %w", err)
	}
	defer rows.Close()

	var categories []*models.BlogCategory
	for rows.Next() {
		c := &models.BlogCategory{}
		if err := rows.Scan(&c.ID, &c.Name, &c.Description, &c.Slug, &c.ParentID, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scanning blog category: %w", err)
		}
		categories = append(categories, c)
	}
	return categories, rows.Err()
}

func wouldCreateBlogCategoryCycle(ctx context.Context, db blogDB, id, parentID int64) (bool, error) {
	query := `WITH RECURSIVE descendants AS (
		SELECT id FROM blog_categories WHERE parent_id = $1
		UNION
		SELECT category.id
		FROM blog_categories AS category
		JOIN descendants ON category.parent_id = descendants.id
	)
	SELECT EXISTS(SELECT 1 FROM descendants WHERE id = $2)`
	var cycle bool
	if err := db.QueryRow(ctx, query, id, parentID).Scan(&cycle); err != nil {
		return false, fmt.Errorf("checking blog category hierarchy: %w", err)
	}
	return cycle, nil
}

func (r *blogCategoryRepository) Create(ctx context.Context, req *models.BlogCategoryReq) (*models.BlogCategory, error) {
	query := `INSERT INTO blog_categories (name, description, slug, parent_id)
			  VALUES ($1, $2, $3, $4)
			  RETURNING id, name, description, slug, parent_id, created_at, updated_at`

	c := &models.BlogCategory{}
	err := r.db.QueryRow(ctx, query, req.Name, req.Description, req.Slug, req.ParentID).Scan(
		&c.ID, &c.Name, &c.Description, &c.Slug, &c.ParentID, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, blogConstraintError("creating blog category", err)
	}
	return c, nil
}

func (r *blogCategoryRepository) Update(ctx context.Context, id int64, req *models.BlogCategoryUpdateReq) (*models.BlogCategory, error) {
	if !req.ParentID.Set {
		return updateBlogCategory(ctx, r.db, id, req)
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("updating blog category: begin hierarchy transaction: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, blogCategoryHierarchyLockKey); err != nil {
		return nil, fmt.Errorf("updating blog category: lock hierarchy: %w", err)
	}
	if req.ParentID.Value != nil {
		cycle, cycleErr := wouldCreateBlogCategoryCycle(ctx, tx, id, *req.ParentID.Value)
		if cycleErr != nil {
			return nil, cycleErr
		}
		if cycle {
			return nil, models.ErrHierarchyCycle
		}
	}
	category, err := updateBlogCategory(ctx, tx, id, req)
	if err != nil {
		return nil, err
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("updating blog category: commit hierarchy transaction: %w", err)
	}
	return category, nil
}

func updateBlogCategory(ctx context.Context, db blogDB, id int64, req *models.BlogCategoryUpdateReq) (*models.BlogCategory, error) {
	sets := []string{"updated_at = NOW()"}
	args := pgx.NamedArgs{"id": id}
	if req.Name != nil {
		sets = append(sets, "name = @name")
		args["name"] = *req.Name
	}
	if req.Description.Set {
		sets = append(sets, "description = @description")
		args["description"] = nullableArg(req.Description.Value)
	}
	if req.Slug.Set {
		sets = append(sets, "slug = @slug")
		args["slug"] = nullableArg(req.Slug.Value)
	}
	if req.ParentID.Set {
		sets = append(sets, "parent_id = @parent_id")
		args["parent_id"] = nullableArg(req.ParentID.Value)
	}

	query := fmt.Sprintf(`UPDATE blog_categories
		SET %s
		WHERE id = @id
		RETURNING id, name, description, slug, parent_id, created_at, updated_at`,
		strings.Join(sets, ", "),
	)

	c := &models.BlogCategory{}
	err := db.QueryRow(ctx, query, args).Scan(
		&c.ID, &c.Name, &c.Description, &c.Slug, &c.ParentID, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, blogConstraintError("updating blog category", err)
	}
	return c, nil
}

func (r *blogCategoryRepository) Delete(ctx context.Context, id int64) error {
	ct, err := r.db.Exec(ctx, `DELETE FROM blog_categories WHERE id = $1`, id)
	if err != nil {
		return blogConstraintError("deleting blog category", err)
	}
	if ct.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}

// ── Blog ──────────────────────────────────────────────────────────────────────

type blogDB interface {
	Exec(context.Context, string, ...any) (pgconn.CommandTag, error)
	Query(context.Context, string, ...any) (pgx.Rows, error)
	QueryRow(context.Context, string, ...any) pgx.Row
	SendBatch(context.Context, *pgx.Batch) pgx.BatchResults
}

type blogRepository struct{ db blogDB }

func NewBlogRepository(db *pgxpool.Pool) BlogRepository {
	return &blogRepository{db: db}
}

func (r *blogRepository) WithTx(tx pgx.Tx) BlogRepository {
	return &blogRepository{db: tx}
}

const blogColumns = `id, author_id, title, slug, content, excerpt, image_url, image_alt, time_to_read,
					  total_reads, status, is_featured, meta_title, meta_description,
					  published_at, created_at, updated_at`

// blogScanDest returns the column→field pointer mapping in blogColumns order so
// scanning is defined once and reused by every read path.
func blogScanDest(b *models.Blog) []any {
	return []any{
		&b.ID, &b.AuthorID, &b.Title, &b.Slug, &b.Content,
		&b.Excerpt, &b.ImageURL, &b.ImageAlt, &b.TimeToRead, &b.TotalReads,
		&b.Status, &b.IsFeatured, &b.MetaTitle, &b.MetaDescription,
		&b.PublishedAt, &b.CreatedAt, &b.UpdatedAt,
	}
}

func scanBlog(row pgx.Row, b *models.Blog) error {
	return row.Scan(blogScanDest(b)...)
}

func (r *blogRepository) GetByID(ctx context.Context, id int64) (*models.Blog, error) {
	query := `SELECT ` + blogColumns + ` FROM blogs WHERE id = $1 AND deleted_at IS NULL`

	b := &models.Blog{}
	if err := scanBlog(r.db.QueryRow(ctx, query, id), b); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("getting blog: %w", err)
	}
	return b, nil
}

func (r *blogRepository) GetBySlug(ctx context.Context, slug string) (*models.Blog, error) {
	query := `SELECT ` + blogColumns + ` FROM blogs WHERE slug = $1 AND deleted_at IS NULL`

	b := &models.Blog{}
	if err := scanBlog(r.db.QueryRow(ctx, query, slug), b); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("getting blog by slug: %w", err)
	}
	return b, nil
}

// GetPublishedBySlug restricts to published posts — the public storefront read.
func (r *blogRepository) GetPublishedBySlug(ctx context.Context, slug string) (*models.Blog, error) {
	query := `SELECT ` + blogColumns + ` FROM blogs
			  WHERE slug = $1 AND status = 'published' AND deleted_at IS NULL`

	b := &models.Blog{}
	if err := scanBlog(r.db.QueryRow(ctx, query, slug), b); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("getting published blog by slug: %w", err)
	}
	return b, nil
}

func (r *blogRepository) GetAll(ctx context.Context) ([]*models.Blog, error) {
	query := `SELECT ` + blogColumns + ` FROM blogs WHERE deleted_at IS NULL ORDER BY created_at DESC`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("querying blogs: %w", err)
	}
	defer rows.Close()

	var blogs []*models.Blog
	for rows.Next() {
		b := &models.Blog{}
		if err := rows.Scan(blogScanDest(b)...); err != nil {
			return nil, fmt.Errorf("scanning blog: %w", err)
		}
		blogs = append(blogs, b)
	}
	return blogs, rows.Err()
}

// List returns a paginated, filtered slice of blogs plus the total count
// (COUNT(*) OVER()). The public listing forces status='published'; admins may
// pass any status (or none). Mirrors the recipe list.
func (r *blogRepository) List(ctx context.Context, f models.BlogFilter) ([]*models.Blog, int64, error) {
	where := []string{"b.deleted_at IS NULL"}
	args := pgx.NamedArgs{}

	if f.Search != "" {
		where = append(where, `(b.title ILIKE @search ESCAPE E'\\' OR b.excerpt ILIKE @search ESCAPE E'\\')`)
		args["search"] = "%" + escapeLikePattern(f.Search) + "%"
	}
	if f.Status != nil {
		where = append(where, "b.status = @status")
		args["status"] = string(*f.Status)
	}
	if f.IsFeatured != nil {
		where = append(where, "b.is_featured = @is_featured")
		args["is_featured"] = *f.IsFeatured
	}
	if f.CategoryID != nil {
		where = append(where, `EXISTS (
			SELECT 1 FROM blog_categories_assignments bca
			WHERE bca.blog_id = b.id AND bca.blog_category_id = @category_id
		)`)
		args["category_id"] = *f.CategoryID
	}
	if f.ExcludeID != nil {
		where = append(where, "b.id <> @exclude_id")
		args["exclude_id"] = *f.ExcludeID
	}

	allowed := map[string]string{
		"published_at": "b.published_at",
		"created_at":   "b.created_at",
		"updated_at":   "b.updated_at",
		"title":        "b.title",
		"total_reads":  "b.total_reads",
	}
	sortBy := "b.published_at"
	if col, ok := allowed[f.SortBy]; ok {
		sortBy = col
	}
	order := "DESC"
	if strings.ToUpper(f.OrderBy) == "ASC" {
		order = "ASC"
	}

	countArgs := pgx.NamedArgs{}
	for key, value := range args {
		countArgs[key] = value
	}
	args["limit"] = f.Limit
	args["offset"] = f.Offset()

	// NULLS LAST keeps draft posts (no published_at) from floating to the top when
	// sorting by published_at.
	q := fmt.Sprintf(`
		SELECT `+blogColumns+`, COUNT(*) OVER() AS total_count
		FROM blogs b
		WHERE %s
		ORDER BY %s %s NULLS LAST, b.id DESC
		LIMIT @limit OFFSET @offset`,
		strings.Join(where, " AND "), sortBy, order,
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, 0, fmt.Errorf("listing blogs: %w", err)
	}
	defer rows.Close()

	var (
		blogs []*models.Blog
		total int64
	)
	for rows.Next() {
		b := &models.Blog{}
		dest := append(blogScanDest(b), &total)
		if err := rows.Scan(dest...); err != nil {
			return nil, 0, fmt.Errorf("scanning blog: %w", err)
		}
		blogs = append(blogs, b)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	if len(blogs) == 0 && f.Offset() > 0 {
		rows.Close()
		countQuery := fmt.Sprintf(
			"SELECT COUNT(*) FROM blogs b WHERE %s",
			strings.Join(where, " AND "),
		)
		if err := r.db.QueryRow(ctx, countQuery, countArgs).Scan(&total); err != nil {
			return nil, 0, fmt.Errorf("counting blogs beyond final page: %w", err)
		}
	}
	return blogs, total, nil
}

func (r *blogRepository) Create(ctx context.Context, req *models.BlogReq) (*models.Blog, error) {
	query := `INSERT INTO blogs
			  (author_id, title, slug, content, excerpt, image_url, image_alt, time_to_read,
			   status, is_featured, meta_title, meta_description, published_at)
			  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
			  RETURNING ` + blogColumns

	b := &models.Blog{}
	if err := scanBlog(r.db.QueryRow(ctx, query,
		req.AuthorID, req.Title, req.Slug, req.Content,
		req.Excerpt, req.ImageURL, req.ImageAlt, req.TimeToRead,
		req.Status, req.IsFeatured, req.MetaTitle,
		req.MetaDescription, req.PublishedAt,
	), b); err != nil {
		return nil, blogConstraintError("creating blog", err)
	}
	return b, nil
}

func (r *blogRepository) Update(ctx context.Context, id int64, req *models.BlogUpdateReq) (*models.Blog, error) {
	sets := []string{"updated_at = NOW()"}
	args := pgx.NamedArgs{"id": id}
	add := func(column string, value any) {
		sets = append(sets, fmt.Sprintf("%s = @%s", column, column))
		args[column] = value
	}

	if req.Title != nil {
		add("title", *req.Title)
	}
	if req.Slug != nil {
		add("slug", *req.Slug)
	}
	if req.Content != nil {
		add("content", *req.Content)
	}
	if req.Excerpt.Set {
		add("excerpt", nullableArg(req.Excerpt.Value))
	}
	if req.ImageURL.Set {
		sets = append(sets,
			"image_storage_key = CASE WHEN image_url IS DISTINCT FROM @image_url THEN NULL ELSE image_storage_key END",
		)
		add("image_url", req.ImageURL.Value)
	}
	if req.ImageAlt.Set {
		add("image_alt", req.ImageAlt.Value)
	}
	if req.TimeToRead != nil {
		add("time_to_read", *req.TimeToRead)
	}
	if req.Status != nil {
		add("status", string(*req.Status))
	}
	if req.IsFeatured != nil {
		add("is_featured", *req.IsFeatured)
	}
	if req.MetaTitle.Set {
		add("meta_title", nullableArg(req.MetaTitle.Value))
	}
	if req.MetaDescription.Set {
		add("meta_description", nullableArg(req.MetaDescription.Value))
	}
	if req.PublishedAt.Set {
		add("published_at", nullableArg(req.PublishedAt.Value))
	}

	where := "id = @id AND deleted_at IS NULL"
	if req.ExpectedImageURL.Set {
		where += " AND image_url IS NOT DISTINCT FROM @expected_image_url"
		args["expected_image_url"] = req.ExpectedImageURL.Value
	}
	query := fmt.Sprintf(
		`UPDATE blogs SET %s WHERE %s RETURNING `+blogColumns,
		strings.Join(sets, ", "), where,
	)

	b := &models.Blog{}
	if err := scanBlog(r.db.QueryRow(ctx, query, args), b); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			if req.ExpectedImageURL.Set {
				return nil, models.ErrConflict
			}
			return nil, models.ErrNotFound
		}
		return nil, blogConstraintError("updating blog", err)
	}
	return b, nil
}

func (r *blogRepository) SoftDelete(ctx context.Context, id int64) error {
	ct, err := r.db.Exec(ctx,
		`UPDATE blogs
		 SET deleted_at = NOW(), image_url = NULL, image_storage_key = NULL
		 WHERE id = $1 AND deleted_at IS NULL`, id,
	)
	if err != nil {
		return fmt.Errorf("soft deleting blog: %w", err)
	}
	if ct.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}

func (r *blogRepository) IncrementReads(ctx context.Context, id int64) error {
	_, err := r.db.Exec(ctx,
		`UPDATE blogs SET total_reads = total_reads + 1 WHERE id = $1 AND deleted_at IS NULL`, id,
	)
	if err != nil {
		return fmt.Errorf("incrementing blog reads: %w", err)
	}
	return nil
}

// SlugExists reports whether any row owns the globally unique slug. Soft-deleted
// posts still reserve their slug, matching the database constraint.
func (r *blogRepository) SlugExists(ctx context.Context, slug string) (bool, error) {
	var exists bool
	if err := r.db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM blogs WHERE slug = $1)`, slug,
	).Scan(&exists); err != nil {
		return false, fmt.Errorf("checking blog slug: %w", err)
	}
	return exists, nil
}

// ── Relations ─────────────────────────────────────────────────────────────────

func (r *blogRepository) AssignCategories(ctx context.Context, blogID int64, categoryIDs []int64) error {
	if len(categoryIDs) == 0 {
		return nil
	}
	batch := &pgx.Batch{}
	for _, cid := range categoryIDs {
		batch.Queue(
			`INSERT INTO blog_categories_assignments (blog_id, blog_category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
			blogID, cid,
		)
	}
	br := r.db.SendBatch(ctx, batch)
	defer br.Close()
	for range categoryIDs {
		if _, err := br.Exec(); err != nil {
			return blogConstraintError("assigning category", err)
		}
	}
	return nil
}

func (r *blogRepository) RemoveCategories(ctx context.Context, blogID int64) error {
	_, err := r.db.Exec(ctx, `DELETE FROM blog_categories_assignments WHERE blog_id = $1`, blogID)
	return err
}

func (r *blogRepository) GetCategoriesByBlogID(ctx context.Context, blogID int64) ([]*models.BlogCategory, error) {
	query := `SELECT bc.id, bc.name, bc.description, bc.slug, bc.parent_id, bc.created_at, bc.updated_at
			  FROM blog_categories bc
			  JOIN blog_categories_assignments bca ON bca.blog_category_id = bc.id
			  WHERE bca.blog_id = $1`

	rows, err := r.db.Query(ctx, query, blogID)
	if err != nil {
		return nil, fmt.Errorf("querying blog categories: %w", err)
	}
	defer rows.Close()

	var categories []*models.BlogCategory
	for rows.Next() {
		c := &models.BlogCategory{}
		if err := rows.Scan(&c.ID, &c.Name, &c.Description, &c.Slug, &c.ParentID, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scanning blog category: %w", err)
		}
		categories = append(categories, c)
	}
	return categories, rows.Err()
}

func (r *blogRepository) AssignProducts(ctx context.Context, blogID int64, productIDs []int64) error {
	if len(productIDs) == 0 {
		return nil
	}
	batch := &pgx.Batch{}
	for _, pid := range productIDs {
		batch.Queue(
			`INSERT INTO blog_products (blog_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
			blogID, pid,
		)
	}
	br := r.db.SendBatch(ctx, batch)
	defer br.Close()
	for range productIDs {
		if _, err := br.Exec(); err != nil {
			return blogConstraintError("assigning product", err)
		}
	}
	return nil
}

func (r *blogRepository) RemoveProducts(ctx context.Context, blogID int64) error {
	_, err := r.db.Exec(ctx, `DELETE FROM blog_products WHERE blog_id = $1`, blogID)
	return err
}

func (r *blogRepository) GetProductIDsByBlogID(ctx context.Context, blogID int64) ([]int64, error) {
	rows, err := r.db.Query(ctx, `SELECT product_id FROM blog_products WHERE blog_id = $1`, blogID)
	if err != nil {
		return nil, fmt.Errorf("querying blog products: %w", err)
	}
	defer rows.Close()

	ids := make([]int64, 0)
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scanning product id: %w", err)
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func (r *blogRepository) AssignTags(ctx context.Context, blogID int64, tagIDs []int64) error {
	if len(tagIDs) == 0 {
		return nil
	}
	batch := &pgx.Batch{}
	for _, tid := range tagIDs {
		batch.Queue(
			`INSERT INTO blog_tags (blog_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
			blogID, tid,
		)
	}
	br := r.db.SendBatch(ctx, batch)
	defer br.Close()
	for range tagIDs {
		if _, err := br.Exec(); err != nil {
			return blogConstraintError("assigning tag", err)
		}
	}
	return nil
}

func (r *blogRepository) RemoveTags(ctx context.Context, blogID int64) error {
	_, err := r.db.Exec(ctx, `DELETE FROM blog_tags WHERE blog_id = $1`, blogID)
	return err
}

func (r *blogRepository) GetTagIDsByBlogID(ctx context.Context, blogID int64) ([]int64, error) {
	rows, err := r.db.Query(ctx, `SELECT tag_id FROM blog_tags WHERE blog_id = $1`, blogID)
	if err != nil {
		return nil, fmt.Errorf("querying blog tags: %w", err)
	}
	defer rows.Close()

	ids := make([]int64, 0)
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scanning tag id: %w", err)
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func blogConstraintError(operation string, err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505", "23503", "23514":
			return fmt.Errorf("%s: %w", operation, models.ErrConflict)
		}
	}
	return fmt.Errorf("%s: %w", operation, err)
}

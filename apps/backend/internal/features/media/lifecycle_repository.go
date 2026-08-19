package media

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"

	"github.com/jackc/pgx/v5/pgxpool"
)

// LifecycleRepository provides the database side of safe local-media
// cleanup. URL references are included alongside explicit storage-key columns so
// legacy/shared media is never deleted while a live row still points at it.
type LifecycleRepository interface {
	IsReferenced(ctx context.Context, key string) (bool, error)
	ReferencedKeys(ctx context.Context) ([]string, error)
	ProductKeys(ctx context.Context, productID int64) ([]string, error)
	VariantKeys(ctx context.Context, variantID int64) ([]string, error)
	LockMediaKeys(ctx context.Context, keys []string) (KeyLock, error)
	TryReconciliationLock(ctx context.Context) (ReconciliationLock, bool, error)
}

type ReconciliationLock interface {
	Release(ctx context.Context) error
}

type KeyLock interface {
	Release(ctx context.Context) error
}

type mediaLifecycleRepository struct {
	db            *pgxpool.Pool
	mediaKeySlots chan struct{}
}

func NewLifecycleRepository(db *pgxpool.Pool) LifecycleRepository {
	// Every session advisory lock pins one connection while its protected work
	// uses another. Bound holders to half the pool so lock contention can never
	// consume every connection and deadlock the operations that release the locks.
	maxConns := int(db.Config().MaxConns)
	lockSlots := maxConns / 2
	if lockSlots < 1 && maxConns > 1 {
		lockSlots = 1
	}
	return &mediaLifecycleRepository{
		db:            db,
		mediaKeySlots: make(chan struct{}, lockSlots),
	}
}

const mediaReferencesCTE = `
	WITH media_references(key) AS (
		SELECT storage_key FROM product_images WHERE storage_key IS NOT NULL
		UNION ALL SELECT substr(image_url, 8) FROM product_images WHERE left(image_url, 7) = '/media/'
		UNION ALL SELECT image_storage_key FROM hero_slides WHERE image_storage_key IS NOT NULL
		UNION ALL SELECT substr(image_url, 8) FROM hero_slides WHERE left(image_url, 7) = '/media/'
		UNION ALL SELECT mobile_image_storage_key FROM hero_slides WHERE mobile_image_storage_key IS NOT NULL
		UNION ALL SELECT substr(mobile_image_url, 8) FROM hero_slides WHERE left(mobile_image_url, 7) = '/media/'
		UNION ALL SELECT image_storage_key FROM recipes WHERE image_storage_key IS NOT NULL
		UNION ALL SELECT substr(image_url, 8) FROM recipes WHERE left(image_url, 7) = '/media/'
		UNION ALL SELECT og_image_storage_key FROM recipes WHERE og_image_storage_key IS NOT NULL
		UNION ALL SELECT substr(og_image_url, 8) FROM recipes WHERE left(og_image_url, 7) = '/media/'
		UNION ALL SELECT image_storage_key FROM blogs WHERE deleted_at IS NULL AND image_storage_key IS NOT NULL
		UNION ALL SELECT substr(image_url, 8) FROM blogs WHERE deleted_at IS NULL AND left(image_url, 7) = '/media/'
		UNION ALL SELECT og_image_storage_key FROM blogs WHERE deleted_at IS NULL AND og_image_storage_key IS NOT NULL
		UNION ALL SELECT substr(og_image_url, 8) FROM blogs WHERE deleted_at IS NULL AND left(og_image_url, 7) = '/media/'
		-- CE-4/CE-10: images embedded in an editorial body are referenced only by
		-- the HTML itself. Without these two the reconcile job would treat every
		-- in-body image as an orphan and delete it. The pattern stops at ? and &
		-- so a pasted transform URL (/media/key?w=800) still names the real key.
		UNION ALL SELECT (regexp_matches(content, '/media/([^"''\s<>)?&]+)', 'g'))[1] FROM recipes
		UNION ALL SELECT (regexp_matches(content, '/media/([^"''\s<>)?&]+)', 'g'))[1] FROM blogs
			WHERE deleted_at IS NULL
		UNION ALL SELECT substr(image_url, 8) FROM categories WHERE left(image_url, 7) = '/media/'
		UNION ALL SELECT substr(image_url, 8) FROM brands WHERE left(image_url, 7) = '/media/'
		UNION ALL SELECT substr(image_url, 8) FROM review_images WHERE left(image_url, 7) = '/media/'
		UNION ALL SELECT substr(settings #>> '{store,logoUrl}', 8) FROM site_settings
			WHERE left(settings #>> '{store,logoUrl}', 7) = '/media/'
		UNION ALL SELECT substr(settings #>> '{seo,ogImage}', 8) FROM site_settings
			WHERE left(settings #>> '{seo,ogImage}', 7) = '/media/'
	)
`

func (r *mediaLifecycleRepository) IsReferenced(ctx context.Context, key string) (bool, error) {
	var referenced bool
	if err := r.db.QueryRow(ctx, mediaReferencesCTE+`
		SELECT EXISTS(SELECT 1 FROM media_references WHERE key = $1)`, key,
	).Scan(&referenced); err != nil {
		return false, fmt.Errorf("media lifecycle: check reference: %w", err)
	}
	return referenced, nil
}

func (r *mediaLifecycleRepository) ReferencedKeys(ctx context.Context) ([]string, error) {
	rows, err := r.db.Query(ctx, mediaReferencesCTE+`
		SELECT DISTINCT key FROM media_references WHERE key IS NOT NULL ORDER BY key`)
	if err != nil {
		return nil, fmt.Errorf("media lifecycle: list references: %w", err)
	}
	defer rows.Close()

	keys := make([]string, 0)
	for rows.Next() {
		var key string
		if err := rows.Scan(&key); err != nil {
			return nil, fmt.Errorf("media lifecycle: scan reference: %w", err)
		}
		keys = append(keys, key)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("media lifecycle: iterate references: %w", err)
	}
	return keys, nil
}

func (r *mediaLifecycleRepository) ProductKeys(ctx context.Context, productID int64) ([]string, error) {
	return r.ownerKeys(ctx, `
		SELECT pi.storage_key, pi.image_url
		FROM product_images pi
		LEFT JOIN product_variants pv ON pv.id = pi.product_variant_id
		WHERE pi.product_id = $1 OR pv.product_id = $1`, productID)
}

func (r *mediaLifecycleRepository) VariantKeys(ctx context.Context, variantID int64) ([]string, error) {
	return r.ownerKeys(ctx, `
		SELECT storage_key, image_url
		FROM product_images
		WHERE product_variant_id = $1`, variantID)
}

func (r *mediaLifecycleRepository) ownerKeys(ctx context.Context, sourceQuery string, ownerID int64) ([]string, error) {
	query := `WITH owner_media(storage_key, image_url) AS (` + sourceQuery + `), owner_keys(key) AS (
		SELECT storage_key FROM owner_media WHERE storage_key IS NOT NULL
		UNION
		SELECT substr(image_url, 8) FROM owner_media WHERE left(image_url, 7) = '/media/'
	)
	SELECT DISTINCT key FROM owner_keys WHERE key IS NOT NULL ORDER BY key`
	rows, err := r.db.Query(ctx, query, ownerID)
	if err != nil {
		return nil, fmt.Errorf("media lifecycle: list owner keys: %w", err)
	}
	defer rows.Close()

	keys := make([]string, 0)
	for rows.Next() {
		var key string
		if err := rows.Scan(&key); err != nil {
			return nil, fmt.Errorf("media lifecycle: scan owner key: %w", err)
		}
		keys = append(keys, key)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("media lifecycle: iterate owner keys: %w", err)
	}
	return keys, nil
}

const mediaReconciliationLockName = "rumera:media-reconciliation:v1"

func (r *mediaLifecycleRepository) LockMediaKeys(ctx context.Context, keys []string) (KeyLock, error) {
	names := make([]string, 0, len(keys))
	seen := make(map[string]struct{}, len(keys))
	for _, key := range keys {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		name := "rumera:media-key:v1:" + key
		if _, exists := seen[name]; exists {
			continue
		}
		seen[name] = struct{}{}
		names = append(names, name)
	}
	sort.Strings(names)
	if len(names) == 0 {
		return noopMediaKeyLock{}, nil
	}
	if cap(r.mediaKeySlots) == 0 {
		return nil, fmt.Errorf("media lifecycle: media-key locking requires at least two database connections")
	}
	select {
	case r.mediaKeySlots <- struct{}{}:
	case <-ctx.Done():
		return nil, fmt.Errorf("media lifecycle: wait for media-key lock slot: %w", ctx.Err())
	}
	releaseSlot := func() { <-r.mediaKeySlots }

	conn, err := r.db.Acquire(ctx)
	if err != nil {
		releaseSlot()
		return nil, fmt.Errorf("media lifecycle: acquire media-key connection: %w", err)
	}
	for _, name := range names {
		if _, err := conn.Exec(ctx,
			`SELECT pg_advisory_lock(hashtextextended($1, 0))`, name,
		); err != nil {
			raw := conn.Hijack()
			_ = raw.Close(context.Background())
			releaseSlot()
			return nil, fmt.Errorf("media lifecycle: acquire media-key lock: %w", err)
		}
	}
	return &mediaKeySessionLock{conn: conn, names: names, releaseSlot: releaseSlot}, nil
}

func (r *mediaLifecycleRepository) TryReconciliationLock(ctx context.Context) (ReconciliationLock, bool, error) {
	conn, err := r.db.Acquire(ctx)
	if err != nil {
		return nil, false, fmt.Errorf("media lifecycle: acquire reconciliation connection: %w", err)
	}
	var acquired bool
	if err := conn.QueryRow(ctx,
		`SELECT pg_try_advisory_lock(hashtextextended($1, 0))`, mediaReconciliationLockName,
	).Scan(&acquired); err != nil {
		conn.Release()
		return nil, false, fmt.Errorf("media lifecycle: acquire reconciliation lock: %w", err)
	}
	if !acquired {
		conn.Release()
		return nil, false, nil
	}
	return &mediaReconciliationSessionLock{conn: conn}, true, nil
}

type mediaReconciliationSessionLock struct {
	mu       sync.Mutex
	conn     *pgxpool.Conn
	released bool
}

type mediaKeySessionLock struct {
	mu          sync.Mutex
	conn        *pgxpool.Conn
	names       []string
	releaseSlot func()
	released    bool
}

type noopMediaKeyLock struct{}

func (noopMediaKeyLock) Release(context.Context) error { return nil }

func (l *mediaKeySessionLock) Release(ctx context.Context) error {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.released {
		return nil
	}
	l.released = true
	defer func() {
		if l.releaseSlot != nil {
			l.releaseSlot()
			l.releaseSlot = nil
		}
	}()

	for i := len(l.names) - 1; i >= 0; i-- {
		var unlocked bool
		if err := l.conn.QueryRow(ctx,
			`SELECT pg_advisory_unlock(hashtextextended($1, 0))`, l.names[i],
		).Scan(&unlocked); err != nil || !unlocked {
			raw := l.conn.Hijack()
			closeErr := raw.Close(context.Background())
			if err != nil {
				return fmt.Errorf("media lifecycle: release media-key lock: %w", err)
			}
			if closeErr != nil {
				return fmt.Errorf("media lifecycle: close media-key connection: %w", closeErr)
			}
			return fmt.Errorf("media lifecycle: media-key lock was not held")
		}
	}
	l.conn.Release()
	return nil
}

func (l *mediaReconciliationSessionLock) Release(ctx context.Context) error {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.released {
		return nil
	}
	l.released = true

	var unlocked bool
	if err := l.conn.QueryRow(ctx,
		`SELECT pg_advisory_unlock(hashtextextended($1, 0))`, mediaReconciliationLockName,
	).Scan(&unlocked); err != nil || !unlocked {
		raw := l.conn.Hijack()
		closeErr := raw.Close(ctx)
		if err != nil {
			return fmt.Errorf("media lifecycle: release reconciliation lock: %w", err)
		}
		if closeErr != nil {
			return fmt.Errorf("media lifecycle: close locked connection: %w", closeErr)
		}
		return fmt.Errorf("media lifecycle: reconciliation lock was not held")
	}
	l.conn.Release()
	return nil
}

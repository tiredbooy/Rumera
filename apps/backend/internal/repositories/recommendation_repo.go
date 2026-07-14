package repositories

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
)

// RecommendationRepository is the data engine behind product recommendations.
// Everything is computed against the live catalogue in the main DB so results
// always reflect real prices, availability, and relationships.
type RecommendationRepository interface {
	RecordInteraction(ctx context.Context, userID int64, req *models.InteractionReq, weight float64) error

	Trending(ctx context.Context, q models.RecommendationQuery) ([]*models.RecommendationItem, error)
	Similar(ctx context.Context, productID int64, q models.RecommendationQuery) ([]*models.RecommendationItem, error)
	FrequentlyBoughtTogether(ctx context.Context, productID int64, q models.RecommendationQuery) ([]*models.RecommendationItem, error)
	ForUser(ctx context.Context, profile *models.UserRecommendationProfile, excludeIDs []int64, q models.RecommendationQuery) ([]*models.RecommendationItem, error)

	GetProfile(ctx context.Context, userID int64) (*models.UserRecommendationProfile, error)
	ComputeProfile(ctx context.Context, userID int64) (*models.UserRecommendationProfile, error)
	PurchasedProductIDs(ctx context.Context, userID int64) ([]int64, error)

	// ActiveUserIDs returns the IDs of users who produced a fresh signal — an
	// interaction or a non-cancelled order — within the last sinceDays, most
	// recently active first, capped at limit. It drives the nightly profile
	// refresh so personalization stays warm without recomputing every user.
	ActiveUserIDs(ctx context.Context, sinceDays, limit int) ([]int64, error)
}

type recommendationRepository struct{ db *pgxpool.Pool }

func NewRecommendationRepository(db *pgxpool.Pool) RecommendationRepository {
	return &recommendationRepository{db: db}
}

// cardColumns is the standard product-card projection shared by every strategy.
// It always selects price band and a primary image via lateral joins.
const cardColumns = `
	p.id, p.title, p.slug, p.brand_id, b.title AS brand, p.category_id,
	COALESCE(pr.min_price, 0) AS min_price,
	COALESCE(pr.max_price, 0) AS max_price,
	img.image_url`

const cardJoins = `
	LEFT JOIN brands b ON b.id = p.brand_id
	LEFT JOIN LATERAL (
		SELECT MIN(price) AS min_price, MAX(price) AS max_price
		FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active
	) pr ON TRUE
	LEFT JOIN LATERAL (
		SELECT image_url FROM product_images pi
		WHERE pi.product_id = p.id
		ORDER BY pi.is_primary DESC, pi.sort_order ASC
		LIMIT 1
	) img ON TRUE`

// scanCards reads the cardColumns projection plus a trailing score column.
func scanCards(rows pgx.Rows) ([]*models.RecommendationItem, error) {
	defer rows.Close()
	var items []*models.RecommendationItem
	for rows.Next() {
		it := &models.RecommendationItem{}
		if err := rows.Scan(
			&it.ProductID, &it.Title, &it.Slug, &it.BrandID, &it.Brand, &it.CategoryID,
			&it.MinPrice, &it.MaxPrice, &it.ImageURL, &it.Score,
		); err != nil {
			return nil, fmt.Errorf("scanning recommendation card: %w", err)
		}
		items = append(items, it)
	}
	return items, rows.Err()
}

// ── Interactions ────────────────────────────────────────────────────────────────

func (r *recommendationRepository) RecordInteraction(ctx context.Context, userID int64, req *models.InteractionReq, weight float64) error {
	metadata := req.Metadata
	if metadata == nil {
		metadata = map[string]any{}
	}
	_, err := r.db.Exec(ctx,
		`INSERT INTO user_product_interactions
		 (user_id, product_id, interaction_type, weight, source, metadata)
		 VALUES ($1,$2,$3,$4,$5,$6)`,
		userID, req.ProductID, string(req.InteractionType), weight, req.Source, metadata,
	)
	if err != nil {
		return fmt.Errorf("recording interaction: %w", err)
	}
	return nil
}

func (r *recommendationRepository) PurchasedProductIDs(ctx context.Context, userID int64) ([]int64, error) {
	rows, err := r.db.Query(ctx,
		`SELECT DISTINCT oi.product_id
		 FROM order_items oi JOIN orders o ON o.id = oi.order_id
		 WHERE o.user_id = $1
		   AND o.status IN ('paid','processing','ready_to_ship','shipped','out_for_delivery','delivered','refund_requested','refund_approved','partially_refunded')`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("querying purchased products: %w", err)
	}
	defer rows.Close()

	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scanning purchased product id: %w", err)
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// ActiveUserIDs returns recently-active user IDs (interaction or order within
// the window), ordered by most-recent activity, for the nightly profile refresh.
func (r *recommendationRepository) ActiveUserIDs(ctx context.Context, sinceDays, limit int) ([]int64, error) {
	if sinceDays <= 0 {
		sinceDays = 30
	}
	if limit <= 0 {
		limit = 5000
	}
	rows, err := r.db.Query(ctx,
		`SELECT user_id FROM (
			SELECT user_id, MAX(created_at) AS last_active FROM (
				SELECT user_id, created_at
				FROM user_product_interactions
				WHERE created_at >= NOW() - make_interval(days => $1)
				UNION ALL
				SELECT user_id, created_at
				FROM orders
				WHERE created_at >= NOW() - make_interval(days => $1)
				  AND status IN ('paid','processing','ready_to_ship','shipped','out_for_delivery','delivered','refund_requested','refund_approved','partially_refunded')
				  AND user_id IS NOT NULL
			) activity
			GROUP BY user_id
		) ranked
		ORDER BY last_active DESC
		LIMIT $2`,
		sinceDays, limit,
	)
	if err != nil {
		return nil, fmt.Errorf("querying active user ids: %w", err)
	}
	defer rows.Close()

	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scanning active user id: %w", err)
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// ── Trending ────────────────────────────────────────────────────────────────────

// Trending blends recent first-party interactions with recent order volume, and
// LEFT JOINs the catalogue so it degrades gracefully to newest-active products
// when there is no signal yet (cold start).
func (r *recommendationRepository) Trending(ctx context.Context, q models.RecommendationQuery) ([]*models.RecommendationItem, error) {
	args := pgx.NamedArgs{"window": q.WindowDays, "limit": q.Limit}
	catFilter := ""
	if q.CategoryID != nil {
		catFilter = "AND p.category_id = @category_id"
		args["category_id"] = *q.CategoryID
	}

	query := fmt.Sprintf(`
		WITH deduped_interactions AS (
			SELECT DISTINCT ON (user_id, product_id, interaction_type, created_at::date)
				user_id, product_id, interaction_type, weight, created_at
			FROM user_product_interactions
			WHERE created_at >= NOW() - make_interval(days => @window)
			ORDER BY user_id, product_id, interaction_type, created_at::date, created_at DESC
		),
		signals AS (
			SELECT product_id, SUM(weight) AS s
			FROM deduped_interactions
			GROUP BY product_id
			UNION ALL
			SELECT oi.product_id, SUM(oi.quantity) * 10.0 AS s
			FROM order_items oi JOIN orders o ON o.id = oi.order_id
			WHERE o.created_at >= NOW() - make_interval(days => @window)
			  AND o.status IN ('paid','processing','ready_to_ship','shipped','out_for_delivery','delivered','refund_requested','refund_approved','partially_refunded')
			GROUP BY oi.product_id
		),
		agg AS (SELECT product_id, SUM(s) AS score FROM signals GROUP BY product_id)
		SELECT %s, COALESCE(agg.score, 0) AS score
		FROM products p
		LEFT JOIN agg ON agg.product_id = p.id
		%s
		WHERE p.is_active = TRUE %s
		ORDER BY COALESCE(agg.score, 0) DESC, p.created_at DESC
		LIMIT @limit`,
		cardColumns, cardJoins, catFilter,
	)

	rows, err := r.db.Query(ctx, query, args)
	if err != nil {
		return nil, fmt.Errorf("querying trending: %w", err)
	}
	return scanCards(rows)
}

// ── Similar (content-based) ──────────────────────────────────────────────────────

func (r *recommendationRepository) Similar(ctx context.Context, productID int64, q models.RecommendationQuery) ([]*models.RecommendationItem, error) {
	args := pgx.NamedArgs{"pid": productID, "limit": q.Limit}

	query := fmt.Sprintf(`
		WITH seed AS (SELECT category_id, brand_id FROM products WHERE id = @pid),
		seed_tags AS (SELECT tag_id FROM product_tags WHERE product_id = @pid)
		SELECT %s,
			( CASE WHEN p.category_id = (SELECT category_id FROM seed) THEN 3.0 ELSE 0 END
			+ CASE WHEN p.brand_id    = (SELECT brand_id    FROM seed) THEN 2.0 ELSE 0 END
			+ COALESCE((
				SELECT COUNT(*) FROM product_tags pt
				WHERE pt.product_id = p.id AND pt.tag_id IN (SELECT tag_id FROM seed_tags)
			  ), 0) * 1.0
			) AS score
		FROM products p
		%s
		WHERE p.is_active = TRUE AND p.id <> @pid
		  AND (
			p.category_id = (SELECT category_id FROM seed)
			OR p.brand_id = (SELECT brand_id FROM seed)
			OR EXISTS (
				SELECT 1 FROM product_tags pt
				WHERE pt.product_id = p.id AND pt.tag_id IN (SELECT tag_id FROM seed_tags)
			)
		  )
		ORDER BY score DESC, p.created_at DESC
		LIMIT @limit`,
		cardColumns, cardJoins,
	)

	rows, err := r.db.Query(ctx, query, args)
	if err != nil {
		return nil, fmt.Errorf("querying similar products: %w", err)
	}
	return scanCards(rows)
}

// ── Frequently bought together (order co-occurrence) ─────────────────────────────

func (r *recommendationRepository) FrequentlyBoughtTogether(ctx context.Context, productID int64, q models.RecommendationQuery) ([]*models.RecommendationItem, error) {
	args := pgx.NamedArgs{"pid": productID, "limit": q.Limit}

	query := fmt.Sprintf(`
		WITH fbt AS (
			SELECT oi.product_id, COUNT(DISTINCT o.id)::float8 AS score
			FROM orders o
			JOIN order_items s  ON s.order_id  = o.id AND s.product_id  = @pid
			JOIN order_items oi ON oi.order_id = o.id AND oi.product_id <> @pid
			WHERE o.status IN ('paid','processing','ready_to_ship','shipped','out_for_delivery','delivered','refund_requested','refund_approved','partially_refunded')
			GROUP BY oi.product_id
		)
		SELECT %s, fbt.score
		FROM fbt
		JOIN products p ON p.id = fbt.product_id
		%s
		WHERE p.is_active = TRUE
		ORDER BY fbt.score DESC, p.created_at DESC
		LIMIT @limit`,
		cardColumns, cardJoins,
	)

	rows, err := r.db.Query(ctx, query, args)
	if err != nil {
		return nil, fmt.Errorf("querying frequently bought together: %w", err)
	}
	return scanCards(rows)
}

// ── Personalized (profile-driven) ────────────────────────────────────────────────

func (r *recommendationRepository) ForUser(ctx context.Context, profile *models.UserRecommendationProfile, excludeIDs []int64, q models.RecommendationQuery) ([]*models.RecommendationItem, error) {
	if !profile.HasSignal() {
		return nil, nil
	}

	catIDs, catScores := splitAffinity(profile.TopCategories)
	brandIDs, brandScores := splitAffinity(profile.TopBrands)
	tagIDs, tagScores := splitAffinity(profile.TopTags)
	if excludeIDs == nil {
		excludeIDs = []int64{}
	}

	args := pgx.NamedArgs{
		"cat_ids":      catIDs,
		"cat_scores":   catScores,
		"brand_ids":    brandIDs,
		"brand_scores": brandScores,
		"tag_ids":      tagIDs,
		"tag_scores":   tagScores,
		"exclude":      excludeIDs,
		"limit":        q.Limit,
	}

	query := fmt.Sprintf(`
		WITH cat AS (SELECT * FROM unnest(@cat_ids::bigint[],   @cat_scores::float8[])   AS t(id, score)),
		     brn AS (SELECT * FROM unnest(@brand_ids::bigint[], @brand_scores::float8[]) AS t(id, score)),
		     tg  AS (SELECT * FROM unnest(@tag_ids::bigint[],   @tag_scores::float8[])   AS t(id, score))
		SELECT %s,
			( COALESCE((SELECT score FROM cat WHERE cat.id = p.category_id), 0)
			+ COALESCE((SELECT score FROM brn WHERE brn.id = p.brand_id), 0)
			+ COALESCE((
				SELECT SUM(tg.score) FROM product_tags pt
				JOIN tg ON tg.id = pt.tag_id
				WHERE pt.product_id = p.id
			  ), 0)
			) AS score
		FROM products p
		%s
		WHERE p.is_active = TRUE
		  AND NOT (p.id = ANY(@exclude::bigint[]))
		  AND (
			p.category_id = ANY(@cat_ids::bigint[])
			OR p.brand_id = ANY(@brand_ids::bigint[])
			OR EXISTS (
				SELECT 1 FROM product_tags pt
				WHERE pt.product_id = p.id AND pt.tag_id = ANY(@tag_ids::bigint[])
			)
		  )
		ORDER BY score DESC, p.created_at DESC
		LIMIT @limit`,
		cardColumns, cardJoins,
	)

	rows, err := r.db.Query(ctx, query, args)
	if err != nil {
		return nil, fmt.Errorf("querying personalized recommendations: %w", err)
	}
	return scanCards(rows)
}

func splitAffinity(items []models.AffinityScore) ([]int64, []float64) {
	ids := make([]int64, len(items))
	scores := make([]float64, len(items))
	for i, it := range items {
		ids[i] = it.ID
		scores[i] = it.Score
	}
	return ids, scores
}

// ── Profile ──────────────────────────────────────────────────────────────────────

func (r *recommendationRepository) GetProfile(ctx context.Context, userID int64) (*models.UserRecommendationProfile, error) {
	var (
		p         = &models.UserRecommendationProfile{UserID: userID}
		catsRaw   []byte
		brandsRaw []byte
		tagsRaw   []byte
	)
	err := r.db.QueryRow(ctx,
		`SELECT top_categories, top_brands, top_tags,
		        preferred_price_min, preferred_price_max,
		        engagement_score, last_interaction_at, computed_at
		 FROM user_recommendation_profiles WHERE user_id = $1`, userID,
	).Scan(
		&catsRaw, &brandsRaw, &tagsRaw,
		&p.PreferredPriceMin, &p.PreferredPriceMax,
		&p.EngagementScore, &p.LastInteractionAt, &p.ComputedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("getting recommendation profile: %w", err)
	}

	_ = json.Unmarshal(catsRaw, &p.TopCategories)
	_ = json.Unmarshal(brandsRaw, &p.TopBrands)
	_ = json.Unmarshal(tagsRaw, &p.TopTags)
	return p, nil
}

// ComputeProfile rebuilds a user's affinity profile from their interaction log
// and order history, then upserts it for fast serving.
func (r *recommendationRepository) ComputeProfile(ctx context.Context, userID int64) (*models.UserRecommendationProfile, error) {
	cats, err := r.affinityByCategory(ctx, userID)
	if err != nil {
		return nil, err
	}
	brands, err := r.affinityByBrand(ctx, userID)
	if err != nil {
		return nil, err
	}
	tags, err := r.affinityByTag(ctx, userID)
	if err != nil {
		return nil, err
	}

	var (
		priceMin, priceMax *float64
		engagement         float64
	)

	profile := &models.UserRecommendationProfile{
		UserID:        userID,
		TopCategories: cats,
		TopBrands:     brands,
		TopTags:       tags,
	}

	// Engagement + recency, blending interactions and order history.
	if err := r.db.QueryRow(ctx,
		`SELECT
			COALESCE((SELECT SUM(weight) FROM user_product_interactions WHERE user_id = $1), 0)
			+ COALESCE((
				SELECT SUM(oi.quantity * 10.0)
				FROM order_items oi JOIN orders o ON o.id = oi.order_id
				WHERE o.user_id = $1
				  AND o.status IN ('paid','processing','ready_to_ship','shipped','out_for_delivery','delivered','refund_requested','refund_approved','partially_refunded')
			), 0),
			GREATEST(
				(SELECT MAX(created_at) FROM user_product_interactions WHERE user_id = $1),
				(SELECT MAX(created_at) FROM orders WHERE user_id = $1 AND status IN ('paid','processing','ready_to_ship','shipped','out_for_delivery','delivered','refund_requested','refund_approved','partially_refunded'))
			)`, userID,
	).Scan(&engagement, &profile.LastInteractionAt); err != nil {
		return nil, fmt.Errorf("computing engagement: %w", err)
	}
	profile.EngagementScore = engagement

	// Preferred price band from high-intent signals: prices actually paid plus
	// prices of high-intent interacted products.
	if err := r.db.QueryRow(ctx,
		`SELECT
			percentile_cont(0.1) WITHIN GROUP (ORDER BY price),
			percentile_cont(0.9) WITHIN GROUP (ORDER BY price)
		 FROM (
			SELECT pv.price
			FROM user_product_interactions i
			JOIN product_variants pv ON pv.product_id = i.product_id AND pv.is_active
			WHERE i.user_id = $1 AND i.interaction_type IN ('purchase','add_to_cart','wishlist')
			UNION ALL
			SELECT oi.unit_price
			FROM order_items oi JOIN orders o ON o.id = oi.order_id
			WHERE o.user_id = $1
			  AND o.status IN ('paid','processing','ready_to_ship','shipped','out_for_delivery','delivered','refund_requested','refund_approved','partially_refunded')
		 ) prices`,
		userID,
	).Scan(&priceMin, &priceMax); err != nil {
		return nil, fmt.Errorf("computing price band: %w", err)
	}
	profile.PreferredPriceMin = priceMin
	profile.PreferredPriceMax = priceMax

	catsJSON, _ := json.Marshal(cats)
	brandsJSON, _ := json.Marshal(brands)
	tagsJSON, _ := json.Marshal(tags)

	err = r.db.QueryRow(ctx,
		`INSERT INTO user_recommendation_profiles
		 (user_id, top_categories, top_brands, top_tags,
		  preferred_price_min, preferred_price_max, engagement_score,
		  last_interaction_at, computed_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
		 ON CONFLICT (user_id) DO UPDATE SET
		   top_categories      = EXCLUDED.top_categories,
		   top_brands          = EXCLUDED.top_brands,
		   top_tags            = EXCLUDED.top_tags,
		   preferred_price_min = EXCLUDED.preferred_price_min,
		   preferred_price_max = EXCLUDED.preferred_price_max,
		   engagement_score    = EXCLUDED.engagement_score,
		   last_interaction_at = EXCLUDED.last_interaction_at,
		   computed_at         = NOW()
		 RETURNING computed_at`,
		userID, catsJSON, brandsJSON, tagsJSON,
		priceMin, priceMax, engagement, profile.LastInteractionAt,
	).Scan(&profile.ComputedAt)
	if err != nil {
		return nil, fmt.Errorf("upserting recommendation profile: %w", err)
	}

	return profile, nil
}

// userSignalsCTE unifies two weighted-feedback sources for a user: the
// first-party interaction log and their realised order history (a strong
// purchase signal). Folding orders in means personalization works immediately
// from existing data, before any interaction is ever recorded by the frontend.
const userSignalsCTE = `
	WITH signals AS (
		SELECT product_id, weight
		FROM user_product_interactions
		WHERE user_id = $1
		UNION ALL
		SELECT oi.product_id, oi.quantity * 10.0 AS weight
		FROM order_items oi
		JOIN orders o ON o.id = oi.order_id
		WHERE o.user_id = $1
		  AND o.status IN ('paid','processing','ready_to_ship','shipped','out_for_delivery','delivered','refund_requested','refund_approved','partially_refunded')
	)`

func (r *recommendationRepository) affinityByCategory(ctx context.Context, userID int64) ([]models.AffinityScore, error) {
	const q = userSignalsCTE + `
		SELECT p.category_id, SUM(s.weight) AS score
		FROM signals s
		JOIN products p ON p.id = s.product_id
		WHERE p.category_id IS NOT NULL
		GROUP BY p.category_id
		ORDER BY score DESC
		LIMIT 10`
	return r.scanAffinity(ctx, q, userID)
}

func (r *recommendationRepository) affinityByBrand(ctx context.Context, userID int64) ([]models.AffinityScore, error) {
	const q = userSignalsCTE + `
		SELECT p.brand_id, SUM(s.weight) AS score
		FROM signals s
		JOIN products p ON p.id = s.product_id
		WHERE p.brand_id IS NOT NULL
		GROUP BY p.brand_id
		ORDER BY score DESC
		LIMIT 10`
	return r.scanAffinity(ctx, q, userID)
}

func (r *recommendationRepository) affinityByTag(ctx context.Context, userID int64) ([]models.AffinityScore, error) {
	const q = userSignalsCTE + `
		SELECT pt.tag_id, SUM(s.weight) AS score
		FROM signals s
		JOIN product_tags pt ON pt.product_id = s.product_id
		GROUP BY pt.tag_id
		ORDER BY score DESC
		LIMIT 15`
	return r.scanAffinity(ctx, q, userID)
}

func (r *recommendationRepository) scanAffinity(ctx context.Context, query string, userID int64) ([]models.AffinityScore, error) {
	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("querying affinity: %w", err)
	}
	defer rows.Close()

	out := []models.AffinityScore{}
	for rows.Next() {
		var a models.AffinityScore
		if err := rows.Scan(&a.ID, &a.Score); err != nil {
			return nil, fmt.Errorf("scanning affinity: %w", err)
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

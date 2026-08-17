package product

import (
	"context"
	"errors"
	"fmt"
	catvariant "github.com/tiredbooy/internal/features/catalog/variant"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/tiredbooy/internal/features/inventory"
	"github.com/tiredbooy/internal/models"
)

// SaveAggregate replaces the complete editor-owned product graph in one
// transaction. A zero productID creates a new product; a positive ID updates the
// existing row under an optimistic revision check.
func (r *repository) FindAggregateOperation(
	ctx context.Context,
	operationID string,
	requestHash string,
) (*ProductAggregateWriteResult, error) {
	var existingHash string
	var productID *int64
	err := r.db.QueryRow(ctx, `
		SELECT request_hash, product_id
		FROM product_aggregate_operations
		WHERE operation_id = $1`, operationID).Scan(&existingHash, &productID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read product aggregate operation: %w", err)
	}
	if existingHash != requestHash {
		return nil, aggregateFieldError(
			"operation_id", "operation ID was already used for different content", models.ErrConflict,
		)
	}
	if productID == nil {
		return nil, aggregateFieldError(
			"operation_id", "operation is still in progress", models.ErrConflict,
		)
	}
	product, err := r.GetByIDForAdmin(ctx, *productID)
	if err != nil {
		return nil, err
	}
	return &ProductAggregateWriteResult{Product: product, Replayed: true}, nil
}

func (r *repository) SaveAggregate(
	ctx context.Context,
	productID int64,
	requestHash string,
	req SaveProductAggregateReq,
) (*ProductAggregateWriteResult, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("repository.SaveAggregate begin: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	replayedProductID, replayed, err := claimProductAggregateOperationTx(
		ctx, tx, req.OperationID, requestHash,
	)
	if err != nil {
		return nil, err
	}
	if replayed {
		product, err := getProductByIDTx(ctx, tx, replayedProductID)
		if err != nil {
			return nil, err
		}
		return &ProductAggregateWriteResult{Product: product, Replayed: true}, nil
	}

	if productID > 0 {
		if err := lockAggregateProductGraphTx(ctx, tx, productID); err != nil {
			return nil, err
		}
	}
	product, err := saveAggregateProductRowTx(ctx, tx, productID, req)
	if err != nil {
		return nil, err
	}
	productID = product.ID
	if req.ExpectedUpdatedAt == nil {
		if err := lockAggregateProductGraphTx(ctx, tx, productID); err != nil {
			return nil, err
		}
	}

	if _, err := tx.Exec(ctx, `DELETE FROM product_tags WHERE product_id = $1`, productID); err != nil {
		return nil, fmt.Errorf("repository.SaveAggregate clear tags: %w", err)
	}
	if err := insertProductTagsTx(ctx, tx, productID, req.TagIDs); err != nil {
		if isOptionForeignKeyViolation(err) {
			return nil, aggregateFieldError("tag_ids", "one or more tags do not exist", models.ErrNotFound)
		}
		return nil, fmt.Errorf("repository.SaveAggregate insert tags: %w", err)
	}

	detachedKeys, err := replaceAggregateVariantsTx(ctx, tx, productID, req.Variants)
	if err != nil {
		return nil, err
	}
	imageKeys, err := replaceAggregateImagesTx(ctx, tx, productID, req.Images)
	if err != nil {
		return nil, err
	}
	detachedKeys = append(detachedKeys, imageKeys...)

	if _, err := tx.Exec(ctx,
		`UPDATE product_aggregate_operations SET product_id = $2 WHERE operation_id = $1`,
		req.OperationID, productID,
	); err != nil {
		return nil, fmt.Errorf("repository.SaveAggregate complete operation: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("repository.SaveAggregate commit: %w", err)
	}

	return &ProductAggregateWriteResult{
		Product:      product,
		DetachedKeys: uniqueStrings(detachedKeys),
	}, nil
}

func lockAggregateProductGraphTx(ctx context.Context, tx pgx.Tx, productID int64) error {
	if err := catvariant.LockProductVariantSetTx(ctx, tx, productID); err != nil {
		return fmt.Errorf("repository.SaveAggregate variant lock: %w", err)
	}
	if _, err := tx.Exec(ctx,
		`SELECT pg_advisory_xact_lock(hashtextextended('product-images:' || ($1::bigint)::text, 0))`,
		productID,
	); err != nil {
		return fmt.Errorf("repository.SaveAggregate image lock: %w", err)
	}
	return nil
}

func claimProductAggregateOperationTx(
	ctx context.Context,
	tx pgx.Tx,
	operationID string,
	requestHash string,
) (int64, bool, error) {
	tag, err := tx.Exec(ctx, `
		INSERT INTO product_aggregate_operations (operation_id, request_hash)
		VALUES ($1, $2)
		ON CONFLICT (operation_id) DO NOTHING`, operationID, requestHash)
	if err != nil {
		return 0, false, fmt.Errorf("claim product aggregate operation: %w", err)
	}
	if tag.RowsAffected() == 1 {
		return 0, false, nil
	}

	var existingHash string
	var productID *int64
	if err := tx.QueryRow(ctx, `
		SELECT request_hash, product_id
		FROM product_aggregate_operations
		WHERE operation_id = $1`, operationID).Scan(&existingHash, &productID); err != nil {
		return 0, false, fmt.Errorf("read product aggregate operation: %w", err)
	}
	if existingHash != requestHash {
		return 0, false, aggregateFieldError(
			"operation_id", "operation ID was already used for different content", models.ErrConflict,
		)
	}
	if productID == nil {
		return 0, false, aggregateFieldError(
			"operation_id", "operation is still in progress", models.ErrConflict,
		)
	}
	return *productID, true, nil
}

func saveAggregateProductRowTx(
	ctx context.Context,
	tx pgx.Tx,
	productID int64,
	req SaveProductAggregateReq,
) (*Product, error) {
	args := pgx.NamedArgs{
		"id":                  productID,
		"title":               req.Title,
		"code":                req.Code,
		"slug":                req.Slug,
		"category_id":         req.CategoryID,
		"description":         req.Description,
		"brand_id":            req.BrandID,
		"country_of_origin":   req.CountryOfOrigin,
		"abv":                 req.ABV,
		"weight":              req.Weight,
		"is_active":           req.IsActive,
		"meta_title":          req.MetaTitle,
		"meta_description":    req.MetaDescription,
		"meta_tags":           req.MetaTags,
		"expected_updated_at": req.ExpectedUpdatedAt,
	}

	var query string
	if productID == 0 {
		query = `
			INSERT INTO products (
				title, code, slug, category_id, description, brand_id,
				country_of_origin, abv, weight, is_active, meta_title,
				meta_description, meta_tags
			) VALUES (
				@title, @code, @slug, @category_id, @description, @brand_id,
				@country_of_origin, @abv, @weight, @is_active, @meta_title,
				@meta_description, @meta_tags
			)
			RETURNING *`
	} else {
		if req.ExpectedUpdatedAt == nil {
			return nil, aggregateFieldError(
				"expected_updated_at", "product revision is required", models.ErrInvalidState,
			)
		}
		var matches bool
		if err := tx.QueryRow(ctx, `
			SELECT updated_at = $2
			FROM products
			WHERE id = $1
			FOR UPDATE`, productID, *req.ExpectedUpdatedAt).Scan(&matches); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, models.ErrNotFound
			}
			return nil, fmt.Errorf("lock aggregate product: %w", err)
		}
		if !matches {
			return nil, aggregateFieldError(
				"expected_updated_at", "product changed after this editor was loaded", models.ErrConflict,
			)
		}
		query = `
			UPDATE products SET
				title = @title,
				code = @code,
				slug = @slug,
				category_id = @category_id,
				description = @description,
				brand_id = @brand_id,
				country_of_origin = @country_of_origin,
				abv = @abv,
				weight = @weight,
				is_active = @is_active,
				meta_title = @meta_title,
				meta_description = @meta_description,
				meta_tags = @meta_tags
			WHERE id = @id
			RETURNING *`
	}

	rows, err := tx.Query(ctx, query, args)
	if err != nil {
		return nil, mapAggregateProductRowError(err)
	}
	product, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Product])
	if err != nil {
		return nil, mapAggregateProductRowError(err)
	}
	return &product, nil
}

func replaceAggregateVariantsTx(
	ctx context.Context,
	tx pgx.Tx,
	productID int64,
	requested []SaveProductVariantReq,
) ([]string, error) {
	rows, err := tx.Query(ctx,
		`SELECT id FROM product_variants WHERE product_id = $1 FOR UPDATE`, productID)
	if err != nil {
		return nil, fmt.Errorf("read aggregate variants: %w", err)
	}
	existingIDs, err := pgx.CollectRows(rows, pgx.RowTo[int64])
	if err != nil {
		return nil, fmt.Errorf("scan aggregate variants: %w", err)
	}
	existing := make(map[int64]struct{}, len(existingIDs))
	for _, id := range existingIDs {
		existing[id] = struct{}{}
	}

	requestedExisting := make(map[int64]struct{}, len(requested))
	for i, variant := range requested {
		if variant.ID == nil {
			continue
		}
		if _, ok := existing[*variant.ID]; !ok {
			return nil, aggregateFieldError(
				fmt.Sprintf("variants.%d.id", i), "variant does not belong to this product", models.ErrInvalidState,
			)
		}
		requestedExisting[*variant.ID] = struct{}{}
	}
	deletedIDs := make([]int64, 0)
	for _, id := range existingIDs {
		if _, keep := requestedExisting[id]; !keep {
			deletedIDs = append(deletedIDs, id)
		}
	}

	detachedKeys, err := productVariantMediaKeysTx(ctx, tx, deletedIDs)
	if err != nil {
		return nil, err
	}
	if len(existingIDs) > 0 {
		if _, err := tx.Exec(ctx, `
			DELETE FROM product_variants_options
			WHERE product_variant_id = ANY($1)`, existingIDs); err != nil {
			return nil, fmt.Errorf("clear aggregate variant options: %w", err)
		}
		if _, err := tx.Exec(ctx,
			`UPDATE product_variants SET sku = NULL WHERE id = ANY($1)`, existingIDs,
		); err != nil {
			return nil, fmt.Errorf("release aggregate variant SKUs: %w", err)
		}
	}
	if len(deletedIDs) > 0 {
		if err := inventory.DropEmptyForVariantsTx(ctx, tx, deletedIDs); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx,
			`DELETE FROM product_variants WHERE product_id = $1 AND id = ANY($2)`,
			productID, deletedIDs,
		); err != nil {
			if isOptionForeignKeyViolation(err) {
				return nil, aggregateFieldError(
					"variants", "one or more removed variants are still in use", models.ErrConflict,
				)
			}
			return nil, fmt.Errorf("delete aggregate variants: %w", err)
		}
	}

	variantIDs := make([]int64, len(requested))
	for i, variant := range requested {
		if variant.ID == nil {
			err := tx.QueryRow(ctx, `
				INSERT INTO product_variants (
					product_id, sku, price, compare_at_price, is_active
				) VALUES ($1, $2, $3, $4, $5)
				RETURNING id`,
				productID, variant.SKU, variant.Price, variant.CompareAtPrice, variant.IsActive,
			).Scan(&variantIDs[i])
			if err != nil {
				return nil, mapAggregateVariantError(err, i, "sku")
			}
		} else {
			variantIDs[i] = *variant.ID
			tag, err := tx.Exec(ctx, `
				UPDATE product_variants SET
					sku = $3,
					price = $4,
					compare_at_price = $5,
					is_active = $6
				WHERE id = $1 AND product_id = $2`,
				*variant.ID, productID, variant.SKU, variant.Price, variant.CompareAtPrice, variant.IsActive,
			)
			if err != nil {
				return nil, mapAggregateVariantError(err, i, "sku")
			}
			if tag.RowsAffected() != 1 {
				return nil, aggregateFieldError(
					fmt.Sprintf("variants.%d.id", i), "variant does not belong to this product", models.ErrInvalidState,
				)
			}
		}
		if err := inventory.EnsureForVariantTx(ctx, tx, variantIDs[i]); err != nil {
			return nil, fmt.Errorf("ensure inventory for aggregate variant %d: %w", i, err)
		}
	}

	for i, variant := range requested {
		if err := catvariant.InsertVariantOptionsTx(ctx, tx, variantIDs[i], variant.OptionValueIDs, false); err != nil {
			if !errors.Is(err, models.ErrNotFound) && !errors.Is(err, models.ErrConflict) {
				return nil, fmt.Errorf("save aggregate variant %d options: %w", i, err)
			}
			message := "one or more option values do not exist"
			if errors.Is(err, models.ErrConflict) {
				message = "only one value from each option type may be selected"
			}
			return nil, aggregateFieldError(
				fmt.Sprintf("variants.%d.option_value_ids", i), message, err,
			)
		}
	}
	for i, variantID := range variantIDs {
		if err := catvariant.EnsureUniqueVariantCombinationTx(ctx, tx, productID, variantID); err != nil {
			if !errors.Is(err, models.ErrConflict) {
				return nil, fmt.Errorf("validate aggregate variant %d combination: %w", i, err)
			}
			return nil, aggregateFieldError(
				fmt.Sprintf("variants.%d.option_value_ids", i),
				"option combination is already used by another variant", err,
			)
		}
	}

	return detachedKeys, nil
}

func replaceAggregateImagesTx(
	ctx context.Context,
	tx pgx.Tx,
	productID int64,
	requested []SaveProductImageReq,
) ([]string, error) {
	rows, err := tx.Query(ctx, `
		SELECT id, storage_key, image_url
		FROM product_images
		WHERE product_id = $1 AND product_variant_id IS NULL
		FOR UPDATE`, productID)
	if err != nil {
		return nil, fmt.Errorf("read aggregate images: %w", err)
	}
	type imageIdentity struct {
		ID         int64
		StorageKey *string
		ImageURL   string
	}
	existingRows, err := pgx.CollectRows(rows, pgx.RowToStructByPos[imageIdentity])
	if err != nil {
		return nil, fmt.Errorf("scan aggregate images: %w", err)
	}
	existing := make(map[int64]imageIdentity, len(existingRows))
	for _, image := range existingRows {
		existing[image.ID] = image
	}

	requestedIDs := make(map[int64]struct{}, len(requested))
	for i, image := range requested {
		if image.ID == nil {
			continue
		}
		if _, ok := existing[*image.ID]; !ok {
			return nil, aggregateFieldError(
				fmt.Sprintf("images.%d.id", i), "image does not belong to this product", models.ErrInvalidState,
			)
		}
		requestedIDs[*image.ID] = struct{}{}
	}

	detached := make([]string, 0)
	deletedIDs := make([]int64, 0)
	for _, image := range existingRows {
		if _, keep := requestedIDs[image.ID]; keep {
			continue
		}
		deletedIDs = append(deletedIDs, image.ID)
		if key := aggregateMediaKey(image.StorageKey, image.ImageURL); key != "" {
			detached = append(detached, key)
		}
	}
	if _, err := tx.Exec(ctx, `
		UPDATE product_images SET is_primary = false, updated_at = NOW()
		WHERE product_id = $1 AND product_variant_id IS NULL AND is_primary`, productID); err != nil {
		return nil, fmt.Errorf("clear aggregate image primary: %w", err)
	}
	if len(deletedIDs) > 0 {
		if _, err := tx.Exec(ctx, `
			DELETE FROM product_images
			WHERE product_id = $1 AND product_variant_id IS NULL AND id = ANY($2)`,
			productID, deletedIDs,
		); err != nil {
			return nil, fmt.Errorf("delete aggregate images: %w", err)
		}
	}

	for i, image := range requested {
		if image.ID != nil {
			tag, err := tx.Exec(ctx, `
				UPDATE product_images SET
					alt_text = $3,
					sort_order = $4,
					is_primary = $5,
					updated_at = NOW()
				WHERE id = $1 AND product_id = $2 AND product_variant_id IS NULL`,
				*image.ID, productID, image.AltText, i, image.IsPrimary,
			)
			if err != nil {
				return nil, mapAggregateImageError(err, i)
			}
			if tag.RowsAffected() != 1 {
				return nil, aggregateFieldError(
					fmt.Sprintf("images.%d.id", i), "image does not belong to this product", models.ErrInvalidState,
				)
			}
			continue
		}
		if image.ImageURL == nil {
			return nil, aggregateFieldError(
				fmt.Sprintf("images.%d", i), "new image source is required", models.ErrInvalidState,
			)
		}
		_, err := tx.Exec(ctx, `
			INSERT INTO product_images (
				product_id, image_url, storage_key, alt_text, sort_order,
				is_primary, width, height
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			productID, *image.ImageURL, image.StorageKey, image.AltText, i,
			image.IsPrimary, image.Width, image.Height,
		)
		if err != nil {
			return nil, mapAggregateImageError(err, i)
		}
	}

	return detached, nil
}

func productVariantMediaKeysTx(ctx context.Context, tx pgx.Tx, variantIDs []int64) ([]string, error) {
	if len(variantIDs) == 0 {
		return nil, nil
	}
	rows, err := tx.Query(ctx, `
		SELECT storage_key, image_url
		FROM product_images
		WHERE product_variant_id = ANY($1)`, variantIDs)
	if err != nil {
		return nil, fmt.Errorf("read removed variant media: %w", err)
	}
	defer rows.Close()
	keys := make([]string, 0)
	for rows.Next() {
		var storageKey *string
		var imageURL string
		if err := rows.Scan(&storageKey, &imageURL); err != nil {
			return nil, fmt.Errorf("scan removed variant media: %w", err)
		}
		if key := aggregateMediaKey(storageKey, imageURL); key != "" {
			keys = append(keys, key)
		}
	}
	return keys, rows.Err()
}

func getProductByIDTx(ctx context.Context, tx pgx.Tx, productID int64) (*Product, error) {
	rows, err := tx.Query(ctx, `SELECT * FROM products WHERE id = $1`, productID)
	if err != nil {
		return nil, fmt.Errorf("read replayed aggregate product: %w", err)
	}
	product, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Product])
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, models.ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("scan replayed aggregate product: %w", err)
	}
	return &product, nil
}

func mapAggregateProductRowError(err error) error {
	constraint := postgresConstraint(err)
	switch constraint {
	case "products_code_key":
		return aggregateFieldError("code", "code is already used by another product", models.ErrConflict)
	case "products_slug_key", "idx_products_slug":
		return aggregateFieldError("slug", "slug is already used by another product", models.ErrConflict)
	case "products_category_id_fkey":
		return aggregateFieldError("category_id", "category does not exist", models.ErrInvalidState)
	case "products_brand_id_fkey":
		return aggregateFieldError("brand_id", "brand does not exist", models.ErrInvalidState)
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return models.ErrNotFound
	}
	return fmt.Errorf("save aggregate product row: %w", err)
}

func mapAggregateVariantError(err error, index int, field string) error {
	if postgresConstraint(err) == "product_variants_sku_ci_key" || isUniqueViolation(err) {
		return aggregateFieldError(
			fmt.Sprintf("variants.%d.%s", index, field),
			"SKU is already used by another variant", models.ErrConflict,
		)
	}
	return fmt.Errorf("save aggregate variant %d: %w", index, err)
}

func mapAggregateImageError(err error, index int) error {
	if isUniqueViolation(err) {
		return aggregateFieldError(
			fmt.Sprintf("images.%d", index), "image is already attached", models.ErrConflict,
		)
	}
	return fmt.Errorf("save aggregate image %d: %w", index, err)
}

func aggregateFieldError(field, message string, err error) error {
	return &FieldError{Field: field, Message: message, Err: err}
}

func aggregateMediaKey(storageKey *string, imageURL string) string {
	if storageKey != nil && *storageKey != "" {
		return *storageKey
	}
	if strings.HasPrefix(imageURL, "/media/") {
		return strings.TrimPrefix(imageURL, "/media/")
	}
	return ""
}

func uniqueStrings(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

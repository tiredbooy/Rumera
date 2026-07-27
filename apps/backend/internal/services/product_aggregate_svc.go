package services

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
)

func (s *ProductService) SaveAggregate(
	ctx context.Context,
	productID int64,
	req models.SaveProductAggregateReq,
) (*models.Product, error) {
	if productID < 0 {
		return nil, apperr.ErrInvalidRequest
	}
	req = cloneProductAggregateRequest(req)
	fields := normalizeAndValidateProductAggregate(productID, &req)
	if len(fields) > 0 {
		return nil, apperr.WithFields(apperr.ErrValidation, fields)
	}

	requestHash, err := hashProductAggregateRequest(productID, req)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	replayed, err := s.productRepo.FindAggregateOperation(ctx, req.OperationID, requestHash)
	if err != nil {
		return nil, mapProductAggregateError(err)
	}
	if replayed != nil {
		return replayed.Product, nil
	}

	var mediaLock repositories.MediaKeyLock
	releaseMediaLock := func() error {
		if mediaLock == nil {
			return nil
		}
		releaseCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		err := mediaLock.Release(releaseCtx)
		mediaLock = nil
		return err
	}
	defer func() { _ = releaseMediaLock() }()
	if keys := aggregatePreparedStorageKeys(req.Images); len(keys) > 0 {
		if s.lifecycle == nil {
			return nil, apperr.ErrInternal
		}
		mediaLock, err = s.lifecycle.LockMediaKeys(ctx, keys...)
		if err != nil {
			return nil, apperr.ErrInternal
		}
	}
	if err := s.resolveAggregateImages(ctx, &req); err != nil {
		return nil, err
	}

	result, err := s.productRepo.SaveAggregate(ctx, productID, requestHash, req)
	if err != nil {
		return nil, mapProductAggregateError(err)
	}
	if err := releaseMediaLock(); err != nil {
		return nil, apperr.ErrInternal
	}
	if s.lifecycle != nil && len(result.DetachedKeys) > 0 {
		s.lifecycle.CleanupKeys(ctx, result.DetachedKeys...)
	}
	return result.Product, nil
}

func normalizeAndValidateProductAggregate(
	productID int64,
	req *models.SaveProductAggregateReq,
) map[string][]string {
	fields := make(map[string][]string)
	add := func(field, message string) {
		fields[field] = append(fields[field], message)
	}

	if _, err := uuid.Parse(req.OperationID); err != nil {
		add("operation_id", "must be a valid UUID")
	}
	if productID > 0 && req.ExpectedUpdatedAt == nil {
		add("expected_updated_at", "product revision is required")
	}
	if productID == 0 && req.ExpectedUpdatedAt != nil {
		add("expected_updated_at", "must be omitted when creating a product")
	}
	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		add("title", "title is required")
	} else if utf8.RuneCountInString(req.Title) > 255 {
		add("title", "must be at most 255 characters")
	}
	normalizeNullableAggregateString(&req.Code)
	normalizeNullableAggregateString(&req.Slug)
	normalizeNullableAggregateString(&req.Description)
	normalizeNullableAggregateString(&req.CountryOfOrigin)
	normalizeNullableAggregateString(&req.MetaTitle)
	normalizeNullableAggregateString(&req.MetaDescription)
	if req.Code != nil && utf8.RuneCountInString(*req.Code) > 80 {
		add("code", "must be at most 80 characters")
	}
	if req.Slug != nil && utf8.RuneCountInString(*req.Slug) > 255 {
		add("slug", "must be at most 255 characters")
	}
	if req.CountryOfOrigin != nil && utf8.RuneCountInString(*req.CountryOfOrigin) > 100 {
		add("country_of_origin", "must be at most 100 characters")
	}
	if req.MetaTitle != nil && utf8.RuneCountInString(*req.MetaTitle) > 225 {
		add("meta_title", "must be at most 225 characters")
	}
	if req.CategoryID != nil && *req.CategoryID <= 0 {
		add("category_id", "must be a positive ID")
	}
	if req.BrandID != nil && *req.BrandID <= 0 {
		add("brand_id", "must be a positive ID")
	}
	if req.ABV != nil && (*req.ABV < 0 || *req.ABV > 100) {
		add("abv", "must be between 0 and 100")
	}
	if req.Weight != nil && *req.Weight < 0 {
		add("weight", "must not be negative")
	}
	req.MetaTags = normalizeAggregateStrings(req.MetaTags)
	req.TagIDs = normalizePositiveAggregateIDs(req.TagIDs, "tag_ids", add)

	variantIDs := make(map[int64]int)
	skuRows := make(map[string][]int)
	combinationRows := make(map[string][]int)
	for i := range req.Variants {
		variant := &req.Variants[i]
		prefix := fmt.Sprintf("variants.%d", i)
		if variant.ID != nil {
			if *variant.ID <= 0 {
				add(prefix+".id", "must be a positive ID")
			} else if previous, exists := variantIDs[*variant.ID]; exists {
				add(prefix+".id", fmt.Sprintf("duplicates variants.%d.id", previous))
			} else {
				variantIDs[*variant.ID] = i
			}
		}
		normalizeNullableAggregateString(&variant.SKU)
		if variant.SKU != nil {
			if utf8.RuneCountInString(*variant.SKU) > 250 {
				add(prefix+".sku", "must be at most 250 characters")
			}
			key := strings.ToLower(*variant.SKU)
			skuRows[key] = append(skuRows[key], i)
		}
		if variant.Price <= 0 {
			add(prefix+".price", "must be greater than zero")
		}
		if variant.CompareAtPrice != nil && *variant.CompareAtPrice <= variant.Price {
			add(prefix+".compare_at_price", "must be greater than price")
		}
		variant.OptionValueIDs = normalizePositiveAggregateIDs(
			variant.OptionValueIDs, prefix+".option_value_ids", add,
		)
		if len(variant.OptionValueIDs) > 0 {
			sorted := append([]int64(nil), variant.OptionValueIDs...)
			sort.Slice(sorted, func(a, b int) bool { return sorted[a] < sorted[b] })
			parts := make([]string, len(sorted))
			for index, id := range sorted {
				parts[index] = fmt.Sprint(id)
			}
			key := strings.Join(parts, ":")
			combinationRows[key] = append(combinationRows[key], i)
		}
	}
	for _, rows := range skuRows {
		if len(rows) < 2 {
			continue
		}
		for _, row := range rows {
			add(fmt.Sprintf("variants.%d.sku", row), "SKU must be unique")
		}
	}
	for _, rows := range combinationRows {
		if len(rows) < 2 {
			continue
		}
		for _, row := range rows {
			add(fmt.Sprintf("variants.%d.option_value_ids", row), "option combination must be unique")
		}
	}

	imageIDs := make(map[int64]int)
	imageSources := make(map[string]int)
	primaryCount := 0
	for i := range req.Images {
		image := &req.Images[i]
		prefix := fmt.Sprintf("images.%d", i)
		if image.IsPrimary {
			primaryCount++
		}
		normalizeNullableAggregateString(&image.AltText)
		if image.AltText != nil && utf8.RuneCountInString(*image.AltText) > 255 {
			add(prefix+".alt_text", "must be at most 255 characters")
		}
		if image.ID != nil {
			if *image.ID <= 0 {
				add(prefix+".id", "must be a positive ID")
			} else if previous, exists := imageIDs[*image.ID]; exists {
				add(prefix+".id", fmt.Sprintf("duplicates images.%d.id", previous))
			} else {
				imageIDs[*image.ID] = i
			}
			if image.StorageKey != nil || image.ImageURL != nil {
				add(prefix, "existing images cannot replace their source")
			}
			continue
		}
		normalizeNullableAggregateString(&image.StorageKey)
		normalizeNullableAggregateString(&image.ImageURL)
		if (image.StorageKey == nil) == (image.ImageURL == nil) {
			add(prefix, "new image must provide exactly one source")
			continue
		}
		source := "url:" + derefAggregateString(image.ImageURL)
		if image.StorageKey != nil {
			source = "key:" + *image.StorageKey
		}
		if previous, exists := imageSources[source]; exists {
			add(prefix, fmt.Sprintf("duplicates images.%d source", previous))
		} else {
			imageSources[source] = i
		}
	}
	if len(req.Images) > 0 && primaryCount != 1 {
		add("images", "exactly one product image must be primary")
	}

	return fields
}

func (s *ProductService) resolveAggregateImages(
	ctx context.Context,
	req *models.SaveProductAggregateReq,
) error {
	fields := make(map[string][]string)
	for i := range req.Images {
		image := &req.Images[i]
		if image.ID != nil {
			continue
		}
		field := fmt.Sprintf("images.%d", i)
		if image.StorageKey != nil {
			if s.media == nil {
				return apperr.ErrInternal
			}
			mediaURL, width, height, err := s.media.ResolvePreparedProductImage(ctx, *image.StorageKey)
			if err != nil {
				if errors.Is(err, apperr.ErrInvalidRequest) {
					fields[field] = []string{"staged upload is missing or invalid"}
					continue
				}
				return err
			}
			image.ImageURL = &mediaURL
			image.Width = &width
			image.Height = &height
			continue
		}
		if image.ImageURL != nil {
			normalized, err := normalizeExternalImageURL(*image.ImageURL)
			if err != nil {
				fields[field] = []string{"external image URL is invalid"}
				continue
			}
			image.ImageURL = &normalized
		}
	}
	if len(fields) > 0 {
		return apperr.WithFields(apperr.ErrValidation, fields)
	}
	return nil
}

func cloneProductAggregateRequest(req models.SaveProductAggregateReq) models.SaveProductAggregateReq {
	req.MetaTags = append([]string(nil), req.MetaTags...)
	req.TagIDs = append([]int64(nil), req.TagIDs...)
	req.Variants = append([]models.SaveProductVariantReq(nil), req.Variants...)
	for i := range req.Variants {
		req.Variants[i].OptionValueIDs = append([]int64(nil), req.Variants[i].OptionValueIDs...)
	}
	req.Images = append([]models.SaveProductImageReq(nil), req.Images...)
	return req
}

func aggregatePreparedStorageKeys(images []models.SaveProductImageReq) []string {
	keys := make([]string, 0, len(images))
	for _, image := range images {
		if image.StorageKey != nil {
			keys = append(keys, *image.StorageKey)
		}
	}
	return keys
}

func mapProductAggregateError(err error) error {
	var fieldErr *models.FieldError
	if errors.As(err, &fieldErr) {
		cause := apperr.ErrValidation
		if errors.Is(fieldErr, models.ErrConflict) {
			cause = apperr.ErrConflict
		}
		return apperr.WithFields(cause, map[string][]string{
			fieldErr.Field: {fieldErr.Message},
		})
	}
	if errors.Is(err, models.ErrNotFound) {
		return apperr.ErrProductNotFound
	}
	if errors.Is(err, models.ErrConflict) {
		return apperr.ErrConflict
	}
	return apperr.ErrInternal
}

func hashProductAggregateRequest(productID int64, req models.SaveProductAggregateReq) (string, error) {
	payload, err := json.Marshal(struct {
		ProductID int64                          `json:"product_id"`
		Request   models.SaveProductAggregateReq `json:"request"`
	}{ProductID: productID, Request: req})
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(payload)
	return hex.EncodeToString(sum[:]), nil
}

func normalizeNullableAggregateString(value **string) {
	if *value == nil {
		return
	}
	normalized := strings.TrimSpace(**value)
	if normalized == "" {
		*value = nil
		return
	}
	*value = &normalized
}

func normalizeAggregateStrings(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func normalizePositiveAggregateIDs(
	values []int64,
	field string,
	add func(string, string),
) []int64 {
	seen := make(map[int64]struct{}, len(values))
	result := make([]int64, 0, len(values))
	for _, value := range values {
		if value <= 0 {
			add(field, "IDs must be positive")
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func derefAggregateString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

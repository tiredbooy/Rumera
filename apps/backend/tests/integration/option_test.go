//go:build integration

package integration

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/tiredbooy/internal/features/catalog/option"
	"github.com/tiredbooy/internal/features/catalog/product"
	"github.com/tiredbooy/internal/features/catalog/variant"
	"github.com/tiredbooy/internal/features/inventory"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/tiredbooy/pkg/apperr"
	"github.com/tiredbooy/pkg/validator"
)

func TestOptionAdminCRUDHandlers(t *testing.T) {
	requireDB(t)
	resetTables(t, "option_types")
	service := option.NewService(option.NewRepository(testPool))
	handler := option.NewHandler(service, validator.New())
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/admin/option-types", handler.ListOptionTypes)
	router.POST("/admin/option-types", handler.CreateOptionType)
	router.GET("/admin/option-types/:optionTypeID", handler.GetOptionType)
	router.PATCH("/admin/option-types/:optionTypeID", handler.UpdateOptionType)
	router.DELETE("/admin/option-types/:optionTypeID", handler.DeleteOptionType)
	router.GET("/admin/option-types/:optionTypeID/values", handler.ListOptionValues)
	router.POST("/admin/option-types/:optionTypeID/values", handler.CreateOptionValue)
	router.GET("/admin/option-values/:optionValueID", handler.GetOptionValue)
	router.PATCH("/admin/option-values/:optionValueID", handler.UpdateOptionValue)
	router.DELETE("/admin/option-values/:optionValueID", handler.DeleteOptionValue)

	typeRecorder := performOptionRequest(router, http.MethodPost, "/admin/option-types",
		`{"title":"size","display_name":"Size"}`)
	if typeRecorder.Code != http.StatusCreated {
		t.Fatalf("create type status/body = %d/%s", typeRecorder.Code, typeRecorder.Body.String())
	}
	var typeEnvelope struct {
		Data option.OptionType `json:"data"`
	}
	if err := json.Unmarshal(typeRecorder.Body.Bytes(), &typeEnvelope); err != nil {
		t.Fatalf("decode type: %v", err)
	}
	typeID := typeEnvelope.Data.ID

	valueRecorder := performOptionRequest(router, http.MethodPost,
		fmt.Sprintf("/admin/option-types/%d/values", typeID),
		`{"value":"Large","sort_order":1}`)
	if valueRecorder.Code != http.StatusCreated {
		t.Fatalf("create value status/body = %d/%s", valueRecorder.Code, valueRecorder.Body.String())
	}
	var valueEnvelope struct {
		Data option.OptionValue `json:"data"`
	}
	if err := json.Unmarshal(valueRecorder.Body.Bytes(), &valueEnvelope); err != nil {
		t.Fatalf("decode value: %v", err)
	}
	valueID := valueEnvelope.Data.ID

	if recorder := performOptionRequest(router, http.MethodGet,
		fmt.Sprintf("/admin/option-types/%d", typeID), ""); recorder.Code != http.StatusOK {
		t.Fatalf("get type status/body = %d/%s", recorder.Code, recorder.Body.String())
	}
	if recorder := performOptionRequest(router, http.MethodGet,
		fmt.Sprintf("/admin/option-values/%d", valueID), ""); recorder.Code != http.StatusOK {
		t.Fatalf("get value status/body = %d/%s", recorder.Code, recorder.Body.String())
	}
	if recorder := performOptionRequest(router, http.MethodGet, "/admin/option-types", ""); recorder.Code != http.StatusOK {
		t.Fatalf("list types status/body = %d/%s", recorder.Code, recorder.Body.String())
	}
	if recorder := performOptionRequest(router, http.MethodGet,
		fmt.Sprintf("/admin/option-types/%d/values", typeID), ""); recorder.Code != http.StatusOK {
		t.Fatalf("list values status/body = %d/%s", recorder.Code, recorder.Body.String())
	}
	if recorder := performOptionRequest(router, http.MethodPatch,
		fmt.Sprintf("/admin/option-values/%d", valueID), `{"value":"XL"}`); recorder.Code != http.StatusOK {
		t.Fatalf("update value status/body = %d/%s", recorder.Code, recorder.Body.String())
	}
	if recorder := performOptionRequest(router, http.MethodPatch,
		fmt.Sprintf("/admin/option-types/%d", typeID), `{"display_name":"Clothing size"}`); recorder.Code != http.StatusOK {
		t.Fatalf("update type status/body = %d/%s", recorder.Code, recorder.Body.String())
	}
	if recorder := performOptionRequest(router, http.MethodDelete,
		fmt.Sprintf("/admin/option-types/%d", typeID), ""); recorder.Code != http.StatusConflict {
		t.Fatalf("delete non-empty type status/body = %d/%s; want 409", recorder.Code, recorder.Body.String())
	}
	if recorder := performOptionRequest(router, http.MethodDelete,
		fmt.Sprintf("/admin/option-values/%d", valueID), ""); recorder.Code != http.StatusNoContent {
		t.Fatalf("delete value status/body = %d/%s", recorder.Code, recorder.Body.String())
	}
	if recorder := performOptionRequest(router, http.MethodDelete,
		fmt.Sprintf("/admin/option-types/%d", typeID), ""); recorder.Code != http.StatusNoContent {
		t.Fatalf("delete empty type status/body = %d/%s", recorder.Code, recorder.Body.String())
	}
}

func TestProductOptionCatalogAndVariantCombinationInvariants(t *testing.T) {
	requireDB(t)
	resetTables(t, "products", "option_types")
	ctx := context.Background()
	optionRepo := option.NewRepository(testPool)
	optionService := option.NewService(optionRepo)

	volume, err := optionService.CreateType(ctx, option.CreateOptionTypeReq{
		Title: "  volume  ", DisplayName: "  Volume  ",
	})
	if err != nil || volume.Title != "volume" || volume.DisplayName != "Volume" {
		t.Fatalf("create volume type = %+v, %v", volume, err)
	}
	color, err := optionService.CreateType(ctx, option.CreateOptionTypeReq{
		Title: "color", DisplayName: "Color",
	})
	if err != nil {
		t.Fatalf("create color type: %v", err)
	}
	if _, err := optionService.CreateType(ctx, option.CreateOptionTypeReq{
		Title: "VOLUME", DisplayName: "Duplicate",
	}); !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("case-insensitive type duplicate error = %v; want conflict", err)
	}

	volume750, err := optionService.CreateValue(ctx, volume.ID, option.CreateOptionValueReq{
		Value: " 750 ml ", SortOrder: 1,
	})
	if err != nil || volume750.Value != "750 ml" {
		t.Fatalf("create 750 ml = %+v, %v", volume750, err)
	}
	volume1L, err := optionService.CreateValue(ctx, volume.ID, option.CreateOptionValueReq{
		Value: "1 L", SortOrder: 2,
	})
	if err != nil {
		t.Fatalf("create 1 L: %v", err)
	}
	red, err := optionService.CreateValue(ctx, color.ID, option.CreateOptionValueReq{Value: "Red"})
	if err != nil {
		t.Fatalf("create red: %v", err)
	}
	// Values are unique within a type, not globally across unrelated dimensions.
	color750, err := optionService.CreateValue(ctx, color.ID, option.CreateOptionValueReq{Value: "750 ml"})
	if err != nil {
		t.Fatalf("reuse display value under another type: %v", err)
	}
	if _, err := optionService.CreateValue(ctx, volume.ID, option.CreateOptionValueReq{
		Value: "750 ML",
	}); !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("case-insensitive value duplicate error = %v; want conflict", err)
	}

	displayName := "Bottle volume"
	if updated, err := optionService.UpdateType(ctx, volume.ID, option.UpdateOptionTypeReq{DisplayName: &displayName}); err != nil || updated.DisplayName != displayName {
		t.Fatalf("update option type = %+v, %v", updated, err)
	}
	valueLabel, sortOrder := "1 litre", 3
	volume1L, err = optionService.UpdateValue(ctx, volume1L.ID, option.UpdateOptionValueReq{
		Value: &valueLabel, SortOrder: &sortOrder,
	})
	if err != nil || volume1L.Value != valueLabel || volume1L.SortOrder != sortOrder {
		t.Fatalf("update option value = %+v, %v", volume1L, err)
	}
	values, err := optionService.ListValues(ctx, volume.ID)
	if err != nil || len(values) != 2 || values[0].ID != volume750.ID || values[1].ID != volume1L.ID {
		t.Fatalf("ordered volume values = %+v, %v", values, err)
	}

	productID := seedProduct(t)
	variantRepo := variant.NewRepository(testPool)
	inventoryRepo := inventory.NewRepository(testPool)
	variantService := variant.NewService(variantRepo, inventoryRepo, nil)
	first, err := variantService.Create(ctx, productID, variant.CreateVariantReq{
		SKU: stringPointer("OPT-1"), Price: 10,
		OptionValueIDs: []int64{volume750.ID, red.ID},
	})
	if err != nil {
		t.Fatalf("create multi-dimension variant: %v", err)
	}
	if _, err := variantService.Create(ctx, productID, variant.CreateVariantReq{
		SKU: stringPointer("OPT-DUPLICATE"), Price: 11,
		OptionValueIDs: []int64{red.ID, volume750.ID},
	}); !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("duplicate option combination error = %v; want conflict", err)
	}
	second, err := variantService.Create(ctx, productID, variant.CreateVariantReq{
		SKU: stringPointer("OPT-2"), Price: 12,
		OptionValueIDs: []int64{volume750.ID, color750.ID},
	})
	if err != nil {
		t.Fatalf("reuse one option value in a distinct combination: %v", err)
	}
	productRepo := product.NewRepository(testPool)
	inlineProduct, err := productRepo.Create(ctx, product.CreateProductReq{
		Title: "Inline option product",
		Variants: []variant.CreateVariantReq{{
			SKU: stringPointer("OPT-INLINE"), Price: 14,
			OptionValueIDs: []int64{volume1L.ID, red.ID},
		}},
	})
	if err != nil {
		t.Fatalf("create product with inline option combination: %v", err)
	}
	inlineVariants, err := productRepo.GetVariants(ctx, inlineProduct.ID)
	if err != nil || len(inlineVariants) != 1 {
		t.Fatalf("inline variants = %+v, %v; want one", inlineVariants, err)
	}
	options, err := variantService.GetOptions(ctx, first.ID)
	if err != nil || len(options) != 2 {
		t.Fatalf("first variant options = %+v, %v; want two", options, err)
	}

	if err := variantService.ReplaceOptions(ctx, first.ID, []int64{volume750.ID, volume1L.ID}); !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("two values from one type error = %v; want conflict", err)
	}
	options, err = variantService.GetOptions(ctx, first.ID)
	if err != nil || len(options) != 2 {
		t.Fatalf("failed replacement changed old combination = %+v, %v", options, err)
	}
	variantHandler := variant.NewHandler(variantService, validator.New(), nil)
	variantRouter := gin.New()
	variantRouter.PUT("/admin/variants/:id/options", variantHandler.ReplaceVariantOptions)
	missingFieldRecorder := performOptionRequest(
		variantRouter,
		http.MethodPut,
		fmt.Sprintf("/admin/variants/%d/options", first.ID),
		`{}`,
	)
	// Bind+validate returns 422 Unprocessable Entity for missing required JSON fields.
	if missingFieldRecorder.Code != http.StatusUnprocessableEntity {
		t.Fatalf("missing replacement field status/body = %d/%s; want 422", missingFieldRecorder.Code, missingFieldRecorder.Body.String())
	}
	replaceRecorder := performOptionRequest(
		variantRouter,
		http.MethodPut,
		fmt.Sprintf("/admin/variants/%d/options", first.ID),
		fmt.Sprintf(`{"option_value_ids":[%d,%d,%d]}`, volume1L.ID, color750.ID, color750.ID),
	)
	if replaceRecorder.Code != http.StatusNoContent {
		t.Fatalf("replace combination status/body = %d/%s", replaceRecorder.Code, replaceRecorder.Body.String())
	}
	options, err = variantService.GetOptions(ctx, first.ID)
	if err != nil || len(options) != 2 {
		t.Fatalf("replacement options = %+v, %v; want duplicate IDs collapsed", options, err)
	}

	if err := optionService.DeleteValue(ctx, red.ID); !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("delete used value error = %v; want conflict", err)
	}
	if err := optionService.DeleteType(ctx, volume.ID); !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("delete type with values error = %v; want conflict", err)
	}

	clearRecorder := performOptionRequest(variantRouter, http.MethodPut,
		fmt.Sprintf("/admin/variants/%d/options", first.ID), `{"option_value_ids":[]}`)
	if clearRecorder.Code != http.StatusNoContent {
		t.Fatalf("clear first variant status/body = %d/%s", clearRecorder.Code, clearRecorder.Body.String())
	}
	clearedOptions, err := variantService.GetOptions(ctx, first.ID)
	if err != nil || clearedOptions == nil || len(clearedOptions) != 0 {
		t.Fatalf("cleared first variant options = %#v, %v; want non-nil empty list", clearedOptions, err)
	}
	if err := variantService.ReplaceOptions(ctx, second.ID, []int64{}); err != nil {
		t.Fatalf("clear second variant options: %v", err)
	}
	if err := variantService.ReplaceOptions(ctx, inlineVariants[0].ID, []int64{}); err != nil {
		t.Fatalf("clear inline variant options: %v", err)
	}
	for _, valueID := range []int64{volume750.ID, volume1L.ID, red.ID, color750.ID} {
		if err := optionService.DeleteValue(ctx, valueID); err != nil {
			t.Fatalf("delete detached value %d: %v", valueID, err)
		}
	}
	for _, optionTypeID := range []int64{volume.ID, color.ID} {
		if err := optionService.DeleteType(ctx, optionTypeID); err != nil {
			t.Fatalf("delete empty type %d: %v", optionTypeID, err)
		}
	}
	types, err := optionService.ListTypes(ctx)
	if err != nil || len(types) != 0 {
		t.Fatalf("option types after cleanup = %+v, %v; want empty", types, err)
	}
}

func TestProductOptionMigrationPreservesLegacyLinksAndEnforcesNewInvariants(t *testing.T) {
	requireDB(t)
	resetTables(t, "products", "option_types")
	ctx := context.Background()
	db := stdlib.OpenDBFromPool(testPool)
	defer func() { _ = db.Close() }()

	const (
		migrationDir             = "../../migrations/main"
		preOptionMigrationID     = int64(20260722120000)
		productOptionMigrationID = int64(20260725180000)
	)
	if err := goose.DownTo(db, migrationDir, preOptionMigrationID); err != nil {
		t.Fatalf("migrate product options down: %v", err)
	}
	migrationApplied := false
	defer func() {
		if !migrationApplied {
			if err := goose.Up(db, migrationDir); err != nil {
				t.Errorf("restore product option migration: %v", err)
				return
			}
		}
		if _, err := testPool.Exec(ctx, "TRUNCATE products, option_types RESTART IDENTITY CASCADE"); err != nil {
			t.Errorf("clean product option migration fixtures: %v", err)
		}
	}()

	productID := seedProduct(t)
	var firstVariantID, secondVariantID int64
	if err := testPool.QueryRow(ctx,
		`INSERT INTO product_variants (product_id, sku, price)
		 VALUES ($1, '  Legacy-1  ', 10), ($1, 'LEGACY-2', 11)
		 RETURNING id`, productID,
	).Scan(&firstVariantID); err != nil {
		t.Fatalf("insert first legacy variant: %v", err)
	}
	if err := testPool.QueryRow(ctx,
		`SELECT id FROM product_variants WHERE product_id = $1 AND id <> $2`,
		productID, firstVariantID,
	).Scan(&secondVariantID); err != nil {
		t.Fatalf("read second legacy variant: %v", err)
	}

	var sizeTypeID, sizeValueID int64
	if err := testPool.QueryRow(ctx,
		`INSERT INTO option_types (title, display_name)
		 VALUES ('  size  ', '  Size  ')
		 RETURNING id`,
	).Scan(&sizeTypeID); err != nil {
		t.Fatalf("insert legacy option type: %v", err)
	}
	if err := testPool.QueryRow(ctx,
		`INSERT INTO option_values (variant_id, value, sort_order)
		 VALUES ($1, '  Large  ', -5)
		 RETURNING id`, sizeTypeID,
	).Scan(&sizeValueID); err != nil {
		t.Fatalf("insert legacy option value: %v", err)
	}
	if _, err := testPool.Exec(ctx,
		`INSERT INTO product_variants_options (product_variant_id, variant_option_id)
		 VALUES ($1, $2)`, firstVariantID, sizeValueID,
	); err != nil {
		t.Fatalf("insert legacy variant option: %v", err)
	}

	if err := goose.UpTo(db, migrationDir, productOptionMigrationID); err != nil {
		t.Fatalf("migrate product options up: %v", err)
	}

	var title, displayName, value string
	var optionTypeID int64
	var sortOrder int
	if err := testPool.QueryRow(ctx,
		`SELECT ot.title, ot.display_name, ov.option_type_id, ov.value, ov.sort_order
		 FROM option_types ot
		 INNER JOIN option_values ov ON ov.option_type_id = ot.id
		 WHERE ov.id = $1`, sizeValueID,
	).Scan(&title, &displayName, &optionTypeID, &value, &sortOrder); err != nil {
		t.Fatalf("read migrated option catalogue: %v", err)
	}
	if title != "size" || displayName != "Size" || optionTypeID != sizeTypeID || value != "Large" || sortOrder != 0 {
		t.Fatalf("migrated option = %q/%q type %d value %q sort %d", title, displayName, optionTypeID, value, sortOrder)
	}

	var linkedTypeID int64
	if err := testPool.QueryRow(ctx,
		`SELECT option_type_id FROM product_variants_options
		 WHERE product_variant_id = $1 AND variant_option_id = $2`,
		firstVariantID, sizeValueID,
	).Scan(&linkedTypeID); err != nil || linkedTypeID != sizeTypeID {
		t.Fatalf("migrated legacy link type = %d, %v; want %d", linkedTypeID, err, sizeTypeID)
	}

	// A reusable value can now belong to multiple variants.
	if _, err := testPool.Exec(ctx,
		`INSERT INTO product_variants_options (product_variant_id, variant_option_id, option_type_id)
		 VALUES ($1, $2, $3)`, secondVariantID, sizeValueID, sizeTypeID,
	); err != nil {
		t.Fatalf("reuse migrated option value: %v", err)
	}

	var colorTypeID, redValueID int64
	if err := testPool.QueryRow(ctx,
		`INSERT INTO option_types (title, display_name)
		 VALUES ('color', 'Color') RETURNING id`,
	).Scan(&colorTypeID); err != nil {
		t.Fatalf("insert color type: %v", err)
	}
	if err := testPool.QueryRow(ctx,
		`INSERT INTO option_values (option_type_id, value)
		 VALUES ($1, 'Red') RETURNING id`, colorTypeID,
	).Scan(&redValueID); err != nil {
		t.Fatalf("insert color value: %v", err)
	}
	if _, err := testPool.Exec(ctx,
		`INSERT INTO product_variants_options (product_variant_id, variant_option_id, option_type_id)
		 VALUES ($1, $2, $3)`, firstVariantID, redValueID, colorTypeID,
	); err != nil {
		t.Fatalf("attach second option dimension: %v", err)
	}

	var otherSizeValueID int64
	if err := testPool.QueryRow(ctx,
		`INSERT INTO option_values (option_type_id, value)
		 VALUES ($1, 'Small') RETURNING id`, sizeTypeID,
	).Scan(&otherSizeValueID); err != nil {
		t.Fatalf("insert second size value: %v", err)
	}
	if _, err := testPool.Exec(ctx,
		`INSERT INTO product_variants_options (product_variant_id, variant_option_id, option_type_id)
		 VALUES ($1, $2, $3)`, firstVariantID, otherSizeValueID, sizeTypeID,
	); err == nil {
		t.Fatal("expected one-value-per-option-type constraint to reject a second size")
	}
	if _, err := testPool.Exec(ctx, `DELETE FROM option_values WHERE id = $1`, sizeValueID); err == nil {
		t.Fatal("expected deletion of a used option value to be restricted")
	}
	if err := goose.Up(db, migrationDir); err != nil {
		t.Fatalf("restore migrations after product option assertions: %v", err)
	}
	migrationApplied = true
	var normalizedSKU *string
	if err := testPool.QueryRow(ctx,
		`SELECT sku FROM product_variants WHERE id = $1`, firstVariantID,
	).Scan(&normalizedSKU); err != nil || normalizedSKU == nil || *normalizedSKU != "Legacy-1" {
		t.Fatalf("normalized legacy SKU = %v, %v; want Legacy-1", normalizedSKU, err)
	}
	if _, err := testPool.Exec(ctx,
		`INSERT INTO product_variants (product_id, sku, price)
		 VALUES ($1, 'legacy-1', 12)`, productID,
	); err == nil {
		t.Fatal("expected case-insensitive SKU index to reject legacy-1")
	}
}

func performOptionRequest(router http.Handler, method, path, body string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	if body != "" {
		request.Header.Set("Content-Type", "application/json")
	}
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	return recorder
}

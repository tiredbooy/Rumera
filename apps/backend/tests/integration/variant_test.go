//go:build integration

package integration

import (
	"context"
	"errors"
	"github.com/tiredbooy/internal/features/catalog/option"
	"github.com/tiredbooy/internal/features/catalog/product"
	"github.com/tiredbooy/internal/features/catalog/variant"
	"github.com/tiredbooy/internal/features/inventory"
	"strings"
	"testing"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

func TestVariantSKUAndCombinationValidation(t *testing.T) {
	requireDB(t)
	resetTables(t, "products", "option_types")
	ctx := context.Background()

	optionService := option.NewService(option.NewRepository(testPool))
	size, err := optionService.CreateType(ctx, option.CreateOptionTypeReq{
		Title: "size", DisplayName: "Size",
	})
	if err != nil {
		t.Fatalf("create size type: %v", err)
	}
	color, err := optionService.CreateType(ctx, option.CreateOptionTypeReq{
		Title: "color", DisplayName: "Color",
	})
	if err != nil {
		t.Fatalf("create color type: %v", err)
	}
	large, err := optionService.CreateValue(ctx, size.ID, option.CreateOptionValueReq{Value: "Large"})
	if err != nil {
		t.Fatalf("create large: %v", err)
	}
	small, err := optionService.CreateValue(ctx, size.ID, option.CreateOptionValueReq{Value: "Small"})
	if err != nil {
		t.Fatalf("create small: %v", err)
	}
	red, err := optionService.CreateValue(ctx, color.ID, option.CreateOptionValueReq{Value: "Red"})
	if err != nil {
		t.Fatalf("create red: %v", err)
	}
	blue, err := optionService.CreateValue(ctx, color.ID, option.CreateOptionValueReq{Value: "Blue"})
	if err != nil {
		t.Fatalf("create blue: %v", err)
	}

	productID := seedProduct(t)
	service := variant.NewService(variant.NewRepository(testPool), inventory.NewRepository(testPool), nil)
	first, err := service.Create(ctx, productID, variant.CreateVariantReq{
		SKU: stringPointer("  Bottle-L-Red  "), Price: 10,
		OptionValueIDs: []int64{large.ID, red.ID},
	})
	if err != nil || first.SKU == nil || *first.SKU != "Bottle-L-Red" {
		t.Fatalf("normalized first variant = %+v, %v", first, err)
	}
	if _, err := service.Create(ctx, productID, variant.CreateVariantReq{
		SKU: stringPointer("bottle-l-red"), Price: 11,
		OptionValueIDs: []int64{large.ID, blue.ID},
	}); !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("case-insensitive duplicate SKU error = %v; want conflict", err)
	}

	second, err := service.Create(ctx, productID, variant.CreateVariantReq{
		SKU: stringPointer("Bottle-L-Blue"), Price: 12,
		OptionValueIDs: []int64{large.ID, blue.ID},
	})
	if err != nil {
		t.Fatalf("create distinct reusable combination: %v", err)
	}
	if _, err := service.Create(ctx, productID, variant.CreateVariantReq{
		SKU: stringPointer("Bottle-Duplicate"), Price: 13,
		OptionValueIDs: []int64{red.ID, large.ID},
	}); !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("order-independent duplicate combination error = %v; want conflict", err)
	}

	if err := service.ReplaceOptions(ctx, second.ID, []int64{large.ID, red.ID}); !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("replacement duplicate combination error = %v; want conflict", err)
	}
	secondOptions, err := service.GetOptions(ctx, second.ID)
	if err != nil || len(secondOptions) != 2 || secondOptions[0].ID == red.ID || secondOptions[1].ID == red.ID {
		t.Fatalf("failed replacement changed second combination = %+v, %v", secondOptions, err)
	}

	duplicateSKU := "BOTTLE-L-RED"
	if _, err := service.Update(ctx, second.ID, variant.UpdateVariantReq{
		SKU: models.NullablePatch[string]{Set: true, Value: &duplicateSKU},
	}); !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("update duplicate SKU error = %v; want conflict", err)
	}
	blankSKU := "   "
	if _, err := service.Update(ctx, second.ID, variant.UpdateVariantReq{
		SKU: models.NullablePatch[string]{Set: true, Value: &blankSKU},
	}); !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("blank update SKU error = %v; want invalid request", err)
	}
	cleared, err := service.Update(ctx, second.ID, variant.UpdateVariantReq{
		SKU: models.NullablePatch[string]{Set: true},
	})
	if err != nil || cleared.SKU != nil {
		t.Fatalf("cleared optional SKU = %+v, %v; want nil", cleared, err)
	}

	overlongSKU := strings.Repeat("x", 251)
	productService := product.NewService(product.NewRepository(testPool), nil, nil)
	if _, err := productService.Create(ctx, product.CreateProductReq{
		Title: "Overlong inline SKU",
		Variants: []variant.CreateVariantReq{{
			SKU: &overlongSKU, Price: 10,
		}},
	}); !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("overlong inline SKU error = %v; want invalid request", err)
	}

	// Product-level advisory locking makes concurrent identical combinations
	// deterministic: one commit succeeds and the other reports a conflict.
	type createResult struct {
		variant *variant.ProductVariant
		err     error
	}
	results := make(chan createResult, 2)
	for _, sku := range []string{"Concurrent-1", "Concurrent-2"} {
		sku := sku
		go func() {
			variant, createErr := service.Create(ctx, productID, variant.CreateVariantReq{
				SKU: &sku, Price: 14,
				OptionValueIDs: []int64{small.ID, red.ID},
			})
			results <- createResult{variant: variant, err: createErr}
		}()
	}
	var successes, conflicts int
	for range 2 {
		result := <-results
		switch {
		case result.err == nil && result.variant != nil:
			successes++
		case errors.Is(result.err, apperr.ErrConflict):
			conflicts++
		default:
			t.Fatalf("unexpected concurrent create result = %+v, %v", result.variant, result.err)
		}
	}
	if successes != 1 || conflicts != 1 {
		t.Fatalf("concurrent creates = %d success, %d conflicts; want 1/1", successes, conflicts)
	}
}

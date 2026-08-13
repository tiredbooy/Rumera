//go:build integration

package integration

import (
	"context"
	"errors"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/tiredbooy/internal/features/cart"
	"github.com/tiredbooy/internal/features/inventory"
	"github.com/tiredbooy/internal/features/wishlist"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

const preInventoryReservationNormalization = int64(20260801120000)

func TestInventoryReservationMigrationRoundTrip(t *testing.T) {
	requireDB(t)
	resetTables(t, "users", "products")
	productID := seedProduct(t)
	variantID := seedVariant(t, productID)
	seedInventory(t, variantID, 10, 2)

	db := stdlib.OpenDBFromPool(testPool)
	defer db.Close()
	if err := goose.DownTo(db, "../../migrations/main", preInventoryReservationNormalization); err != nil {
		t.Fatalf("migrate down before inventory normalization: %v", err)
	}
	restored := false
	defer func() {
		if !restored {
			if err := goose.Up(db, "../../migrations/main"); err != nil {
				t.Errorf("restore inventory normalization migration: %v", err)
			}
		}
	}()

	if got := physicalStock(t, variantID); got != 8 {
		t.Fatalf("legacy stock_on_hand after Down = %d; want 8", got)
	}
	if err := goose.Up(db, "../../migrations/main"); err != nil {
		t.Fatalf("reapply inventory normalization migration: %v", err)
	}
	restored = true
	if got := physicalStock(t, variantID); got != 10 {
		t.Fatalf("physical stock_on_hand after Up = %d; want 10", got)
	}
	if _, err := testPool.Exec(context.Background(),
		`UPDATE inventory SET committed_stock = stock_on_hand + 1 WHERE product_variant_id = $1`,
		variantID,
	); err == nil {
		t.Fatal("inventory accepted committed stock above physical stock")
	}
}

func TestCommittedInventoryIsUnavailableToCartAndWishlist(t *testing.T) {
	requireDB(t)
	resetTables(t, "users", "products")
	ctx := context.Background()
	userID := seedUser(t)
	productID := seedProduct(t)
	variantID := seedVariant(t, productID)
	seedInventory(t, variantID, 5, 5)

	cartRepo := cart.NewRepository(testPool)
	request := cart.AddCartItemReq{ProductVariantID: variantID, Quantity: 1}
	var cartID int64
	if err := testPool.QueryRow(ctx,
		`INSERT INTO carts (user_id) VALUES ($1) RETURNING id`, userID,
	).Scan(&cartID); err != nil {
		t.Fatalf("seed cart: %v", err)
	}
	if _, err := cartRepo.AddItem(ctx, cartID, request); !errors.Is(err, models.ErrInsufficientStock) {
		t.Fatalf("cart repository error = %v, want ErrInsufficientStock", err)
	}

	wishlistRepo := wishlist.NewRepository(testPool)
	list, err := wishlistRepo.GetOrCreate(ctx, userID)
	if err != nil {
		t.Fatalf("get wishlist: %v", err)
	}
	if err := wishlistRepo.AddItem(ctx, list.ID, wishlist.AddItemReq{ProductVariantID: variantID}); err != nil {
		t.Fatalf("add wishlist item: %v", err)
	}
	items, err := wishlistRepo.GetItems(ctx, list.ID)
	if err != nil || len(items) != 1 {
		t.Fatalf("wishlist items = %+v, %v", items, err)
	}
	if items[0].IsInStock {
		t.Fatal("wishlist reported fully committed inventory as in stock")
	}
}

func TestInventoryPaginationKeepsNullableSKUsStableAndCountsEmptyPages(t *testing.T) {
	requireDB(t)
	resetTables(t, "products")
	ctx := context.Background()
	productID := seedProduct(t)
	skuB, skuA := "SKU-B", "SKU-A"
	for _, sku := range []*string{nil, &skuB, &skuA} {
		variantID := seedVariant(t, productID)
		if sku != nil {
			if _, err := testPool.Exec(ctx, `UPDATE product_variants SET sku = $1 WHERE id = $2`, *sku, variantID); err != nil {
				t.Fatalf("set variant SKU: %v", err)
			}
		}
		seedInventory(t, variantID, 1, 0)
	}
	repo := inventory.NewRepository(testPool)
	filter := inventory.InventoryFilter{BaseFilter: models.BaseFilter{
		PaginationParams: models.PaginationParams{Page: 1, Limit: 2},
		SortBy:           "sku",
		OrderBy:          "desc",
	}}
	first, total, err := repo.GetAll(ctx, filter)
	if err != nil || total != 3 || len(first) != 2 {
		t.Fatalf("first inventory page = %+v total %d, %v", first, total, err)
	}
	if first[0].SKU == nil || *first[0].SKU != "SKU-B" || first[1].SKU == nil || *first[1].SKU != "SKU-A" {
		t.Fatalf("first inventory SKUs = %v, %v; want SKU-B, SKU-A", first[0].SKU, first[1].SKU)
	}
	filter.Page = 2
	second, total, err := repo.GetAll(ctx, filter)
	if err != nil || total != 3 || len(second) != 1 || second[0].SKU != nil {
		t.Fatalf("second inventory page = %+v total %d, %v; want one nil SKU", second, total, err)
	}
	filter.Page = 3
	empty, total, err := repo.GetAll(ctx, filter)
	if err != nil || total != 3 || len(empty) != 0 {
		t.Fatalf("empty inventory page = %+v total %d, %v; want empty with total 3", empty, total, err)
	}
}

func TestInventoryAdjustmentThresholdsAndVariantLedger(t *testing.T) {
	requireDB(t)
	resetTables(t, "users", "products")
	ctx := context.Background()
	userID := seedUser(t)
	productID := seedProduct(t)
	variantID := seedVariant(t, productID)
	seedInventory(t, variantID, 10, 2)
	orderID := seedOrder(t, userID)

	inventoryRepo := inventory.NewRepository(testPool)
	movementRepo := inventory.NewMovementRepository(testPool)
	service := inventory.NewService(inventoryRepo, movementRepo)
	note := "cycle count"
	if err := service.AdjustStock(ctx, variantID, inventory.AdjustStockReq{
		Quantity: -3,
		Type:     inventory.MovementTypeAdjustment,
		Note:     &note,
	}, nil); err != nil {
		t.Fatalf("adjust inventory: %v", err)
	}

	current, err := service.GetByVariantID(ctx, variantID)
	if err != nil || current.StockOnHand != 7 || current.CommittedStock != 2 {
		t.Fatalf("inventory after adjustment = %+v, %v", current, err)
	}
	movements, err := service.GetMovementsByVariant(ctx, variantID)
	if err != nil || len(movements) != 1 || movements[0].Quantity != -3 || movements[0].Note == nil || *movements[0].Note != note {
		t.Fatalf("movements after adjustment = %+v, %v", movements, err)
	}

	point, quantity := 0, 24
	updated, err := service.UpdateReorder(ctx, variantID, inventory.UpdateReorderReq{
		ReorderPoint: &point, ReorderQuantity: &quantity,
	})
	if err != nil || updated.ReorderPoint != 0 || updated.ReorderQuantity != 24 || updated.StockOnHand != 7 {
		t.Fatalf("updated thresholds = %+v, %v", updated, err)
	}
	point = 9
	updated, err = service.UpdateReorder(ctx, variantID, inventory.UpdateReorderReq{ReorderPoint: &point})
	if err != nil || updated.ReorderPoint != 9 || updated.ReorderQuantity != 24 {
		t.Fatalf("partially updated thresholds = %+v, %v", updated, err)
	}

	if err := service.AdjustStock(ctx, variantID, inventory.AdjustStockReq{
		Quantity: -6,
		Type:     inventory.MovementTypeAdjustment,
	}, nil); !errors.Is(err, models.ErrInsufficientStock) {
		t.Fatalf("underflow error = %v, want ErrInsufficientStock", err)
	}
	movements, err = service.GetMovementsByVariant(ctx, variantID)
	if err != nil || len(movements) != 1 {
		t.Fatalf("underflow movements = %+v, %v; want original ledger only", movements, err)
	}

	items := []inventory.StockLine{{VariantID: variantID, Quantity: 2}}
	if err := service.ReserveForOrder(ctx, orderID, items); err != nil {
		t.Fatalf("reserve inventory: %v", err)
	}
	current, err = service.GetByVariantID(ctx, variantID)
	if err != nil || current.StockOnHand != 7 || current.CommittedStock != 4 {
		t.Fatalf("inventory after reserve = %+v, %v; want physical 7 / committed 4", current, err)
	}
	if err := service.ReleaseForOrder(ctx, orderID, items); err != nil {
		t.Fatalf("release inventory: %v", err)
	}
	current, err = service.GetByVariantID(ctx, variantID)
	if err != nil || current.StockOnHand != 7 || current.CommittedStock != 2 {
		t.Fatalf("inventory after release = %+v, %v; want physical 7 / committed 2", current, err)
	}
	if err := service.ReserveForOrder(ctx, orderID, items); err != nil {
		t.Fatalf("reserve inventory before sale: %v", err)
	}
	if err := service.DeductForOrder(ctx, orderID, items); err != nil {
		t.Fatalf("deduct inventory: %v", err)
	}
	current, err = service.GetByVariantID(ctx, variantID)
	if err != nil || current.StockOnHand != 5 || current.CommittedStock != 2 {
		t.Fatalf("inventory after sale = %+v, %v; want physical 5 / committed 2", current, err)
	}

	const concurrentAdjustments = 8
	errs := make(chan error, concurrentAdjustments)
	var wg sync.WaitGroup
	for range concurrentAdjustments {
		wg.Add(1)
		go func() {
			defer wg.Done()
			errs <- service.AdjustStock(ctx, variantID, inventory.AdjustStockReq{
				Quantity: 1,
				Type:     inventory.MovementTypeAdjustment,
			}, nil)
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatalf("concurrent adjustment: %v", err)
		}
	}
	current, err = service.GetByVariantID(ctx, variantID)
	if err != nil || current.StockOnHand != 5+concurrentAdjustments {
		t.Fatalf("inventory after concurrent adjustments = %+v, %v", current, err)
	}

	filter := inventory.MovementFilter{ProductVariantID: &variantID}
	filter.Defaults()
	page, total, err := service.GetMovements(ctx, filter)
	wantMovements := int64(5 + concurrentAdjustments)
	if err != nil || total != wantMovements || int64(len(page)) != wantMovements {
		t.Fatalf("paginated movements = %d/%d, %v", len(page), total, err)
	}
	for i := 1; i < len(page); i++ {
		if page[i-1].CreatedAt.Before(page[i].CreatedAt) ||
			(page[i-1].CreatedAt.Equal(page[i].CreatedAt) && page[i-1].ID < page[i].ID) {
			t.Fatalf("movement order is not stable newest-first: %d before %d", page[i-1].ID, page[i].ID)
		}
	}

	// Service maps missing inventory to apperr.ErrNotFound (unit-tested contract).
	if _, err := service.GetMovementsByVariant(ctx, variantID+999); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("missing variant history error = %v, want apperr.ErrNotFound", err)
	}
}

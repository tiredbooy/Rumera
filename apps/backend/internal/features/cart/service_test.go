package cart

import (
	"context"
	"errors"
	"testing"

	"github.com/tiredbooy/internal/features/catalog/product"
	"github.com/tiredbooy/internal/features/catalog/variant"
	"github.com/tiredbooy/internal/features/inventory"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

var errSQL = errors.New("sql: connection reset")

type invStub struct {
	inventory.Repository
	getFn func(context.Context, int64) (*inventory.Inventory, error)
}

func (s *invStub) GetByVariantID(ctx context.Context, id int64) (*inventory.Inventory, error) {
	if s.getFn != nil {
		return s.getFn(ctx, id)
	}
	return &inventory.Inventory{StockOnHand: 99, CommittedStock: 0}, nil
}

type variantStub struct {
	getFn func(context.Context, int64) (*variant.ProductVariant, error)
}

func (s *variantStub) GetByID(ctx context.Context, id int64) (*variant.ProductVariant, error) {
	if s.getFn != nil {
		return s.getFn(ctx, id)
	}
	return &variant.ProductVariant{ID: id, ProductID: 1, IsActive: true, Price: 10}, nil
}

type productStub struct {
	getFn func(context.Context, int64) (*product.Product, error)
}

func (s *productStub) GetByIDForAdmin(ctx context.Context, id int64) (*product.Product, error) {
	if s.getFn != nil {
		return s.getFn(ctx, id)
	}
	return &product.Product{ID: id, IsActive: true}, nil
}

type cartRepoStub struct {
	Repository
	getOrCreateFn func(context.Context, int64) (*Cart, error)
	getItemsFn    func(context.Context, int64) ([]CartItemResponse, error)
	addItemFn     func(context.Context, int64, AddCartItemReq) (*CartItem, error)
	updateItemFn  func(context.Context, int64, int64, UpdateCartItemReq) (*CartItem, error)
	removeItemFn  func(context.Context, int64, int64) error
}

func (s *cartRepoStub) GetOrCreate(ctx context.Context, userID int64) (*Cart, error) {
	if s.getOrCreateFn != nil {
		return s.getOrCreateFn(ctx, userID)
	}
	return &Cart{ID: 1}, nil
}

func (s *cartRepoStub) GetItems(ctx context.Context, cartID int64) ([]CartItemResponse, error) {
	if s.getItemsFn != nil {
		return s.getItemsFn(ctx, cartID)
	}
	return []CartItemResponse{}, nil
}

func (s *cartRepoStub) AddItem(ctx context.Context, cartID int64, req AddCartItemReq) (*CartItem, error) {
	if s.addItemFn != nil {
		return s.addItemFn(ctx, cartID, req)
	}
	return &CartItem{ID: 10, CartID: cartID, ProductVariantID: req.ProductVariantID, Quantity: req.Quantity}, nil
}

func (s *cartRepoStub) UpdateItem(ctx context.Context, cartID, itemID int64, req UpdateCartItemReq) (*CartItem, error) {
	if s.updateItemFn != nil {
		return s.updateItemFn(ctx, cartID, itemID, req)
	}
	return &CartItem{ID: itemID, CartID: cartID, Quantity: req.Quantity}, nil
}

func (s *cartRepoStub) RemoveItem(ctx context.Context, cartID, itemID int64) error {
	if s.removeItemFn != nil {
		return s.removeItemFn(ctx, cartID, itemID)
	}
	return nil
}

func TestService_EnsureAvailableUsesUncommittedStock(t *testing.T) {
	service := NewService(nil, nil, nil, &invStub{
		getFn: func(context.Context, int64) (*inventory.Inventory, error) {
			return &inventory.Inventory{StockOnHand: 5, CommittedStock: 5}, nil
		},
	}, nil)

	err := service.ensureAvailable(context.Background(), 14, 1)
	if !errors.Is(err, apperr.ErrOutOfStock) {
		t.Fatalf("ensureAvailable error = %v, want ErrOutOfStock", err)
	}
}

func TestService_GetRepoErrorIsInternal(t *testing.T) {
	t.Run("GetOrCreate", func(t *testing.T) {
		svc := NewService(&cartRepoStub{
			getOrCreateFn: func(context.Context, int64) (*Cart, error) {
				return nil, errSQL
			},
		}, nil, nil, &invStub{}, nil)

		got, err := svc.Get(context.Background(), 7)
		if got != nil {
			t.Fatalf("Get = %+v, want nil on repo error", got)
		}
		if !errors.Is(err, apperr.ErrInternal) {
			t.Fatalf("Get error = %v, want ErrInternal", err)
		}
	})

	t.Run("GetItems", func(t *testing.T) {
		svc := NewService(&cartRepoStub{
			getItemsFn: func(context.Context, int64) ([]CartItemResponse, error) {
				return nil, errSQL
			},
		}, nil, nil, &invStub{}, nil)

		got, err := svc.Get(context.Background(), 7)
		if got != nil {
			t.Fatalf("Get = %+v, want nil on repo error", got)
		}
		if !errors.Is(err, apperr.ErrInternal) {
			t.Fatalf("Get error = %v, want ErrInternal", err)
		}
	})
}

func TestService_AddItemRepoErrorIsInternal(t *testing.T) {
	t.Run("GetOrCreate", func(t *testing.T) {
		svc := NewService(&cartRepoStub{
			getOrCreateFn: func(context.Context, int64) (*Cart, error) {
				return nil, errSQL
			},
		}, &variantStub{}, &productStub{}, &invStub{}, nil)

		got, err := svc.AddItem(context.Background(), 7, AddCartItemReq{ProductVariantID: 19, Quantity: 1})
		if got != nil {
			t.Fatalf("AddItem = %+v, want nil on repo error", got)
		}
		if !errors.Is(err, apperr.ErrInternal) {
			t.Fatalf("AddItem error = %v, want ErrInternal", err)
		}
	})

	t.Run("GetItems", func(t *testing.T) {
		svc := NewService(&cartRepoStub{
			getItemsFn: func(context.Context, int64) ([]CartItemResponse, error) {
				return nil, errSQL
			},
		}, &variantStub{}, &productStub{}, &invStub{}, nil)

		got, err := svc.AddItem(context.Background(), 7, AddCartItemReq{ProductVariantID: 19, Quantity: 1})
		if got != nil {
			t.Fatalf("AddItem = %+v, want nil on repo error", got)
		}
		if !errors.Is(err, apperr.ErrInternal) {
			t.Fatalf("AddItem error = %v, want ErrInternal", err)
		}
	})

	t.Run("AddItem", func(t *testing.T) {
		svc := NewService(&cartRepoStub{
			addItemFn: func(context.Context, int64, AddCartItemReq) (*CartItem, error) {
				return nil, errSQL
			},
		}, &variantStub{}, &productStub{}, &invStub{}, nil)

		got, err := svc.AddItem(context.Background(), 7, AddCartItemReq{ProductVariantID: 19, Quantity: 1})
		if got != nil {
			t.Fatalf("AddItem = %+v, want nil on repo error", got)
		}
		if !errors.Is(err, apperr.ErrInternal) {
			t.Fatalf("AddItem error = %v, want ErrInternal", err)
		}
	})

	t.Run("variant lookup", func(t *testing.T) {
		svc := NewService(&cartRepoStub{}, &variantStub{
			getFn: func(context.Context, int64) (*variant.ProductVariant, error) {
				return nil, errSQL
			},
		}, &productStub{}, &invStub{}, nil)

		got, err := svc.AddItem(context.Background(), 7, AddCartItemReq{ProductVariantID: 19, Quantity: 1})
		if got != nil {
			t.Fatalf("AddItem = %+v, want nil on repo error", got)
		}
		if !errors.Is(err, apperr.ErrInternal) {
			t.Fatalf("AddItem error = %v, want ErrInternal", err)
		}
	})

	t.Run("parent lookup", func(t *testing.T) {
		svc := NewService(&cartRepoStub{}, &variantStub{}, &productStub{
			getFn: func(context.Context, int64) (*product.Product, error) {
				return nil, errSQL
			},
		}, &invStub{}, nil)

		got, err := svc.AddItem(context.Background(), 7, AddCartItemReq{ProductVariantID: 19, Quantity: 1})
		if got != nil {
			t.Fatalf("AddItem = %+v, want nil on repo error", got)
		}
		if !errors.Is(err, apperr.ErrInternal) {
			t.Fatalf("AddItem error = %v, want ErrInternal", err)
		}
	})
}

func TestService_AddItemTypedErrors(t *testing.T) {
	t.Run("variant not found", func(t *testing.T) {
		svc := NewService(&cartRepoStub{}, &variantStub{
			getFn: func(context.Context, int64) (*variant.ProductVariant, error) {
				return nil, models.ErrNotFound
			},
		}, &productStub{}, &invStub{}, nil)

		_, err := svc.AddItem(context.Background(), 7, AddCartItemReq{ProductVariantID: 19, Quantity: 1})
		if !errors.Is(err, apperr.ErrProductNotFound) {
			t.Fatalf("AddItem error = %v, want ErrProductNotFound", err)
		}
		if errors.Is(err, apperr.ErrInternal) {
			t.Fatal("known not-found must not map to ErrInternal")
		}
	})

	t.Run("inactive variant", func(t *testing.T) {
		svc := NewService(&cartRepoStub{}, &variantStub{
			getFn: func(context.Context, int64) (*variant.ProductVariant, error) {
				return &variant.ProductVariant{ID: 19, ProductID: 1, IsActive: false, Price: 10}, nil
			},
		}, &productStub{}, &invStub{}, nil)

		_, err := svc.AddItem(context.Background(), 7, AddCartItemReq{ProductVariantID: 19, Quantity: 1})
		if !errors.Is(err, apperr.ErrProductUnavailable) {
			t.Fatalf("AddItem error = %v, want ErrProductUnavailable", err)
		}
	})

	t.Run("inactive parent", func(t *testing.T) {
		added := false
		svc := NewService(&cartRepoStub{
			addItemFn: func(context.Context, int64, AddCartItemReq) (*CartItem, error) {
				added = true
				return nil, errors.New("AddItem must not be called")
			},
		}, &variantStub{
			getFn: func(context.Context, int64) (*variant.ProductVariant, error) {
				return &variant.ProductVariant{ID: 19, ProductID: 7, IsActive: true, Price: 10}, nil
			},
		}, &productStub{
			getFn: func(context.Context, int64) (*product.Product, error) {
				return &product.Product{ID: 7, IsActive: false}, nil
			},
		}, &invStub{}, nil)

		_, err := svc.AddItem(context.Background(), 7, AddCartItemReq{ProductVariantID: 19, Quantity: 1})
		if !errors.Is(err, apperr.ErrProductUnavailable) {
			t.Fatalf("AddItem error = %v, want ErrProductUnavailable", err)
		}
		if added {
			t.Fatal("AddItem repo must not be called when parent is inactive")
		}
	})

	t.Run("missing parent", func(t *testing.T) {
		svc := NewService(&cartRepoStub{
			addItemFn: func(context.Context, int64, AddCartItemReq) (*CartItem, error) {
				t.Fatal("AddItem repo must not be called when parent is missing")
				return nil, errors.New("unreachable")
			},
		}, &variantStub{
			getFn: func(context.Context, int64) (*variant.ProductVariant, error) {
				return &variant.ProductVariant{ID: 19, ProductID: 7, IsActive: true, Price: 10}, nil
			},
		}, &productStub{
			getFn: func(context.Context, int64) (*product.Product, error) {
				return nil, models.ErrNotFound
			},
		}, &invStub{}, nil)

		_, err := svc.AddItem(context.Background(), 7, AddCartItemReq{ProductVariantID: 19, Quantity: 1})
		if !errors.Is(err, apperr.ErrProductNotFound) {
			t.Fatalf("AddItem error = %v, want ErrProductNotFound", err)
		}
	})

	t.Run("active parent", func(t *testing.T) {
		svc := NewService(&cartRepoStub{}, &variantStub{}, &productStub{}, &invStub{}, nil)

		got, err := svc.AddItem(context.Background(), 7, AddCartItemReq{ProductVariantID: 19, Quantity: 1})
		if err != nil {
			t.Fatalf("AddItem error = %v, want nil", err)
		}
		if got == nil || got.ID != 1 {
			t.Fatalf("AddItem = %+v, want cart id 1", got)
		}
	})

	t.Run("inventory missing is out of stock", func(t *testing.T) {
		svc := NewService(&cartRepoStub{}, &variantStub{}, &productStub{}, &invStub{
			getFn: func(context.Context, int64) (*inventory.Inventory, error) {
				return nil, models.ErrNotFound
			},
		}, nil)

		_, err := svc.AddItem(context.Background(), 7, AddCartItemReq{ProductVariantID: 19, Quantity: 1})
		if !errors.Is(err, apperr.ErrOutOfStock) {
			t.Fatalf("AddItem error = %v, want ErrOutOfStock", err)
		}
	})

	t.Run("repo insufficient stock", func(t *testing.T) {
		svc := NewService(&cartRepoStub{
			addItemFn: func(context.Context, int64, AddCartItemReq) (*CartItem, error) {
				return nil, models.ErrInsufficientStock
			},
		}, &variantStub{}, &productStub{}, &invStub{}, nil)

		_, err := svc.AddItem(context.Background(), 7, AddCartItemReq{ProductVariantID: 19, Quantity: 1})
		if !errors.Is(err, apperr.ErrOutOfStock) {
			t.Fatalf("AddItem error = %v, want ErrOutOfStock", err)
		}
		if errors.Is(err, apperr.ErrInternal) {
			t.Fatal("known stock miss must not map to ErrInternal")
		}
	})
}

type recsStub struct {
	calls      int
	userID     int64
	productIDs []int64
	err        error
}

func (r *recsStub) RecordAddToCart(_ context.Context, userID, productID int64) error {
	r.calls++
	r.userID = userID
	r.productIDs = append(r.productIDs, productID)
	return r.err
}

func TestService_AddItemRecordsAddToCart(t *testing.T) {
	recs := &recsStub{}
	svc := NewService(&cartRepoStub{}, &variantStub{
		getFn: func(context.Context, int64) (*variant.ProductVariant, error) {
			return &variant.ProductVariant{ID: 19, ProductID: 7, IsActive: true, Price: 10}, nil
		},
	}, &productStub{}, &invStub{}, nil).WithInteractions(recs)

	if _, err := svc.AddItem(context.Background(), 3, AddCartItemReq{ProductVariantID: 19, Quantity: 1}); err != nil {
		t.Fatalf("AddItem: %v", err)
	}
	if recs.calls != 1 || recs.userID != 3 || len(recs.productIDs) != 1 || recs.productIDs[0] != 7 {
		t.Fatalf("recs = %+v; want 1 call user=3 product=7", recs)
	}
}

func TestService_AddItemRecsErrorDoesNotFailAdd(t *testing.T) {
	recs := &recsStub{err: errors.New("recs down")}
	svc := NewService(&cartRepoStub{}, &variantStub{}, &productStub{}, &invStub{}, nil).WithInteractions(recs)

	got, err := svc.AddItem(context.Background(), 7, AddCartItemReq{ProductVariantID: 19, Quantity: 1})
	if err != nil {
		t.Fatalf("AddItem must succeed when recs fail: %v", err)
	}
	if got == nil || got.ID != 1 {
		t.Fatalf("AddItem = %+v", got)
	}
	if recs.calls != 1 {
		t.Fatalf("recs calls = %d, want 1", recs.calls)
	}
}

func TestService_AddItemsRecordsAddToCartForAddedOnly(t *testing.T) {
	recs := &recsStub{}
	svc := NewService(&cartRepoStub{}, &variantStub{
		getFn: func(_ context.Context, id int64) (*variant.ProductVariant, error) {
			if id == 19 {
				return &variant.ProductVariant{ID: 19, ProductID: 7, IsActive: false, Price: 10}, nil
			}
			return &variant.ProductVariant{ID: id, ProductID: 8, IsActive: true, Price: 10}, nil
		},
	}, &productStub{}, &invStub{}, nil).WithInteractions(recs)

	got, err := svc.AddItems(context.Background(), 3, AddCartItemsReq{
		Items: []AddCartItemReq{
			{ProductVariantID: 19, Quantity: 1},
			{ProductVariantID: 20, Quantity: 1},
		},
	})
	if err != nil {
		t.Fatalf("AddItems: %v", err)
	}
	if got.Added != 1 {
		t.Fatalf("added = %d, want 1", got.Added)
	}
	if recs.calls != 1 || recs.productIDs[0] != 8 {
		t.Fatalf("recs = %+v; want 1 call product=8", recs)
	}
}

func TestService_AddItemsRepoErrorIsInternal(t *testing.T) {
	svc := NewService(&cartRepoStub{
		getOrCreateFn: func(context.Context, int64) (*Cart, error) {
			return nil, errSQL
		},
	}, &variantStub{}, &productStub{}, &invStub{}, nil)

	got, err := svc.AddItems(context.Background(), 7, AddCartItemsReq{
		Items: []AddCartItemReq{{ProductVariantID: 19, Quantity: 1}},
	})
	if got != nil {
		t.Fatalf("AddItems = %+v, want nil on repo error", got)
	}
	if !errors.Is(err, apperr.ErrInternal) {
		t.Fatalf("AddItems error = %v, want ErrInternal", err)
	}
}

func TestService_AddItemsSkipsInactiveParent(t *testing.T) {
	var added []int64
	svc := NewService(&cartRepoStub{
		addItemFn: func(_ context.Context, _ int64, req AddCartItemReq) (*CartItem, error) {
			added = append(added, req.ProductVariantID)
			return &CartItem{ID: req.ProductVariantID, CartID: 1, ProductVariantID: req.ProductVariantID, Quantity: req.Quantity}, nil
		},
	}, &variantStub{
		getFn: func(_ context.Context, id int64) (*variant.ProductVariant, error) {
			return &variant.ProductVariant{ID: id, ProductID: id, IsActive: true, Price: 10}, nil
		},
	}, &productStub{
		getFn: func(_ context.Context, id int64) (*product.Product, error) {
			return &product.Product{ID: id, IsActive: id != 19}, nil
		},
	}, &invStub{}, nil)

	got, err := svc.AddItems(context.Background(), 7, AddCartItemsReq{
		Items: []AddCartItemReq{
			{ProductVariantID: 19, Quantity: 1},
			{ProductVariantID: 20, Quantity: 1},
		},
	})
	if err != nil {
		t.Fatalf("AddItems error = %v, want nil", err)
	}
	if got == nil || got.Added != 1 {
		t.Fatalf("AddItems added = %+v, want 1", got)
	}
	if len(got.Skipped) != 1 || got.Skipped[0].ProductVariantID != 19 || got.Skipped[0].Reason != "unavailable" {
		t.Fatalf("AddItems skipped = %+v, want variant 19 unavailable", got.Skipped)
	}
	if len(added) != 1 || added[0] != 20 {
		t.Fatalf("AddItem repo calls = %v, want [20]", added)
	}
}

func TestService_UpdateRemoveTypedNotFound(t *testing.T) {
	svc := NewService(&cartRepoStub{
		getItemsFn: func(context.Context, int64) ([]CartItemResponse, error) {
			return []CartItemResponse{}, nil
		},
		removeItemFn: func(context.Context, int64, int64) error {
			return models.ErrNotFound
		},
	}, &variantStub{}, &productStub{}, &invStub{}, nil)

	_, err := svc.UpdateItem(context.Background(), 7, 99, UpdateCartItemReq{Quantity: 2})
	if !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("UpdateItem error = %v, want ErrNotFound", err)
	}

	_, err = svc.RemoveItem(context.Background(), 7, 99)
	if !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("RemoveItem error = %v, want ErrNotFound", err)
	}
}

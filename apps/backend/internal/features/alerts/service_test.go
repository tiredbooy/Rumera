package alerts

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/tiredbooy/internal/features/catalog/variant"
	"github.com/tiredbooy/internal/features/inventory"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

type listRepoStub struct {
	alerts []ProductAlert
	err    error
}

func (r *listRepoStub) Create(context.Context, ProductAlert) (*ProductAlert, error) {
	return nil, errors.New("listRepoStub.Create unused")
}

func (r *listRepoStub) ListByUser(context.Context, int64) ([]ProductAlert, error) {
	if r.err != nil {
		return nil, r.err
	}
	return r.alerts, nil
}

func (r *listRepoStub) Delete(context.Context, int64, int64) error {
	return errors.New("listRepoStub.Delete unused")
}

func (r *listRepoStub) FindPending(context.Context, int) ([]PendingAlert, error) {
	return nil, errors.New("listRepoStub.FindPending unused")
}

func (r *listRepoStub) MarkNotified(context.Context, []int64) error {
	return errors.New("listRepoStub.MarkNotified unused")
}

func TestListCopiesProductEnrichment(t *testing.T) {
	title := "بطری شیراز"
	slug := "shiraz-bottle"
	price := 450000.0
	created := time.Unix(1, 0).UTC()
	svc := NewService(&listRepoStub{
		alerts: []ProductAlert{{
			ID:               11,
			UserID:           7,
			ProductVariantID: 42,
			AlertType:        AlertPriceDrop,
			CreatedAt:        created,
			ProductTitle:     &title,
			ProductSlug:      &slug,
			CurrentPrice:     &price,
		}},
	}, nil, nil)

	out, err := svc.List(context.Background(), 7)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(out) != 1 {
		t.Fatalf("len(out) = %d, want 1", len(out))
	}
	got := out[0]
	if got.ID != 11 || got.ProductVariantID != 42 || got.AlertType != AlertPriceDrop {
		t.Fatalf("identity = %+v", got)
	}
	if got.ProductTitle == nil || *got.ProductTitle != title {
		t.Fatalf("product_title = %#v, want %q", got.ProductTitle, title)
	}
	if got.ProductSlug == nil || *got.ProductSlug != slug {
		t.Fatalf("product_slug = %#v, want %q", got.ProductSlug, slug)
	}
	if got.CurrentPrice == nil || *got.CurrentPrice != price {
		t.Fatalf("current_price = %#v, want %v", got.CurrentPrice, price)
	}
}

type createRepoStub struct {
	calls int
	alert *ProductAlert
	err   error
}

func (r *createRepoStub) Create(_ context.Context, a ProductAlert) (*ProductAlert, error) {
	r.calls++
	if r.err != nil {
		return nil, r.err
	}
	if r.alert != nil {
		return r.alert, nil
	}
	out := a
	out.ID = 1
	out.CreatedAt = time.Unix(1, 0).UTC()
	return &out, nil
}

func (r *createRepoStub) ListByUser(context.Context, int64) ([]ProductAlert, error) {
	return nil, errors.New("createRepoStub.ListByUser unused")
}

func (r *createRepoStub) Delete(context.Context, int64, int64) error {
	return errors.New("createRepoStub.Delete unused")
}

func (r *createRepoStub) FindPending(context.Context, int) ([]PendingAlert, error) {
	return nil, errors.New("createRepoStub.FindPending unused")
}

func (r *createRepoStub) MarkNotified(context.Context, []int64) error {
	return errors.New("createRepoStub.MarkNotified unused")
}

type variantGetStub struct {
	v   *variant.ProductVariant
	err error
}

func (s *variantGetStub) GetByID(context.Context, int64) (*variant.ProductVariant, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.v, nil
}

type invGetStub struct {
	inv *inventory.Inventory
	err error
}

func (s *invGetStub) GetByVariantID(context.Context, int64) (*inventory.Inventory, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.inv, nil
}

func TestCreateRestockFailsClosedWhenInventoryMissing(t *testing.T) {
	repo := &createRepoStub{}
	svc := NewService(repo, &variantGetStub{v: &variant.ProductVariant{ID: 42, Price: 100}}, &invGetStub{err: models.ErrNotFound})

	got, err := svc.Create(context.Background(), 7, CreateProductAlertReq{
		ProductVariantID: 42,
		AlertType:        AlertRestock,
	})
	if !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("Create = %v, %v; want ErrConflict", got, err)
	}
	if got != nil {
		t.Fatalf("Create returned %#v on inventory miss", got)
	}
	if repo.calls != 0 {
		t.Fatalf("alertRepo.Create called %d times; want 0", repo.calls)
	}
}

func TestCreateRestockFailsClosedWhenInventoryLookupErrors(t *testing.T) {
	repo := &createRepoStub{}
	svc := NewService(repo, &variantGetStub{v: &variant.ProductVariant{ID: 42, Price: 100}}, &invGetStub{err: errors.New("inventory down")})

	got, err := svc.Create(context.Background(), 7, CreateProductAlertReq{
		ProductVariantID: 42,
		AlertType:        AlertRestock,
	})
	if !errors.Is(err, apperr.ErrInternal) {
		t.Fatalf("Create = %v, %v; want ErrInternal", got, err)
	}
	if repo.calls != 0 {
		t.Fatalf("alertRepo.Create called %d times; want 0", repo.calls)
	}
}

func TestCreateRestockRejectsWhenInStock(t *testing.T) {
	repo := &createRepoStub{}
	svc := NewService(repo, &variantGetStub{v: &variant.ProductVariant{ID: 42, Price: 100}}, &invGetStub{
		inv: &inventory.Inventory{StockOnHand: 4, CommittedStock: 1},
	})

	got, err := svc.Create(context.Background(), 7, CreateProductAlertReq{
		ProductVariantID: 42,
		AlertType:        AlertRestock,
	})
	if !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("Create = %v, %v; want ErrConflict", got, err)
	}
	if repo.calls != 0 {
		t.Fatalf("alertRepo.Create called %d times; want 0", repo.calls)
	}
}

func TestCreateRestockSucceedsWhenOutOfStock(t *testing.T) {
	repo := &createRepoStub{}
	svc := NewService(repo, &variantGetStub{v: &variant.ProductVariant{ID: 42, Price: 250000}}, &invGetStub{
		inv: &inventory.Inventory{StockOnHand: 1, CommittedStock: 1},
	})

	got, err := svc.Create(context.Background(), 7, CreateProductAlertReq{
		ProductVariantID: 42,
		AlertType:        AlertRestock,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if repo.calls != 1 {
		t.Fatalf("alertRepo.Create called %d times; want 1", repo.calls)
	}
	if got == nil || got.ProductVariantID != 42 || got.AlertType != AlertRestock {
		t.Fatalf("Create = %#v", got)
	}
}

func TestCreatePriceDropSkipsInventory(t *testing.T) {
	repo := &createRepoStub{}
	svc := NewService(repo, &variantGetStub{v: &variant.ProductVariant{ID: 42, Price: 250000}}, &invGetStub{err: models.ErrNotFound})

	got, err := svc.Create(context.Background(), 7, CreateProductAlertReq{
		ProductVariantID: 42,
		AlertType:        AlertPriceDrop,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if repo.calls != 1 {
		t.Fatalf("alertRepo.Create called %d times; want 1", repo.calls)
	}
	if got == nil || got.AlertType != AlertPriceDrop {
		t.Fatalf("Create = %#v", got)
	}
}

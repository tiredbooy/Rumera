package cart

import (
	"context"
	"errors"
	"testing"

	"github.com/tiredbooy/internal/features/inventory"
	"github.com/tiredbooy/pkg/apperr"
)

type invStub struct {
	inventory.Repository
	getFn func(context.Context, int64) (*inventory.Inventory, error)
}

func (s *invStub) GetByVariantID(ctx context.Context, id int64) (*inventory.Inventory, error) {
	if s.getFn != nil {
		return s.getFn(ctx, id)
	}
	return nil, nil
}

func TestService_EnsureAvailableUsesUncommittedStock(t *testing.T) {
	service := NewService(nil, nil, &invStub{
		getFn: func(context.Context, int64) (*inventory.Inventory, error) {
			return &inventory.Inventory{StockOnHand: 5, CommittedStock: 5}, nil
		},
	}, nil)

	err := service.ensureAvailable(context.Background(), 14, 1)
	if !errors.Is(err, apperr.ErrOutOfStock) {
		t.Fatalf("ensureAvailable error = %v, want ErrOutOfStock", err)
	}
}

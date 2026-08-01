package services

import (
	"context"
	"errors"
	"testing"

	"github.com/tiredbooy/internal/mocks"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

func TestCartServiceEnsureAvailableUsesUncommittedStock(t *testing.T) {
	service := NewCartService(nil, nil, &mocks.InventoryRepo{
		GetByVariantFn: func(context.Context, int64) (*models.Inventory, error) {
			return &models.Inventory{StockOnHand: 5, CommittedStock: 5}, nil
		},
	}, nil)

	err := service.ensureAvailable(context.Background(), 14, 1)
	if !errors.Is(err, apperr.ErrOutOfStock) {
		t.Fatalf("ensureAvailable error = %v, want ErrOutOfStock", err)
	}
}

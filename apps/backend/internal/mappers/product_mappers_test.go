package mappers

import (
	"testing"

	"github.com/tiredbooy/internal/models"
)

func TestToVariantResponseMapsOptionalAvailableStock(t *testing.T) {
	stock := 4
	response := ToVariantResponse(
		&models.ProductVariant{ID: 12, Price: 250, IsActive: true},
		nil,
		nil,
		&stock,
	)

	if response.AvailableStock == nil || *response.AvailableStock != 4 {
		t.Fatalf("available stock = %v; want 4", response.AvailableStock)
	}

	generic := ToVariantResponse(&models.ProductVariant{ID: 12}, nil, nil, nil)
	if generic.AvailableStock != nil {
		t.Fatalf("generic available stock = %v; want nil", generic.AvailableStock)
	}
}

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
	if generic.Options == nil || generic.Images == nil {
		t.Fatalf("generic hydrated arrays = options:%v images:%v; want empty arrays", generic.Options, generic.Images)
	}

	detail := ToProductDetail(&models.Product{ID: 5}, nil, nil, nil)
	if detail.Images == nil || detail.Variants == nil {
		t.Fatalf("product detail arrays = images:%v variants:%v; want empty arrays", detail.Images, detail.Variants)
	}
}

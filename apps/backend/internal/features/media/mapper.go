package media

import "github.com/tiredbooy/internal/models"

// ToImageResponse projects a product image row to the public wire shape.
// Shared with catalog product handlers via models.ImageResponse.
func ToImageResponse(i *models.ProductImage) models.ImageResponse {
	return models.ImageResponse{
		ID:         i.ID,
		ImageURL:   i.ImageURL,
		StorageKey: i.StorageKey,
		AltText:    i.AltText,
		SortOrder:  i.SortOrder,
		IsPrimary:  i.IsPrimary,
		Width:      i.Width,
		Height:     i.Height,
	}
}

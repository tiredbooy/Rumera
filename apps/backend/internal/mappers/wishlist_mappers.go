package mappers

import "github.com/tiredbooy/internal/models"

func ToWishlistResponse(w *models.Wishlist, items []models.WishlistItemResponse) models.WishlistResponse {
	return models.WishlistResponse{
		ID:    w.ID,
		Items: items,
		Total: len(items),
	}
}

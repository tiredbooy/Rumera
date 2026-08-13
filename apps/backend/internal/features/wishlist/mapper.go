package wishlist

// ToResponse builds the public wishlist envelope.
func ToResponse(w *Wishlist, items []ItemResponse) Response {
	if items == nil {
		items = []ItemResponse{}
	}
	return Response{
		ID:    w.ID,
		Items: items,
		Total: len(items),
	}
}

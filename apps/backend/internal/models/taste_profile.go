package models

// TasteProfile is returned by GET/PUT /me/taste-profile and stored as JSONB.
// Slice fields intentionally have no omitempty tag: an empty profile exposes
// them as required nullable JSON properties rather than silently omitting them.
type TasteProfile struct {
	Categories []string `json:"categories"`
	BudgetMax  float64  `json:"budget_max"`
	Flavor     []string `json:"flavor"`
	Occasions  []string `json:"occasions"`
}

// UpdateTasteProfileInput is the public PUT /me/taste-profile body. The PUT
// replaces the stored JSON document; omitted and null values decode to their
// Go zero values.
type UpdateTasteProfileInput struct {
	Categories []string `json:"categories" validate:"omitempty,dive,oneof=Whisky Wine Champagne Gin Rum Tequila Vodka"`
	BudgetMax  float64  `json:"budget_max" validate:"omitempty,min=0"`
	Flavor     []string `json:"flavor" validate:"omitempty,max=12,dive,max=40"`
	Occasions  []string `json:"occasions" validate:"omitempty,max=12,dive,max=40"`
}

func (input UpdateTasteProfileInput) TasteProfile() TasteProfile {
	return TasteProfile{
		Categories: input.Categories,
		BudgetMax:  input.BudgetMax,
		Flavor:     input.Flavor,
		Occasions:  input.Occasions,
	}
}

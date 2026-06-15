package models

// TastePrefs is the self-declared taste preference payload captured by the
// onboarding quiz. It is both the request body and the response shape; the DB
// stores it verbatim as JSONB.
type TastePrefs struct {
	// Categories are catalogue category names the customer favours.
	Categories []string `json:"categories" validate:"omitempty,dive,oneof=Whisky Wine Champagne Gin Rum Tequila Vodka"`
	// BudgetMax is the customer's comfortable ceiling per bottle, in Toman (0 = no limit).
	BudgetMax float64 `json:"budget_max" validate:"omitempty,min=0"`
	// Flavor / Occasions are free-form display tags used to enrich suggestions.
	Flavor    []string `json:"flavor"    validate:"omitempty,max=12,dive,max=40"`
	Occasions []string `json:"occasions" validate:"omitempty,max=12,dive,max=40"`
}

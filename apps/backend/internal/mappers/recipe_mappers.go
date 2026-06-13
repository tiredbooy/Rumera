package mappers

import "github.com/tiredbooy/internal/models"

func ToRecipeResponse(r *models.Recipe) models.RecipeResponse {
	return models.RecipeResponse{
		ID:              r.ID,
		Title:           r.Title,
		Slug:            r.Slug,
		Description:     r.Description,
		Content:         r.Content,
		Difficulty:      r.Difficulty,
		PrepTimeMinutes: r.PrepTimeMinutes,
		CookTimeMinutes: r.CookTimeMinutes,
		Servings:        r.Servings,
		ImageURL:        r.ImageURL,
		UserID:          r.UserID,
		CreatedAt:       r.CreatedAt,
		UpdatedAt:       r.UpdatedAt,
	}
}

func ToRecipeResponses(rs []*models.Recipe) []models.RecipeResponse {
	out := make([]models.RecipeResponse, len(rs))
	for i, r := range rs {
		out[i] = ToRecipeResponse(r)
	}
	return out
}

func ToRecipeIngredientResponse(i *models.RecipeIngredient) models.RecipeIngredientResponse {
	return models.RecipeIngredientResponse{
		ID:               i.ID,
		ProductVariantID: i.ProductVariantID,
		IngredientName:   i.IngredientName,
		Quantity:         i.Quantity,
		Unit:             i.Unit,
		Optional:         i.Optional,
		Notes:            i.Notes,
		SortOrder:        i.SortOrder,
	}
}

func ToRecipeIngredientResponses(ingredients []*models.RecipeIngredient) []models.RecipeIngredientResponse {
	out := make([]models.RecipeIngredientResponse, len(ingredients))
	for i, ing := range ingredients {
		out[i] = ToRecipeIngredientResponse(ing)
	}
	return out
}

func ToRecipeProductResponse(p *models.RecipeProduct) models.RecipeProductResponse {
	return models.RecipeProductResponse{
		ID:               p.ID,
		ProductVariantID: p.ProductVariantID,
		Quantity:         p.Quantity,
		Unit:             p.Unit,
	}
}

func ToRecipeProductResponses(products []*models.RecipeProduct) []models.RecipeProductResponse {
	out := make([]models.RecipeProductResponse, len(products))
	for i, p := range products {
		out[i] = ToRecipeProductResponse(p)
	}
	return out
}

func ToRecipeDetailResponse(
	r *models.Recipe,
	ingredients []*models.RecipeIngredient,
	products []*models.RecipeProduct,
	tagIDs []int64,
) models.RecipeDetailResponse {
	return models.RecipeDetailResponse{
		RecipeResponse: ToRecipeResponse(r),
		Ingredients:    ToRecipeIngredientResponses(ingredients),
		Products:       ToRecipeProductResponses(products),
		TagIDs:         tagIDs,
	}
}

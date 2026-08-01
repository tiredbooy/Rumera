package mappers

import (
	"fmt"

	"github.com/shopspring/decimal"
	"github.com/tiredbooy/internal/models"
)

func ToRecipeResponse(r *models.Recipe) models.RecipeResponse {
	return models.RecipeResponse{
		ID:                r.ID,
		Title:             r.Title,
		Slug:              r.Slug,
		Excerpt:           r.Excerpt,
		Description:       r.Description,
		Content:           r.Content,
		Difficulty:        r.Difficulty,
		PrepTimeMinutes:   r.PrepTimeMinutes,
		CookTimeMinutes:   r.CookTimeMinutes,
		TotalTimeMinutes:  r.TotalTimeMinutes,
		Servings:          r.Servings,
		Calories:          r.Calories,
		CocktailType:      r.CocktailType,
		GlassType:         r.GlassType,
		ServingSuggestion: r.ServingSuggestion,
		ImageURL:          r.ImageURL,
		ImageAlt:          r.ImageAlt,
		Status:            r.Status,
		IsFeatured:        r.IsFeatured,
		PublishedAt:       r.PublishedAt,
		ViewCount:         r.ViewCount,
		MetaTitle:         r.MetaTitle,
		MetaDescription:   r.MetaDescription,
		MetaKeywords:      r.MetaKeywords,
		CanonicalURL:      r.CanonicalURL,
		OGImageURL:        r.OGImageURL,
		UserID:            r.UserID,
		CreatedAt:         r.CreatedAt,
		UpdatedAt:         r.UpdatedAt,
	}
}

func ToRecipeResponses(rs []*models.Recipe) []models.RecipeResponse {
	out := make([]models.RecipeResponse, len(rs))
	for i, r := range rs {
		out[i] = ToRecipeResponse(r)
	}
	return out
}

func ToRecipeListItem(r *models.Recipe) models.RecipeListItem {
	return models.RecipeListItem{
		ID:               r.ID,
		Title:            r.Title,
		Slug:             r.Slug,
		Excerpt:          r.Excerpt,
		Difficulty:       r.Difficulty,
		TotalTimeMinutes: r.TotalTimeMinutes,
		Servings:         r.Servings,
		ImageURL:         r.ImageURL,
		ImageAlt:         r.ImageAlt,
		CocktailType:     r.CocktailType,
		IsFeatured:       r.IsFeatured,
		ViewCount:        r.ViewCount,
		PublishedAt:      r.PublishedAt,
	}
}

func ToRecipeListItems(rs []*models.Recipe) []models.RecipeListItem {
	out := make([]models.RecipeListItem, len(rs))
	for i, r := range rs {
		out[i] = ToRecipeListItem(r)
	}
	return out
}

func ToRecipeAdminListItem(r *models.Recipe) models.RecipeAdminListItem {
	return models.RecipeAdminListItem{
		RecipeListItem: ToRecipeListItem(r),
		Status:         r.Status,
		CreatedAt:      r.CreatedAt,
		UpdatedAt:      r.UpdatedAt,
	}
}

func ToRecipeAdminListItems(rs []*models.Recipe) []models.RecipeAdminListItem {
	out := make([]models.RecipeAdminListItem, len(rs))
	for i, r := range rs {
		out[i] = ToRecipeAdminListItem(r)
	}
	return out
}

func ToRecipeIngredientResponse(i *models.RecipeIngredient) models.RecipeIngredientResponse {
	return models.RecipeIngredientResponse{
		ID:               i.ID,
		ProductVariantID: i.ProductVariantID,
		IngredientName:   i.IngredientName,
		Quantity:         decimalString(i.Quantity),
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

func ToShoppableProductResponses(products []*models.ShoppableProduct) []models.ShoppableProductResponse {
	out := make([]models.ShoppableProductResponse, len(products))
	for i, p := range products {
		out[i] = models.ShoppableProductResponse{
			RecipeProductID:  p.RecipeProductID,
			ProductVariantID: p.ProductVariantID,
			ProductID:        p.ProductID,
			ProductTitle:     p.ProductTitle,
			ProductSlug:      p.ProductSlug,
			Brand:            p.Brand,
			SKU:              p.SKU,
			Price:            p.Price,
			CompareAtPrice:   p.CompareAtPrice,
			ImageURL:         p.ImageURL,
			AvailableStock:   p.AvailableStock,
			IsAvailable:      p.IsAvailable,
			Quantity:         decimalString(p.Quantity),
			Unit:             p.Unit,
			SortOrder:        p.SortOrder,
			IsPrimary:        p.IsPrimary,
			Role:             p.Role,
		}
	}
	return out
}

func decimalString(value *decimal.Decimal) *string {
	if value == nil {
		return nil
	}
	formatted := value.String()
	return &formatted
}

func ToRecipeTagInfos(tags []*models.RecipeTagInfo) []models.RecipeTagInfo {
	out := make([]models.RecipeTagInfo, len(tags))
	for i, t := range tags {
		out[i] = *t
	}
	return out
}

func ToRecipeDetailResponse(
	r *models.Recipe,
	ingredients []*models.RecipeIngredient,
	products []*models.ShoppableProduct,
	tags []*models.RecipeTagInfo,
) models.RecipeDetailResponse {
	detail := models.RecipeDetailResponse{
		RecipeResponse: ToRecipeResponse(r),
		Ingredients:    ToRecipeIngredientResponses(ingredients),
		Products:       ToShoppableProductResponses(products),
		Tags:           ToRecipeTagInfos(tags),
	}
	detail.StructuredData = BuildRecipeJSONLD(r, ingredients)
	return detail
}

// BuildRecipeJSONLD produces a schema.org/Recipe object (as a generic map ready
// for JSON serialisation). Embedding this on the recipe page lets search engines
// render rich results (cook time, ingredients, ratings) — a direct SEO win.
func BuildRecipeJSONLD(r *models.Recipe, ingredients []*models.RecipeIngredient) map[string]any {
	ld := map[string]any{
		"@context":    "https://schema.org/",
		"@type":       "Recipe",
		"name":        r.Title,
		"recipeYield": r.Servings,
	}

	if r.Description != nil && *r.Description != "" {
		ld["description"] = *r.Description
	} else if r.Excerpt != nil {
		ld["description"] = *r.Excerpt
	}
	if r.OGImageURL != nil {
		ld["image"] = *r.OGImageURL
	} else if r.ImageURL != nil {
		ld["image"] = *r.ImageURL
	}
	if r.PublishedAt != nil {
		ld["datePublished"] = r.PublishedAt.Format("2006-01-02")
	}
	if r.CocktailType != nil {
		ld["recipeCategory"] = *r.CocktailType
	}
	if r.PrepTimeMinutes > 0 {
		ld["prepTime"] = isoDuration(r.PrepTimeMinutes)
	}
	if r.CookTimeMinutes > 0 {
		ld["cookTime"] = isoDuration(r.CookTimeMinutes)
	}
	if r.TotalTimeMinutes > 0 {
		ld["totalTime"] = isoDuration(r.TotalTimeMinutes)
	}
	if r.Calories != nil {
		ld["nutrition"] = map[string]any{
			"@type":    "NutritionInformation",
			"calories": fmt.Sprintf("%d calories", *r.Calories),
		}
	}
	if len(ingredients) > 0 {
		list := make([]string, 0, len(ingredients))
		for _, ing := range ingredients {
			line := ing.IngredientName
			if ing.Quantity != nil {
				if ing.Unit != nil {
					line = fmt.Sprintf("%s %s %s", ing.Quantity.String(), *ing.Unit, ing.IngredientName)
				} else {
					line = fmt.Sprintf("%s %s", ing.Quantity.String(), ing.IngredientName)
				}
			}
			list = append(list, line)
		}
		ld["recipeIngredient"] = list
	}
	if r.Content != "" {
		ld["recipeInstructions"] = r.Content
	}

	return ld
}

// isoDuration renders minutes as an ISO-8601 duration (e.g. PT15M / PT1H30M)
// which is what schema.org/Recipe expects for time fields.
func isoDuration(minutes int) string {
	if minutes <= 0 {
		return "PT0M"
	}
	h := minutes / 60
	m := minutes % 60
	switch {
	case h > 0 && m > 0:
		return fmt.Sprintf("PT%dH%dM", h, m)
	case h > 0:
		return fmt.Sprintf("PT%dH", h)
	default:
		return fmt.Sprintf("PT%dM", m)
	}
}

package mappers

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/shopspring/decimal"
	"github.com/tiredbooy/internal/models"
)

func TestRecipeDecimalQuantitiesMarshalAsStrings(t *testing.T) {
	quantity := decimal.RequireFromString("1.25")
	detail := ToRecipeDetailResponse(
		&models.Recipe{},
		[]*models.RecipeIngredient{{Quantity: &quantity}},
		[]*models.ShoppableProduct{{Quantity: &quantity}},
		nil,
	)

	body, err := json.Marshal(detail)
	if err != nil {
		t.Fatalf("marshal recipe detail: %v", err)
	}
	if count := strings.Count(string(body), `"quantity":"1.25"`); count != 2 {
		t.Fatalf("expected both quantities to be JSON strings, got %s", body)
	}
}

func TestRecipeAdminListItemIncludesWorkflowStatus(t *testing.T) {
	item := ToRecipeAdminListItem(&models.Recipe{Status: models.RecipeStatusArchived})
	if item.Status != models.RecipeStatusArchived {
		t.Fatalf("expected archived status, got %q", item.Status)
	}
}

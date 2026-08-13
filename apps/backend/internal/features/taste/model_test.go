package taste

import (
	"encoding/json"
	"testing"
)

func TestTasteProfileZeroValueJSONContract(t *testing.T) {
	got, err := json.Marshal(TasteProfile{})
	if err != nil {
		t.Fatalf("marshal TasteProfile: %v", err)
	}

	want := `{"categories":null,"budget_max":0,"flavor":null,"occasions":null}`
	if string(got) != want {
		t.Fatalf("TasteProfile JSON = %s, want %s", got, want)
	}
}

func TestUpdateTasteProfileInputMapsToProfile(t *testing.T) {
	input := UpdateTasteProfileInput{
		Categories: []string{"Wine"},
		BudgetMax:  5_000_000,
		Flavor:     []string{"dry"},
		Occasions:  []string{"gift"},
	}

	profile := input.TasteProfile()
	if profile.Categories[0] != "Wine" || profile.BudgetMax != 5_000_000 {
		t.Fatalf("TasteProfile() = %#v", profile)
	}
}

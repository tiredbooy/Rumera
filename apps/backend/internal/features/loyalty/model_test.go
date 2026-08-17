package loyalty

import (
	"encoding/json"
	"testing"
	"time"
)

func TestMemberFilterDefaults(t *testing.T) {
	filter := MemberFilter{Q: "  a@  ", Tier: " Silver ", SortBy: "popular"}
	filter.Defaults()
	if filter.Q != "a@" || filter.Tier != "silver" {
		t.Fatalf("trimmed = %+v", filter)
	}
	if filter.SortBy != "updated_at" || filter.OrderBy != "desc" {
		t.Fatalf("default sort = %+v", filter)
	}

	filter = MemberFilter{SortBy: "points_balance", OrderBy: "ASC"}
	filter.Defaults()
	if filter.SortBy != "points_balance" || filter.OrderBy != "asc" {
		t.Fatalf("kept sort = %+v", filter)
	}
}

func TestTierForCustomThresholds(t *testing.T) {
	tiers := []ProgrammeTier{
		{ID: "bronze", MinLifetimePoints: 0},
		{ID: "silver", MinLifetimePoints: 100},
		{ID: "gold", MinLifetimePoints: 250},
		{ID: "cellar", MinLifetimePoints: 400},
	}
	if got := TierForTiers(99, tiers); got != TierBronze {
		t.Fatalf("99 = %s", got)
	}
	if got := TierForTiers(100, tiers); got != TierSilver {
		t.Fatalf("100 = %s", got)
	}
	if got := TierForTiers(400, tiers); got != TierCellar {
		t.Fatalf("400 = %s", got)
	}
}

func TestTierFor(t *testing.T) {
	tests := []struct {
		name     string
		lifetime int
		want     LoyaltyTier
	}{
		{name: "bronze", lifetime: 999, want: TierBronze},
		{name: "silver", lifetime: 1000, want: TierSilver},
		{name: "gold", lifetime: 5000, want: TierGold},
		{name: "cellar", lifetime: 20000, want: TierCellar},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := TierFor(tt.lifetime); got != tt.want {
				t.Fatalf("TierFor(%d) = %q, want %q", tt.lifetime, got, tt.want)
			}
		})
	}
}

func TestLoyaltyAccountResponseJSON(t *testing.T) {
	tests := []struct {
		name string
		in   LoyaltyResponse
		want string
	}{
		{
			name: "includes next tier",
			in: LoyaltyResponse{
				PointsBalance:  12,
				LifetimePoints: 20,
				Tier:           TierBronze,
				NextTier:       TierSilver,
				PointsToNext:   980,
				RedeemValue:    1000,
			},
			want: `{"points_balance":12,"lifetime_points":20,"tier":"bronze","next_tier":"silver","points_to_next":980,"redeem_value":1000}`,
		},
		{
			name: "omits next tier at cellar",
			in: LoyaltyResponse{
				PointsBalance:  100,
				LifetimePoints: 20000,
				Tier:           TierCellar,
				PointsToNext:   0,
				RedeemValue:    500,
			},
			want: `{"points_balance":100,"lifetime_points":20000,"tier":"cellar","points_to_next":0,"redeem_value":500}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := json.Marshal(tt.in)
			if err != nil {
				t.Fatalf("marshal loyalty account: %v", err)
			}
			if string(got) != tt.want {
				t.Fatalf("JSON = %s, want %s", got, tt.want)
			}
		})
	}
}

func TestLoyaltyTransactionResponseJSON(t *testing.T) {
	createdAt := time.Date(2026, time.July, 13, 10, 30, 0, 0, time.UTC)
	got, err := json.Marshal(LoyaltyTransactionResponse{
		ID:        42,
		Delta:     -25,
		Reason:    LoyaltyReasonRedeem,
		RefType:   "redeem",
		RefID:     "5:idem:abc",
		CreatedAt: createdAt,
	})
	if err != nil {
		t.Fatalf("marshal loyalty transaction: %v", err)
	}
	want := `{"id":42,"delta":-25,"reason":"redeem","ref_type":"redeem","ref_id":"5:idem:abc","created_at":"2026-07-13T10:30:00Z"}`
	if string(got) != want {
		t.Fatalf("JSON = %s, want %s", got, want)
	}
}

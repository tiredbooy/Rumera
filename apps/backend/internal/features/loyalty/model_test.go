package loyalty

import (
	"encoding/json"
	"testing"
	"time"
)

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
			},
			want: `{"points_balance":12,"lifetime_points":20,"tier":"bronze","next_tier":"silver","points_to_next":980}`,
		},
		{
			name: "omits next tier at cellar",
			in: LoyaltyResponse{
				PointsBalance:  100,
				LifetimePoints: 20000,
				Tier:           TierCellar,
				PointsToNext:   0,
			},
			want: `{"points_balance":100,"lifetime_points":20000,"tier":"cellar","points_to_next":0}`,
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
		Delta:     -25,
		Reason:    LoyaltyReasonRedeem,
		CreatedAt: createdAt,
	})
	if err != nil {
		t.Fatalf("marshal loyalty transaction: %v", err)
	}
	want := `{"delta":-25,"reason":"redeem","created_at":"2026-07-13T10:30:00Z"}`
	if string(got) != want {
		t.Fatalf("JSON = %s, want %s", got, want)
	}
}

//go:build integration

package integration

import (
	"github.com/tiredbooy/internal/features/giftcard"
	"context"
	"errors"
	"testing"

	"github.com/shopspring/decimal"
	"github.com/tiredbooy/internal/models"
)

func TestGiftCardCreateBatchIsAtomic(t *testing.T) {
	requireDB(t)
	resetTables(t, "gift_cards")
	ctx := context.Background()
	repo := giftcard.NewRepository(testPool)
	amount := decimal.RequireFromString("125000.50")

	duplicate := "ABCD-EFGH-JKLM-NPQR"
	if _, err := repo.CreateBatch(ctx, []string{duplicate, duplicate}, amount); !errors.Is(err, models.ErrConflict) {
		t.Fatalf("duplicate batch error = %v, want ErrConflict", err)
	}
	var count int
	if err := testPool.QueryRow(ctx, `SELECT COUNT(*) FROM gift_cards WHERE code = $1`, duplicate).Scan(&count); err != nil {
		t.Fatalf("count rolled-back cards: %v", err)
	}
	if count != 0 {
		t.Fatalf("cards persisted after failed batch = %d, want 0", count)
	}

	codes := []string{
		"ABCD-EFGH-JKLM-NPQR",
		"RSTU-VWXY-2345-6789",
	}
	cards, err := repo.CreateBatch(ctx, codes, amount)
	if err != nil {
		t.Fatalf("CreateBatch: %v", err)
	}
	if len(cards) != len(codes) {
		t.Fatalf("created cards = %d, want %d", len(cards), len(codes))
	}
	if err := testPool.QueryRow(ctx, `SELECT COUNT(*) FROM gift_cards`).Scan(&count); err != nil {
		t.Fatalf("count committed cards: %v", err)
	}
	if count != len(codes) {
		t.Fatalf("committed cards = %d, want %d", count, len(codes))
	}
}

package services

import (
	"context"
	"errors"
	"regexp"
	"testing"
	"time"

	"github.com/shopspring/decimal"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

type giftCardBatchRepo struct {
	createCalls int
	createFn    func(codes []string, amount decimal.Decimal) ([]models.GiftCard, error)
}

func (r *giftCardBatchRepo) CreateBatch(_ context.Context, codes []string, amount decimal.Decimal) ([]models.GiftCard, error) {
	r.createCalls++
	if r.createFn != nil {
		return r.createFn(codes, amount)
	}
	cards := make([]models.GiftCard, len(codes))
	for i, code := range codes {
		cards[i] = models.GiftCard{
			ID:            int64(i + 1),
			Code:          code,
			InitialAmount: amount,
			Status:        models.GiftCardStatusActive,
			CreatedAt:     time.Date(2026, time.July, 29, 12, 0, 0, 0, time.UTC),
		}
	}
	return cards, nil
}

func (r *giftCardBatchRepo) RedeemAndCredit(context.Context, string, int64, string) (decimal.Decimal, error) {
	return decimal.Zero, nil
}

func TestGiftCardIssueCreatesTheCompleteBatchInOneRepositoryCall(t *testing.T) {
	repo := &giftCardBatchRepo{}
	service := NewGiftCardService(repo, nil)
	amount := decimal.RequireFromString("125000.50")

	cards, err := service.Issue(context.Background(), amount, 4)
	if err != nil {
		t.Fatalf("Issue: %v", err)
	}
	if repo.createCalls != 1 {
		t.Fatalf("CreateBatch calls = %d, want 1", repo.createCalls)
	}
	if len(cards) != 4 {
		t.Fatalf("issued cards = %d, want 4", len(cards))
	}

	codePattern := regexp.MustCompile(`^[A-HJ-NP-Z2-9]{4}(?:-[A-HJ-NP-Z2-9]{4}){3}$`)
	seen := make(map[string]struct{}, len(cards))
	for _, card := range cards {
		if !codePattern.MatchString(card.Code) {
			t.Fatalf("code %q does not match the gift-card format", card.Code)
		}
		if _, duplicate := seen[card.Code]; duplicate {
			t.Fatalf("duplicate generated code %q", card.Code)
		}
		seen[card.Code] = struct{}{}
		if !card.InitialAmount.Equal(amount) || card.Status != models.GiftCardStatusActive {
			t.Fatalf("unexpected issued card: %#v", card)
		}
	}
}

func TestGiftCardIssueDefaultsToOneAndRejectsOversizedBatches(t *testing.T) {
	repo := &giftCardBatchRepo{}
	service := NewGiftCardService(repo, nil)
	amount := decimal.NewFromInt(100)

	cards, err := service.Issue(context.Background(), amount, 0)
	if err != nil || len(cards) != 1 {
		t.Fatalf("default issuance = (%d, %v), want one card", len(cards), err)
	}
	if _, err := service.Issue(context.Background(), amount, maxGiftCardBatchSize+1); !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("oversized batch error = %v, want ErrInvalidRequest", err)
	}
	if repo.createCalls != 1 {
		t.Fatalf("CreateBatch calls = %d, oversized batch must not reach repository", repo.createCalls)
	}
}

func TestGiftCardIssueRetriesAnAtomicCollision(t *testing.T) {
	repo := &giftCardBatchRepo{}
	repo.createFn = func(codes []string, amount decimal.Decimal) ([]models.GiftCard, error) {
		if repo.createCalls == 1 {
			return nil, models.ErrConflict
		}
		cards := make([]models.GiftCard, len(codes))
		for i, code := range codes {
			cards[i] = models.GiftCard{Code: code, InitialAmount: amount, Status: models.GiftCardStatusActive}
		}
		return cards, nil
	}
	service := NewGiftCardService(repo, nil)

	cards, err := service.Issue(context.Background(), decimal.NewFromInt(100), 3)
	if err != nil {
		t.Fatalf("Issue after collision: %v", err)
	}
	if repo.createCalls != 2 || len(cards) != 3 {
		t.Fatalf("retry result = calls %d, cards %d; want 2 and 3", repo.createCalls, len(cards))
	}
}

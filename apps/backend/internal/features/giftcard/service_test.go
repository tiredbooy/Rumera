package giftcard

import (
	"context"
	"errors"
	"regexp"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/shopspring/decimal"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

type giftCardBatchRepo struct {
	createCalls int
	createFn    func(codes []string, amount decimal.Decimal) ([]GiftCard, error)
	redeemErr   error
	redeemAmt   decimal.Decimal
}

func (r *giftCardBatchRepo) CreateBatch(_ context.Context, codes []string, amount decimal.Decimal) ([]GiftCard, error) {
	r.createCalls++
	if r.createFn != nil {
		return r.createFn(codes, amount)
	}
	cards := make([]GiftCard, len(codes))
	for i, code := range codes {
		cards[i] = GiftCard{
			ID:            int64(i + 1),
			Code:          code,
			InitialAmount: amount,
			Status:        GiftCardStatusActive,
			CreatedAt:     time.Date(2026, time.July, 29, 12, 0, 0, 0, time.UTC),
		}
	}
	return cards, nil
}

func (r *giftCardBatchRepo) RedeemAndCredit(context.Context, string, int64, string) (decimal.Decimal, error) {
	if r.redeemErr != nil {
		return decimal.Zero, r.redeemErr
	}
	if r.redeemAmt.IsZero() {
		return decimal.Zero, nil
	}
	return r.redeemAmt, nil
}
func (r *giftCardBatchRepo) GetByPurchaseTxID(context.Context, string) (*GiftCard, error) {
	return nil, models.ErrNotFound
}
func (r *giftCardBatchRepo) InsertPurchasedTx(context.Context, pgx.Tx, string, decimal.Decimal, int64, string) (*GiftCard, error) {
	return nil, models.ErrNotFound
}
func (r *giftCardBatchRepo) ListByPurchaser(context.Context, int64, int) ([]GiftCard, error) {
	return nil, nil
}

func TestGiftCardIssueCreatesTheCompleteBatchInOneRepositoryCall(t *testing.T) {
	repo := &giftCardBatchRepo{}
	service := NewService(repo, nil)
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
		if !card.InitialAmount.Equal(amount) || card.Status != GiftCardStatusActive {
			t.Fatalf("unexpected issued card: %#v", card)
		}
	}
}

func TestGiftCardRedeemUnknownCodeIsClearContract(t *testing.T) {
	repo := &giftCardBatchRepo{}
	repo.redeemErr = models.ErrNotFound
	service := NewService(repo, nil)
	_, err := service.Redeem(context.Background(), 1, "NOPE-NOPE-NOPE-NOPE")
	if !errors.Is(err, apperr.ErrGiftCardInvalid) {
		t.Fatalf("err = %v, want ErrGiftCardInvalid", err)
	}
	if e, ok := apperr.As(err); !ok || e.Message == "" || e.Code != "GIFT_CARD_INVALID" {
		t.Fatalf("app err = %#v", err)
	}
}

func TestFulfillPaidPurchaseIdempotent(t *testing.T) {
	repo := &purchaseRepoStub{}
	svc := NewService(repo, nil)
	// First fulfill inserts; second sees existing purchase_txid.
	if err := svc.FulfillPaidPurchaseTx(context.Background(), nil, 1, 50_000, "gbuy-1"); err != nil {
		t.Fatalf("first: %v", err)
	}
	if repo.inserts != 1 {
		t.Fatalf("inserts = %d", repo.inserts)
	}
	if err := svc.FulfillPaidPurchaseTx(context.Background(), nil, 1, 50_000, "gbuy-1"); err != nil {
		t.Fatalf("second: %v", err)
	}
	if repo.inserts != 1 {
		t.Fatalf("second must not insert again; inserts=%d", repo.inserts)
	}
}

type purchaseRepoStub struct {
	giftCardBatchRepo
	inserts int
	card    *GiftCard
}

func (r *purchaseRepoStub) GetByPurchaseTxID(_ context.Context, txid string) (*GiftCard, error) {
	if r.card != nil && r.card.PurchaseTxID != nil && *r.card.PurchaseTxID == txid {
		return r.card, nil
	}
	return nil, models.ErrNotFound
}
func (r *purchaseRepoStub) InsertPurchasedTx(_ context.Context, _ pgx.Tx, code string, amount decimal.Decimal, userID int64, txid string) (*GiftCard, error) {
	r.inserts++
	txidCopy := txid
	uid := userID
	r.card = &GiftCard{
		ID: 1, Code: code, InitialAmount: amount, Status: GiftCardStatusActive,
		PurchaserUserID: &uid, PurchaseTxID: &txidCopy,
	}
	return r.card, nil
}

func TestGiftCardIssueDefaultsToOneAndRejectsOversizedBatches(t *testing.T) {
	repo := &giftCardBatchRepo{}
	service := NewService(repo, nil)
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
	repo.createFn = func(codes []string, amount decimal.Decimal) ([]GiftCard, error) {
		if repo.createCalls == 1 {
			return nil, models.ErrConflict
		}
		cards := make([]GiftCard, len(codes))
		for i, code := range codes {
			cards[i] = GiftCard{Code: code, InitialAmount: amount, Status: GiftCardStatusActive}
		}
		return cards, nil
	}
	service := NewService(repo, nil)

	cards, err := service.Issue(context.Background(), decimal.NewFromInt(100), 3)
	if err != nil {
		t.Fatalf("Issue after collision: %v", err)
	}
	if repo.createCalls != 2 || len(cards) != 3 {
		t.Fatalf("retry result = calls %d, cards %d; want 2 and 3", repo.createCalls, len(cards))
	}
}

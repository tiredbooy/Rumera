package services

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"strings"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
)

// GiftCardService issues gift cards (admin) and redeems them into a customer's
// wallet (customer).
type GiftCardService struct {
	repo   repositories.GiftCardRepository
	wallet *WalletService
}

func NewGiftCardService(repo repositories.GiftCardRepository, wallet *WalletService) *GiftCardService {
	return &GiftCardService{repo: repo, wallet: wallet}
}

// Issue creates `count` gift cards of `amount` and returns them (with codes).
func (s *GiftCardService) Issue(ctx context.Context, amount float64, count int) ([]models.GiftCardResponse, error) {
	if amount <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	if count <= 0 {
		count = 1
	}

	out := make([]models.GiftCardResponse, 0, count)
	for i := 0; i < count; i++ {
		gc, err := s.createOne(ctx, amount)
		if err != nil {
			return nil, err
		}
		out = append(out, models.GiftCardResponse{
			Code:          gc.Code,
			InitialAmount: gc.InitialAmount,
			Status:        gc.Status,
			CreatedAt:     gc.CreatedAt,
		})
	}
	return out, nil
}

func (s *GiftCardService) createOne(ctx context.Context, amount float64) (*models.GiftCard, error) {
	for i := 0; i < 6; i++ {
		gc, err := s.repo.Create(ctx, genGiftCode(), amount)
		if err == nil {
			return gc, nil
		}
		if errors.Is(err, models.ErrConflict) {
			continue // code collision — try again
		}
		return nil, apperr.ErrInternal
	}
	return nil, apperr.ErrInternal
}

// Redeem credits the card's amount into the customer's wallet (single-use).
func (s *GiftCardService) Redeem(ctx context.Context, userID int64, code string) (*models.RedeemGiftCardResult, error) {
	code = normalizeGiftCode(code)
	if code == "" {
		return nil, apperr.ErrInvalidRequest
	}

	amount, err := s.repo.Redeem(ctx, code, userID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound // unknown or already used
		}
		return nil, apperr.ErrInternal
	}

	desc := "شارژ کیف پول با کارت هدیه"
	if _, err := s.wallet.Deposit(ctx, userID, amount, nil, &desc); err != nil {
		// Compensate so the card isn't burned without crediting the wallet.
		_ = s.repo.Reactivate(ctx, code)
		return nil, apperr.ErrInternal
	}
	return &models.RedeemGiftCardResult{Amount: amount}, nil
}

// genGiftCode returns a grouped, unambiguous 16-char code, e.g. ABCD-EFGH-JKLM-NPQR.
func genGiftCode() string {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	for i := range b {
		b[i] = alphabet[int(b[i])%len(alphabet)]
	}
	s := string(b)
	return fmt.Sprintf("%s-%s-%s-%s", s[0:4], s[4:8], s[8:12], s[12:16])
}

func normalizeGiftCode(code string) string {
	return strings.ToUpper(strings.TrimSpace(code))
}

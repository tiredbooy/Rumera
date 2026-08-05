package services

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"strings"

	"github.com/shopspring/decimal"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
)

// GiftCardService issues gift cards (admin) and redeems them into a customer's
// wallet (customer).
type GiftCardService struct {
	repo repositories.GiftCardRepository
}

const maxGiftCardBatchSize = 500

func NewGiftCardService(repo repositories.GiftCardRepository, _ *WalletService) *GiftCardService {
	// WalletService is accepted for constructor signature stability with the
	// DI graph; redeem now credits the wallet inside the repository transaction.
	return &GiftCardService{repo: repo}
}

// Issue creates `count` gift cards of `amount` and returns them (with codes).
func (s *GiftCardService) Issue(ctx context.Context, amount decimal.Decimal, count int) ([]models.GiftCardResponse, error) {
	if !amount.GreaterThan(decimal.Zero) {
		return nil, apperr.ErrInvalidRequest
	}
	if count <= 0 {
		count = 1
	}
	if count > maxGiftCardBatchSize {
		return nil, apperr.ErrInvalidRequest
	}

	for attempt := 0; attempt < 6; attempt++ {
		codes, err := genGiftCodes(count)
		if err != nil {
			return nil, apperr.ErrInternal
		}
		cards, err := s.repo.CreateBatch(ctx, codes, amount)
		if err == nil {
			out := make([]models.GiftCardResponse, len(cards))
			for i, card := range cards {
				out[i] = models.GiftCardResponse{
					Code:          card.Code,
					InitialAmount: card.InitialAmount,
					Status:        card.Status,
					CreatedAt:     card.CreatedAt,
				}
			}
			return out, nil
		}
		if errors.Is(err, models.ErrConflict) {
			continue // one code collided; the repository rolled back the whole batch
		}
		return nil, apperr.ErrInternal
	}
	return nil, apperr.ErrInternal
}

// Redeem credits the card's amount into the customer's wallet (single-use).
// Card mark + wallet credit run in one DB transaction.
func (s *GiftCardService) Redeem(ctx context.Context, userID int64, code string) (*models.RedeemGiftCardResult, error) {
	code = normalizeGiftCode(code)
	if code == "" {
		return nil, apperr.ErrInvalidRequest
	}

	desc := "شارژ کیف پول با کارت هدیه"
	amount, err := s.repo.RedeemAndCredit(ctx, code, userID, desc)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound // unknown or already used
		}
		return nil, apperr.ErrInternal
	}
	return &models.RedeemGiftCardResult{Amount: amount}, nil
}

func genGiftCodes(count int) ([]string, error) {
	codes := make([]string, 0, count)
	seen := make(map[string]struct{}, count)
	for len(codes) < count {
		code, err := genGiftCode()
		if err != nil {
			return nil, err
		}
		if _, exists := seen[code]; exists {
			continue
		}
		seen[code] = struct{}{}
		codes = append(codes, code)
	}
	return codes, nil
}

// genGiftCode returns a grouped, unambiguous 16-char code, e.g. ABCD-EFGH-JKLM-NPQR.
func genGiftCode() (string, error) {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	for i := range b {
		b[i] = alphabet[int(b[i])%len(alphabet)]
	}
	s := string(b)
	return fmt.Sprintf("%s-%s-%s-%s", s[0:4], s[4:8], s[8:12], s[12:16]), nil
}

func normalizeGiftCode(code string) string {
	return strings.ToUpper(strings.TrimSpace(code))
}

package giftcard

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/shopspring/decimal"
	"github.com/tiredbooy/internal/features/wallet"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

// Service issues gift cards (admin), fulfills paid purchases (PH-042a), and
// redeems codes into a customer's wallet.
type Service struct {
	repo Repository
}

const maxGiftCardBatchSize = 500

func NewService(repo Repository, _ *wallet.Service) *Service {
	// WalletService is accepted for constructor signature stability with the
	// DI graph; redeem now credits the wallet inside the repository transaction.
	return &Service{repo: repo}
}

// Issue creates `count` gift cards of `amount` and returns them (with codes).
func (s *Service) Issue(ctx context.Context, amount decimal.Decimal, count int) ([]GiftCardResponse, error) {
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
			out := make([]GiftCardResponse, len(cards))
			for i, card := range cards {
				out[i] = GiftCardResponse{
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

// FulfillPaidPurchaseTx issues one active card for a settled gateway payment.
// Idempotent on purchase_txid (PH-042a). Runs inside payments.Confirm TX.
func (s *Service) FulfillPaidPurchaseTx(
	ctx context.Context,
	tx pgx.Tx,
	userID int64,
	amount float64,
	purchaseTxID string,
) error {
	if userID <= 0 || amount <= 0 || strings.TrimSpace(purchaseTxID) == "" {
		return apperr.ErrInvalidRequest
	}
	purchaseTxID = strings.TrimSpace(purchaseTxID)
	if existing, err := s.repo.GetByPurchaseTxID(ctx, purchaseTxID); err == nil && existing != nil {
		return nil // already issued for this payment
	} else if err != nil && !errors.Is(err, models.ErrNotFound) {
		return apperr.ErrInternal
	}

	dec := decimal.NewFromFloat(amount).Round(2)
	if !dec.GreaterThan(decimal.Zero) {
		return apperr.ErrInvalidRequest
	}

	for attempt := 0; attempt < 6; attempt++ {
		codes, err := genGiftCodes(1)
		if err != nil {
			return apperr.ErrInternal
		}
		_, err = s.repo.InsertPurchasedTx(ctx, tx, codes[0], dec, userID, purchaseTxID)
		if err == nil {
			return nil
		}
		if errors.Is(err, models.ErrConflict) {
			// Code collision or concurrent fulfill on same purchase_txid.
			if existing, e2 := s.repo.GetByPurchaseTxID(ctx, purchaseTxID); e2 == nil && existing != nil {
				return nil
			}
			continue
		}
		return apperr.ErrInternal
	}
	return apperr.ErrInternal
}

// ListPurchased returns gift cards the user paid for (for code delivery after buy).
func (s *Service) ListPurchased(ctx context.Context, userID int64) ([]PurchasedGiftCardResponse, error) {
	if userID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	cards, err := s.repo.ListByPurchaser(ctx, userID, 50)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	out := make([]PurchasedGiftCardResponse, 0, len(cards))
	for _, c := range cards {
		item := PurchasedGiftCardResponse{
			Code:          c.Code,
			InitialAmount: c.InitialAmount,
			Status:        c.Status,
			CreatedAt:     c.CreatedAt,
		}
		if c.PurchaseTxID != nil {
			item.PurchaseTxID = *c.PurchaseTxID
		}
		out = append(out, item)
	}
	return out, nil
}

// Redeem credits the card's amount into the customer's wallet (single-use).
// Card mark + wallet credit run in one DB transaction.
func (s *Service) Redeem(ctx context.Context, userID int64, code string) (*RedeemGiftCardResult, error) {
	code = normalizeGiftCode(code)
	if code == "" {
		return nil, apperr.ErrInvalidRequest
	}

	desc := "شارژ کیف پول با کارت هدیه"
	amount, err := s.repo.RedeemAndCredit(ctx, code, userID, desc)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			// Unknown code or already redeemed — same message (no enumeration).
			return nil, apperr.ErrGiftCardInvalid
		}
		return nil, apperr.ErrInternal
	}
	return &RedeemGiftCardResult{Amount: amount}, nil
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

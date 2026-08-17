package giftcard

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"html"
	"log/slog"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/shopspring/decimal"
	"github.com/tiredbooy/internal/features/wallet"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

// Mailer is the subset of pkg/notify used to deliver the purchased code.
// Optional — fulfill succeeds when unset (PR-005b).
type Mailer interface {
	Send(ctx context.Context, to, subject, htmlBody string) error
}

// GiftPurchaseNotifier delivers the purchased-code email (inline or async outbox).
// Prefer notifications.Dispatcher via WithDispatcher when the outbox is wired.
type GiftPurchaseNotifier interface {
	DispatchGiftPurchased(ctx context.Context, to, subject, htmlBody, correlationID, idempotencyKey string) error
}

// PurchaserEmailLookup resolves the buyer's email after a successful paid issue.
// Optional — fulfill succeeds when unset or when lookup returns empty.
type PurchaserEmailLookup interface {
	EmailByUserID(ctx context.Context, userID int64) (string, error)
}

// EmailByUserIDFunc adapts a function to PurchaserEmailLookup.
type EmailByUserIDFunc func(ctx context.Context, userID int64) (string, error)

func (f EmailByUserIDFunc) EmailByUserID(ctx context.Context, userID int64) (string, error) {
	return f(ctx, userID)
}

// Service issues gift cards (admin), lists/voids them (PR-056a), fulfills
// paid purchases (PH-042a), and redeems codes into a customer's wallet.
type Service struct {
	repo       Repository
	mailer     Mailer
	dispatcher GiftPurchaseNotifier
	emails     PurchaserEmailLookup
}

const maxGiftCardBatchSize = 500

func NewService(repo Repository, _ *wallet.Service) *Service {
	// WalletService is accepted for constructor signature stability with the
	// DI graph; redeem now credits the wallet inside the repository transaction.
	return &Service{repo: repo}
}

// WithMailer sets the optional inline mailer used when no dispatcher is wired.
// Nil is allowed; fulfill still succeeds and logs that email was skipped.
func (s *Service) WithMailer(m Mailer) *Service {
	if s != nil {
		s.mailer = m
	}
	return s
}

// WithDispatcher prefers the notification outbox (or inline dispatcher) over
// the mailer. Nil is allowed. Bootstrap (PR-020a) should chain this after New.
func (s *Service) WithDispatcher(d GiftPurchaseNotifier) *Service {
	if s != nil {
		s.dispatcher = d
	}
	return s
}

// WithPurchaserEmailLookup sets how fulfill finds the buyer's address.
func (s *Service) WithPurchaserEmailLookup(l PurchaserEmailLookup) *Service {
	if s != nil {
		s.emails = l
	}
	return s
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
// A successful new issue emails the code (PR-005b). Replay (already issued)
// returns nil without notify. Send/enqueue failures are logged and do not
// roll back the card — the buyer can still read it from GET /gift-cards/mine.
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
		return nil // already issued for this payment — do not re-send
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
		card, err := s.repo.InsertPurchasedTx(ctx, tx, codes[0], dec, userID, purchaseTxID)
		if err == nil {
			code := codes[0]
			if card != nil && card.Code != "" {
				code = card.Code
			}
			s.notifyPurchased(ctx, userID, code, dec, purchaseTxID)
			return nil
		}
		if errors.Is(err, models.ErrConflict) {
			// Code collision or concurrent fulfill on same purchase_txid.
			if existing, e2 := s.repo.GetByPurchaseTxID(ctx, purchaseTxID); e2 == nil && existing != nil {
				return nil // winner already issued — do not re-send
			}
			continue
		}
		return apperr.ErrInternal
	}
	return apperr.ErrInternal
}

func (s *Service) notifyPurchased(ctx context.Context, userID int64, code string, amount decimal.Decimal, purchaseTxID string) {
	if s == nil {
		return
	}
	if s.dispatcher == nil && s.mailer == nil {
		slog.Info("giftcard: skip purchase email",
			"user_id", userID, "purchase_txid", purchaseTxID, "reason", "mailer_unset")
		return
	}
	if s.emails == nil {
		slog.Info("giftcard: skip purchase email",
			"user_id", userID, "purchase_txid", purchaseTxID, "reason", "email_lookup_unset")
		return
	}
	to, err := s.emails.EmailByUserID(ctx, userID)
	to = strings.TrimSpace(to)
	if err != nil || to == "" {
		slog.Info("giftcard: skip purchase email",
			"user_id", userID, "purchase_txid", purchaseTxID, "reason", "no_email")
		return
	}

	subject, body := purchasedGiftEmail(code, amount)
	idem := fmt.Sprintf("gift_purchase:%s", purchaseTxID)
	if s.dispatcher != nil {
		if err := s.dispatcher.DispatchGiftPurchased(ctx, to, subject, body, purchaseTxID, idem); err != nil {
			slog.Warn("giftcard: purchase email dispatch failed",
				"user_id", userID, "purchase_txid", purchaseTxID, "err", err)
		}
		return
	}
	if err := s.mailer.Send(ctx, to, subject, body); err != nil {
		slog.Warn("giftcard: purchase email send failed",
			"user_id", userID, "purchase_txid", purchaseTxID, "err", err)
	}
}

func purchasedGiftEmail(code string, amount decimal.Decimal) (subject, body string) {
	subject = "کد کارت هدیه رومرا"
	body = fmt.Sprintf(
		`<p>خرید کارت هدیه شما با موفقیت انجام شد.</p>`+
			`<p>مبلغ کارت: <strong>%s تومان</strong></p>`+
			`<p>کد کارت هدیه:</p>`+
			`<p dir="ltr" style="font-size:18px"><strong>%s</strong></p>`+
			`<p>اگر این ایمیل را ندیدید، کد در حساب کاربری شما (کارت‌های هدیه) هم نمایش داده می‌شود.</p>`,
		html.EscapeString(amount.String()),
		html.EscapeString(code),
	)
	return
}

// ListAdmin pages every issued card for staff (PR-056a).
func (s *Service) ListAdmin(ctx context.Context, filter AdminFilter) ([]AdminGiftCardResponse, int64, error) {
	filter.Defaults()
	cards, total, err := s.repo.ListAdmin(ctx, filter)
	if err != nil {
		return nil, 0, apperr.ErrInternal
	}
	out := make([]AdminGiftCardResponse, 0, len(cards))
	for _, c := range cards {
		out = append(out, toAdminGiftCard(c))
	}
	return out, total, nil
}

// Void marks an active card disabled so it cannot be redeemed. Redeemed or
// already-disabled cards are a state conflict — money already moved or already void.
func (s *Service) Void(ctx context.Context, id int64) (*AdminGiftCardResponse, error) {
	if id <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	card, err := s.repo.VoidActive(ctx, id)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		if errors.Is(err, models.ErrInvalidState) {
			return nil, models.ErrInvalidState
		}
		return nil, apperr.ErrInternal
	}
	out := toAdminGiftCard(*card)
	return &out, nil
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

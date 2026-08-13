package payments

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/tiredbooy/internal/features/inventory"
	"github.com/tiredbooy/internal/features/loyalty"
	"github.com/tiredbooy/internal/features/referral"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
	"github.com/tiredbooy/pkg/crypto"
	"github.com/tiredbooy/pkg/metrics"
	"github.com/tiredbooy/pkg/tracing"
	"github.com/tiredbooy/pkg/utils"
)

// OrderMarkPaid is the order surface payments need (no import of features/orders —
// avoids a cycle: orders → payments for Create pending payment).
type OrderMarkPaid interface {
	MarkAsPaid(ctx context.Context, tx pgx.Tx, orderID int64) error
	GetStockLines(ctx context.Context, orderID int64) ([]inventory.StockLine, error)
}

// WalletTopUpCreditor credits a customer wallet after a gateway top-up settles.
// Implemented by features/wallet.Service (PH-041a). Optional in unit tests.
type WalletTopUpCreditor interface {
	CreditGatewayTopUpTx(ctx context.Context, tx pgx.Tx, userID int64, amount float64, gatewayTxID string) error
}

// GiftCardPurchaseFulfiller issues a gift card after a paid purchase settles.
// Implemented by features/giftcard.Service (PH-042a). Optional in unit tests.
type GiftCardPurchaseFulfiller interface {
	FulfillPaidPurchaseTx(ctx context.Context, tx pgx.Tx, userID int64, amount float64, purchaseTxID string) error
}

type Service struct {
	paymentRepo Repository
	orderRepo   OrderMarkPaid
	// inventory drains committed stock inside the confirm transaction so payment
	// and stock can't drift apart. Optional (may be nil in narrow unit tests).
	inventory inventory.Service
	// loyalty awards points when an order is confirmed paid. Optional (may be nil).
	loyalty *loyalty.Service
	// referral completes a pending referral on the referee's first paid order.
	referral *referral.Service
	// wallet credits balance on order-less payment success (gateway top-up).
	wallet WalletTopUpCreditor
	// giftCards issues codes for gbuy-* payments (PH-042a).
	giftCards GiftCardPurchaseFulfiller
}

// NewService constructs the payments service.
func NewService(
	paymentRepo Repository,
	orderRepo OrderMarkPaid,
	inventory inventory.Service,
	loyalty *loyalty.Service,
	referral *referral.Service,
	wallet WalletTopUpCreditor,
	giftCards GiftCardPurchaseFulfiller,
) *Service {
	return &Service{
		paymentRepo: paymentRepo,
		orderRepo:   orderRepo,
		inventory:   inventory,
		loyalty:     loyalty,
		referral:    referral,
		wallet:      wallet,
		giftCards:   giftCards,
	}
}

func (s *Service) Create(ctx context.Context, req CreatePaymentTransactionReq) (*PaymentTransaction, error) {
	if err := validateCreatePaymentReq(req); err != nil {
		return nil, err
	}

	// One pending payment per order (checkout). Wallet top-ups have no order_id.
	if req.OrderID != nil {
		existing, _, err := s.paymentRepo.GetAll(ctx, PaymentTransactionFilter{
			OrderID: req.OrderID,
			Status:  statusPtr(PaymentStatusPending),
		})
		if err != nil {
			return nil, apperr.ErrInternal
		}
		if len(existing) > 0 {
			return nil, apperr.ErrConflict
		}
	}

	tx, err := s.paymentRepo.BeginTx(ctx)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	defer utils.RollbackOnErr(ctx, tx, &err)

	pt, err := s.paymentRepo.Create(ctx, tx, req)
	if err != nil {
		// Unique gateway transaction_id (PH-011d) or other domain conflict.
		if errors.Is(err, models.ErrConflict) {
			return nil, apperr.ErrConflict
		}
		return nil, apperr.ErrInternal
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, apperr.ErrInternal
	}

	return pt, nil
}

// CreateWalletTopUp starts a gateway-funded wallet charge (no free deposit).
// Returns a pending payment the client pays via the gateway; webhook Confirm
// credits the wallet. Implements wallet.TopUpGateway (PH-041a).
func (s *Service) CreateWalletTopUp(ctx context.Context, userID int64, amount float64) (*TopUpIntent, error) {
	return s.createOrderlessGatewayPayment(ctx, userID, amount, "wtop-", MinWalletTopUpAmount, MaxWalletTopUpAmount)
}

// CreateGiftCardPurchase starts a gateway payment for one gift card (PH-042a).
// Confirm with gbuy-* transaction_id issues the code to the purchaser.
func (s *Service) CreateGiftCardPurchase(ctx context.Context, userID int64, amount float64) (*TopUpIntent, error) {
	return s.createOrderlessGatewayPayment(ctx, userID, amount, "gbuy-", MinWalletTopUpAmount, MaxWalletTopUpAmount)
}

func (s *Service) createOrderlessGatewayPayment(
	ctx context.Context,
	userID int64,
	amount float64,
	prefix string,
	minAmt, maxAmt float64,
) (*TopUpIntent, error) {
	if userID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	if amount < minAmt || amount > maxAmt {
		return nil, apperr.ErrInvalidRequest
	}
	txnID, err := crypto.GenerateSecureToken(16)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	txnID = prefix + txnID

	pt, err := s.Create(ctx, CreatePaymentTransactionReq{
		OrderID:       nil,
		UserID:        userID,
		Amount:        amount,
		Currency:      "IRT",
		PaymentMethod: models.PaymentMethodGateway,
		TransactionID: txnID,
	})
	if err != nil {
		return nil, err
	}
	return &TopUpIntent{
		PaymentID:     pt.ID,
		TransactionID: pt.TransactionID,
		Amount:        pt.Amount,
		Currency:      pt.Currency,
		Status:        pt.Status,
	}, nil
}

func (s *Service) GetByID(ctx context.Context, id int64) (*PaymentTransaction, error) {
	if id <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	pt, err := s.paymentRepo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}

	return pt, nil
}

func (s *Service) GetByTransactionID(ctx context.Context, transactionID string) (*PaymentTransaction, error) {
	if transactionID == "" {
		return nil, apperr.ErrInvalidRequest
	}

	pt, err := s.paymentRepo.GetByTransactionID(ctx, transactionID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}

	return pt, nil
}

func (s *Service) GetAll(ctx context.Context, filter PaymentTransactionFilter) ([]*PaymentTransaction, int64, error) {
	if filter.Limit <= 0 {
		return nil, 0, apperr.ErrInvalidRequest
	}

	pts, total, err := s.paymentRepo.GetAll(ctx, filter)
	if err != nil {
		return nil, 0, apperr.ErrInternal
	}

	return pts, total, nil
}

// Confirm is the most critical method in this service.
// In a single transaction it:
//  1. Marks the payment_transaction as succeeded
//  2. Marks the order as paid
//
// If either step fails the whole thing rolls back — the order
// never shows as paid without a confirmed payment record.
func (s *Service) Confirm(ctx context.Context, req ConfirmPaymentReq) (pt *PaymentTransaction, err error) {
	start := time.Now()
	ctx, endSpan := tracing.Start(ctx, "payments.Confirm", tracing.String("payment.transaction_id", req.TransactionID))
	defer func() {
		metrics.ObservePaymentConfirm(time.Since(start))
		if err != nil {
			metrics.IncPaymentSettle(metrics.ResultError)
		} else {
			metrics.IncPaymentSettle(metrics.ResultConfirmed)
		}
		endSpan(err)
	}()

	if req.TransactionID == "" {
		return nil, apperr.ErrInvalidRequest
	}

	tx, err := s.paymentRepo.BeginTx(ctx)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	defer utils.RollbackOnErr(ctx, tx, &err)

	pt, err = s.paymentRepo.Confirm(ctx, tx, req)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			// Either the transaction_id doesn't exist or it's already
			// been confirmed/failed — not a valid transition.
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}

	// ── Order checkout path ──────────────────────────────────────────────────
	if pt.OrderID != nil {
		if s.orderRepo == nil {
			return nil, apperr.ErrInternal
		}
		if err = s.orderRepo.MarkAsPaid(ctx, tx, *pt.OrderID); err != nil {
			if errors.Is(err, models.ErrNotFound) {
				return nil, apperr.ErrOrderNotFound
			}
			return nil, apperr.ErrInternal
		}

		// Drain the committed stock in the SAME transaction.
		if s.inventory != nil {
			items, ierr := s.orderRepo.GetStockLines(ctx, *pt.OrderID)
			if ierr != nil {
				err = ierr
				return nil, apperr.ErrInternal
			}
			if err = s.inventory.DeductForOrderTx(ctx, tx, *pt.OrderID, items); err != nil {
				return nil, apperr.ErrInternal
			}
		}
	} else {
		// ── Order-less gateway payments (wallet top-up or gift-card purchase) ─
		if pt.UserID == nil || *pt.UserID <= 0 {
			return nil, apperr.ErrInternal
		}
		switch {
		case strings.HasPrefix(pt.TransactionID, "gbuy-"):
			// Gift card purchase (PH-042a): issue code; do not credit wallet.
			if s.giftCards == nil {
				return nil, apperr.ErrInternal
			}
			if err = s.giftCards.FulfillPaidPurchaseTx(ctx, tx, *pt.UserID, pt.Amount, pt.TransactionID); err != nil {
				return nil, apperr.ErrInternal
			}
		default:
			// Wallet top-up (PH-041a): wtop-* or legacy orderless.
			if s.wallet == nil {
				return nil, apperr.ErrInternal
			}
			if err = s.wallet.CreditGatewayTopUpTx(ctx, tx, *pt.UserID, pt.Amount, pt.TransactionID); err != nil {
				return nil, apperr.ErrInternal
			}
		}
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, apperr.ErrInternal
	}

	// Post-commit side effects for orders only (loyalty / referral).
	if pt.OrderID != nil {
		if s.loyalty != nil && pt.UserID != nil {
			_ = s.loyalty.AwardForOrder(ctx, *pt.UserID, *pt.OrderID, pt.Amount)
		}
		if s.referral != nil && pt.UserID != nil {
			_ = s.referral.OnPaidOrder(ctx, *pt.UserID)
		}
	}

	return pt, nil
}

// Fail records the gateway error. No transaction needed —
// a failed payment has no side effects that touch other tables.
func (s *Service) Fail(ctx context.Context, req FailPaymentReq) (pt *PaymentTransaction, err error) {
	ctx, endSpan := tracing.Start(ctx, "payments.Fail", tracing.String("payment.transaction_id", req.TransactionID))
	defer func() {
		if err != nil {
			metrics.IncPaymentSettle(metrics.ResultError)
		} else {
			metrics.IncPaymentSettle(metrics.ResultFailed)
		}
		endSpan(err)
	}()

	if req.TransactionID == "" {
		return nil, apperr.ErrInvalidRequest
	}

	pt, err = s.paymentRepo.Fail(ctx, req)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}

	return pt, nil
}

// ── private helpers ───────────────────────────────────────────────────────────

func validateCreatePaymentReq(req CreatePaymentTransactionReq) error {
	if req.UserID <= 0 {
		return apperr.ErrInvalidRequest
	}
	if req.OrderID != nil && *req.OrderID <= 0 {
		return apperr.ErrInvalidRequest
	}
	if req.Amount <= 0 {
		return apperr.ErrInvalidRequest
	}
	if req.Currency == "" || req.PaymentMethod == "" || req.TransactionID == "" {
		return apperr.ErrInvalidRequest
	}
	return nil
}

func statusPtr(s PaymentStatus) *PaymentStatus {
	return &s
}

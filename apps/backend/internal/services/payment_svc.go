package services

import (
	"context"
	"errors"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
	"github.com/tiredbooy/pkg/utils"
)

type PaymentService struct {
	paymentRepo repositories.PaymentTransactionRepository
	orderRepo   repositories.OrderRepository
	// loyalty awards points when an order is confirmed paid. Optional (may be nil).
	loyalty *LoyaltyService
	// referral completes a pending referral on the referee's first paid order.
	referral *ReferralService
}

func NewPaymentService(
	paymentRepo repositories.PaymentTransactionRepository,
	orderRepo repositories.OrderRepository,
	loyalty *LoyaltyService,
	referral *ReferralService,
) *PaymentService {
	return &PaymentService{
		paymentRepo: paymentRepo,
		orderRepo:   orderRepo,
		loyalty:     loyalty,
		referral:    referral,
	}
}

func (s *PaymentService) Create(ctx context.Context, req models.CreatePaymentTransactionReq) (*models.PaymentTransaction, error) {
	if err := validateCreatePaymentReq(req); err != nil {
		return nil, err
	}

	existing, _, err := s.paymentRepo.GetAll(ctx, models.PaymentTransactionFilter{
		OrderID: &req.OrderID,
		Status:  statusPtr(models.PaymentStatusPending),
	})
	if err != nil {
		return nil, apperr.ErrInternal
	}
	if len(existing) > 0 {
		return nil, apperr.ErrConflict
	}

	tx, err := s.paymentRepo.BeginTx(ctx)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	defer utils.RollbackOnErr(ctx, tx, &err)

	pt, err := s.paymentRepo.Create(ctx, tx, req)
	if err != nil {
		return nil, apperr.ErrInternal
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, apperr.ErrInternal
	}

	return pt, nil
}

func (s *PaymentService) GetByID(ctx context.Context, id int64) (*models.PaymentTransaction, error) {
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

func (s *PaymentService) GetByTransactionID(ctx context.Context, transactionID string) (*models.PaymentTransaction, error) {
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

func (s *PaymentService) GetAll(ctx context.Context, filter models.PaymentTransactionFilter) ([]*models.PaymentTransaction, int64, error) {
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
func (s *PaymentService) Confirm(ctx context.Context, req models.ConfirmPaymentReq) (pt *models.PaymentTransaction, err error) {
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

	if err = s.orderRepo.MarkAsPaid(ctx, tx, *pt.OrderID); err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrOrderNotFound
		}
		return nil, apperr.ErrInternal
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, apperr.ErrInternal
	}

	// Award loyalty points for the now-paid order. Idempotent (keyed by order id)
	// and best-effort: a loyalty error must never undo a confirmed payment.
	if s.loyalty != nil && pt.UserID != nil && pt.OrderID != nil {
		_ = s.loyalty.AwardForOrder(ctx, *pt.UserID, *pt.OrderID, pt.Amount)
	}
	// Complete a pending referral on the referee's first paid order (best-effort).
	if s.referral != nil && pt.UserID != nil {
		_ = s.referral.OnPaidOrder(ctx, *pt.UserID)
	}

	return pt, nil
}

// Fail records the gateway error. No transaction needed —
// a failed payment has no side effects that touch other tables.
func (s *PaymentService) Fail(ctx context.Context, req models.FailPaymentReq) (*models.PaymentTransaction, error) {
	if req.TransactionID == "" {
		return nil, apperr.ErrInvalidRequest
	}

	pt, err := s.paymentRepo.Fail(ctx, req)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}

	return pt, nil
}

// ── private helpers ───────────────────────────────────────────────────────────

func validateCreatePaymentReq(req models.CreatePaymentTransactionReq) error {
	if req.OrderID <= 0 || req.UserID <= 0 {
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

func statusPtr(s models.PaymentStatus) *models.PaymentStatus {
	return &s
}

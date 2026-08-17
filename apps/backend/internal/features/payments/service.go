package payments

import (
	"context"
	"errors"
	"log/slog"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/tiredbooy/internal/events"
	"github.com/tiredbooy/internal/features/inventory"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
	"github.com/tiredbooy/pkg/crypto"
	"github.com/tiredbooy/pkg/metrics"
	"github.com/tiredbooy/pkg/tracing"
	"github.com/tiredbooy/pkg/utils"
)

const (
	defaultEarnRetryAttempts = 3
	defaultEarnRetryBackoff  = 50 * time.Millisecond
	earnSweepLimit           = 50
)

// OrderEarner is implemented by loyalty.Service. AwardForOrder is idempotent
// per order id — retries after a failed grant must not double-credit.
type OrderEarner interface {
	AwardForOrder(ctx context.Context, userID, orderID int64, amount float64) error
}

// PaidOrderHook is implemented by referral.Service. OnPaidOrder awards both
// sides before Complete so a failed award can be retried.
type PaidOrderHook interface {
	OnPaidOrder(ctx context.Context, refereeID int64) error
}

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

// PurchaseRecorder writes recommendation purchase signals after Confirm.
// Implemented by features/recommendations.Service. Optional in unit tests.
type PurchaseRecorder interface {
	RecordPurchasesForOrder(ctx context.Context, userID, orderID int64) error
}

// PaidOrderReceiptSender emails the buyer after a paid order Confirm (PR-020o).
// Implemented by orders.ReceiptSender. Optional in unit tests.
type PaidOrderReceiptSender interface {
	SendPaidOrderReceipt(ctx context.Context, userID, orderID int64, amount float64) error
}

// OrderPaidEmitter writes the order.paid fact on the confirm transaction.
// Implemented by events.Emitter. Optional — nil keeps the legacy post-commit
// side effects in charge.
//
// Declared here as a narrow local interface rather than added to Repository on
// purpose: widening Repository would break the compile-time assertions in
// internal/mocks for every unrelated feature.
type OrderPaidEmitter interface {
	OrderPaidTx(ctx context.Context, tx pgx.Tx, data events.OrderPaidData) error
	Enabled() bool
}

type Service struct {
	paymentRepo Repository
	orderRepo   OrderMarkPaid
	// inventory drains committed stock inside the confirm transaction so payment
	// and stock can't drift apart. Optional (may be nil in narrow unit tests).
	inventory inventory.Service
	// loyalty awards points when an order is confirmed paid. Optional (may be nil).
	loyalty OrderEarner
	// referral completes a pending referral on the referee's first paid order.
	referral PaidOrderHook
	// wallet credits balance on order-less payment success (gateway top-up).
	wallet WalletTopUpCreditor
	// giftCards issues codes for gbuy-* payments (PH-042a).
	giftCards GiftCardPurchaseFulfiller
	// recs records purchase interactions after a paid order Confirm (PR-050d).
	recs PurchaseRecorder
	// receipt emails the buyer after a paid order Confirm (PR-020o).
	receipt PaidOrderReceiptSender
	// events writes order.paid.v1 inside the confirm transaction. When it is
	// enabled the post-commit hooks below stand down and consumers own them.
	events OrderPaidEmitter
	// startBaseURL is PAYMENT_START_BASE_URL. Empty leaves payment_url blank.
	startBaseURL string
	// earnAttempts / earnBackoff bound the post-commit Award retry (tests set 0 sleep).
	earnAttempts int
	earnBackoff  time.Duration
}

// NewService constructs the payments service.
func NewService(
	paymentRepo Repository,
	orderRepo OrderMarkPaid,
	inventory inventory.Service,
	loyalty OrderEarner,
	referral PaidOrderHook,
	wallet WalletTopUpCreditor,
	giftCards GiftCardPurchaseFulfiller,
) *Service {
	return &Service{
		paymentRepo:  paymentRepo,
		orderRepo:    orderRepo,
		inventory:    inventory,
		loyalty:      loyalty,
		referral:     referral,
		wallet:       wallet,
		giftCards:    giftCards,
		earnAttempts: defaultEarnRetryAttempts,
		earnBackoff:  defaultEarnRetryBackoff,
	}
}

// WithStartBaseURL sets the gateway pay-start origin used to build payment_url.
func (s *Service) WithStartBaseURL(base string) *Service {
	if s != nil {
		s.startBaseURL = strings.TrimSpace(base)
	}
	return s
}

// WithPurchaseRecorder attaches the post-Confirm recs hook (order checkouts).
func (s *Service) WithPurchaseRecorder(r PurchaseRecorder) *Service {
	if s != nil {
		s.recs = r
	}
	return s
}

// WithPaidOrderReceipt attaches the post-Confirm receipt email (order checkouts).
func (s *Service) WithPaidOrderReceipt(r PaidOrderReceiptSender) *Service {
	if s != nil {
		s.receipt = r
	}
	return s
}

// WithEventPublisher attaches the domain-fact emitter.
func (s *Service) WithEventPublisher(e OrderPaidEmitter) *Service {
	if s != nil {
		s.events = e
	}
	return s
}

// eventsOwnSideEffects reports whether order.paid consumers are responsible for
// loyalty, recs and the receipt. When false the legacy post-commit path runs,
// so exactly one of the two is ever active and nothing is awarded twice.
func (s *Service) eventsOwnSideEffects() bool {
	return s != nil && s.events != nil && s.events.Enabled()
}

func (s *Service) Create(ctx context.Context, req CreatePaymentTransactionReq) (*PaymentTransaction, error) {
	if err := validateCreatePaymentReq(req); err != nil {
		return nil, err
	}

	// One pending payment per order (checkout). Wallet top-ups have no order_id.
	if req.OrderID != nil {
		existing, _, err := s.paymentRepo.GetAll(ctx, PaymentTransactionFilter{
			OrderID:    req.OrderID,
			Status:     statusPtr(PaymentStatusPending),
			BaseFilter: models.BaseFilter{PaginationParams: models.PaginationParams{Limit: 1}},
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

	pt, err := s.insertPayment(ctx, tx, req)
	if err != nil {
		return nil, err
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, apperr.ErrInternal
	}

	s.attachPaymentURL(pt)
	return pt, nil
}

// CreateTx inserts a pending payment on the caller's transaction (order create).
// Does not commit. Caller must roll back if this fails.
func (s *Service) CreateTx(ctx context.Context, tx pgx.Tx, req CreatePaymentTransactionReq) (*PaymentTransaction, error) {
	if s == nil || tx == nil {
		return nil, apperr.ErrInternal
	}
	if err := validateCreatePaymentReq(req); err != nil {
		return nil, err
	}
	pt, err := s.insertPayment(ctx, tx, req)
	if err != nil {
		return nil, err
	}
	s.attachPaymentURL(pt)
	return pt, nil
}

func (s *Service) insertPayment(ctx context.Context, tx pgx.Tx, req CreatePaymentTransactionReq) (*PaymentTransaction, error) {
	pt, err := s.paymentRepo.Create(ctx, tx, req)
	if err != nil {
		// Unique gateway transaction_id (PH-011d) or other domain conflict.
		if errors.Is(err, models.ErrConflict) {
			return nil, apperr.ErrConflict
		}
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
		PaymentURL:    pt.PaymentURL,
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

	s.attachPaymentURL(pt)
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

	s.attachPaymentURL(pt)
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

	for _, pt := range pts {
		s.attachPaymentURL(pt)
	}
	return pts, total, nil
}

// Confirm is the most critical method in this service.
// In a single transaction it:
//  1. Marks the payment_transaction as succeeded
//  2. Marks the order as paid
//  3. Deducts stock (when inventory is wired)
//  4. Inserts a payment_loyalty_awards intent for order+user checkouts
//
// If money/stock fails the whole thing rolls back — the order
// never shows as paid without a confirmed payment record.
// Post-commit AwardForOrder / OnPaidOrder is retried; a failed award
// leaves the intent pending and does not fail Confirm.
// Purchase interactions are recorded after commit (log on failure; unpaid
// checkout never writes). The paid receipt email is also sent after commit
// (PR-020o); unpaid POST /orders does not send.
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

	// Same TX as money/stock: remember to earn after commit (PR-003h).
	// Insert failure is a DB error (rolls back) — not a loyalty error.
	if pt.OrderID != nil && pt.UserID != nil {
		if err = s.paymentRepo.InsertEarnIntent(ctx, tx, OrderEarnIntent{
			OrderID: *pt.OrderID,
			UserID:  *pt.UserID,
			Amount:  pt.Amount,
		}); err != nil {
			return nil, apperr.ErrInternal
		}

		// The paid fact, on the SAME transaction as the money and the stock.
		// Assigning to the named `err` is load-bearing: the deferred
		// RollbackOnErr only fires when *err is non-nil, so a `:=` here would
		// return an error while leaving the transaction open and the connection
		// leaking.
		if err = s.emitOrderPaid(ctx, tx, pt); err != nil {
			return nil, apperr.ErrInternal
		}
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, apperr.ErrInternal
	}

	// Post-commit side effects. These only run when the event bus is off — with
	// it on, the order.paid consumers own loyalty, recs and the receipt, and
	// running both would award twice.
	if pt.OrderID != nil && pt.UserID != nil && !s.eventsOwnSideEffects() {
		if _, pending, perr := s.ProcessPendingLoyaltyAwards(ctx); perr != nil {
			slog.Error("payments: process loyalty awards",
				"order_id", *pt.OrderID, "err", perr)
		} else if pending > 0 {
			slog.Error("payments: loyalty earn still pending after confirm",
				"order_id", *pt.OrderID, "pending", pending)
		}
		s.recordPurchases(ctx, *pt.UserID, *pt.OrderID)
		s.sendPaidOrderReceipt(ctx, *pt.UserID, *pt.OrderID, pt.Amount)
	}

	return pt, nil
}

// emitOrderPaid writes the order.paid fact for a checkout confirm.
func (s *Service) emitOrderPaid(ctx context.Context, tx pgx.Tx, pt *PaymentTransaction) error {
	if s.events == nil {
		return nil
	}
	paymentID := pt.ID
	return s.events.OrderPaidTx(ctx, tx, events.OrderPaidData{
		OrderID:   *pt.OrderID,
		UserID:    *pt.UserID,
		Amount:    pt.Amount,
		Rail:      "gateway",
		PaymentID: &paymentID,
		PaidAt:    time.Now().UTC(),
	})
}

func (s *Service) recordPurchases(ctx context.Context, userID, orderID int64) {
	if s == nil || s.recs == nil || userID <= 0 || orderID <= 0 {
		return
	}
	if err := s.recs.RecordPurchasesForOrder(ctx, userID, orderID); err != nil {
		slog.Error("payments: record purchase interactions",
			"order_id", orderID, "user_id", userID, "err", err)
	}
}

func (s *Service) sendPaidOrderReceipt(ctx context.Context, userID, orderID int64, amount float64) {
	if s == nil || s.receipt == nil || orderID <= 0 {
		return
	}
	if err := s.receipt.SendPaidOrderReceipt(ctx, userID, orderID, amount); err != nil {
		slog.Error("payments: send paid order receipt",
			"order_id", orderID, "user_id", userID, "err", err)
	}
}

// ProcessPendingLoyaltyAwards retries AwardForOrder and OnPaidOrder for
// leftover payment_loyalty_awards rows. Safe after Confirm and as a sweeper.
// Marks awarded_at only after AwardForOrder succeeds. Failed rows stay pending.
func (s *Service) ProcessPendingLoyaltyAwards(ctx context.Context) (awarded, stillPending int, err error) {
	if s.paymentRepo == nil {
		return 0, 0, nil
	}
	if s.loyalty == nil && s.referral == nil {
		return 0, 0, nil
	}
	intents, err := s.paymentRepo.ListPendingEarnIntents(ctx, earnSweepLimit)
	if err != nil {
		return 0, 0, err
	}
	for _, intent := range intents {
		if ierr := s.awardEarnIntent(ctx, intent); ierr != nil {
			slog.Error("payments: loyalty earn pending",
				"order_id", intent.OrderID,
				"user_id", intent.UserID,
				"err", ierr,
			)
			stillPending++
			continue
		}
		awarded++
	}
	return awarded, stillPending, nil
}

func (s *Service) awardEarnIntent(ctx context.Context, intent OrderEarnIntent) error {
	attempts := s.earnAttempts
	if attempts < 1 {
		attempts = 1
	}
	var last error
	for i := 0; i < attempts; i++ {
		last = nil
		if s.loyalty != nil {
			if err := s.loyalty.AwardForOrder(ctx, intent.UserID, intent.OrderID, intent.Amount); err != nil {
				last = err
				s.sleepEarnRetry(i, attempts)
				continue
			}
		}
		if s.referral != nil {
			if err := s.referral.OnPaidOrder(ctx, intent.UserID); err != nil {
				last = err
				s.sleepEarnRetry(i, attempts)
				continue
			}
		}
		if s.loyalty != nil {
			return s.paymentRepo.MarkEarnAwarded(ctx, intent.OrderID)
		}
		// Loyalty not wired: do not pretend the order earn succeeded.
		return nil
	}
	return last
}

func (s *Service) sleepEarnRetry(i, attempts int) {
	if i+1 >= attempts || s.earnBackoff <= 0 {
		return
	}
	time.Sleep(s.earnBackoff)
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

func (s *Service) attachPaymentURL(pt *PaymentTransaction) {
	if s == nil || pt == nil {
		return
	}
	pt.PaymentURL = buildPaymentStartURL(s.startBaseURL, pt.TransactionID)
}

// buildPaymentStartURL returns {base}?transaction_id={id}. Empty or invalid
// base yields "" — never a fake pay URL.
func buildPaymentStartURL(base, transactionID string) string {
	base = strings.TrimSpace(base)
	transactionID = strings.TrimSpace(transactionID)
	if base == "" || transactionID == "" {
		return ""
	}
	u, err := url.Parse(base)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return ""
	}
	q := u.Query()
	q.Set("transaction_id", transactionID)
	u.RawQuery = q.Encode()
	return u.String()
}

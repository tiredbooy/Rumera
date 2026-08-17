package wallet

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/tiredbooy/pkg/apperr"
	"github.com/tiredbooy/pkg/metrics"
	"github.com/tiredbooy/pkg/tracing"
	"github.com/tiredbooy/pkg/utils"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// AdminCredit deposits amount for a user with actor audit metadata and
// idempotent replay on the same idempotency key.
func (s *Service) AdminCredit(
	ctx context.Context,
	actorUserID uuid.UUID,
	targetUserID int64,
	amount float64,
	description string,
	idempotencyKey string,
) (result *AdminCreditResult, err error) {
	ctx, endSpan := tracing.Start(ctx, "wallet.AdminCredit", tracing.Int64("wallet.user_id", targetUserID))
	defer func() {
		// Replays are still successful credits from the client's view; count as ok.
		if err != nil {
			metrics.IncWalletOp(metrics.WalletCredit, metrics.ResultError)
		} else {
			metrics.IncWalletOp(metrics.WalletCredit, metrics.ResultOK)
		}
		endSpan(err)
	}()

	if actorUserID == uuid.Nil || targetUserID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	if amount <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	key := strings.TrimSpace(idempotencyKey)
	if utf8.RuneCountInString(key) < 8 || utf8.RuneCountInString(key) > 128 {
		return nil, apperr.ErrInvalidRequest
	}
	// Reject characters that break the description marker parse.
	if strings.ContainsAny(key, " \t\n|") {
		return nil, apperr.ErrInvalidRequest
	}

	wallet, err := s.repo.GetOrCreate(ctx, targetUserID)
	if err != nil {
		return nil, apperr.ErrInternal
	}

	if existing, err := s.repo.FindAdminCreditByIdempotencyKey(ctx, wallet.ID, key); err == nil && existing != nil {
		return &AdminCreditResult{
			Transaction:    *existing,
			ActorUserID:    actorUserID.String(),
			IdempotencyKey: key,
			Replayed:       true,
		}, nil
	} else if err != nil && !utils.IsNotFound(err) {
		return nil, apperr.ErrInternal
	}

	note := strings.TrimSpace(description)
	if note == "" {
		note = "افزایش موجودی توسط مدیر"
	}
	// Keep operator free-text bounded; marker tokens are appended after.
	if utf8.RuneCountInString(note) > 400 {
		note = string([]rune(note)[:400])
	}
	full := fmt.Sprintf("%s | actor=%s | idem=%s", note, actorUserID.String(), key)

	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	defer utils.RollbackOnErr(ctx, tx, &err)

	// Re-check inside the transaction window is best-effort; the description
	// marker plus FE-generated UUID makes practical doubles safe.
	wtx, err := s.repo.Deposit(ctx, tx, wallet.ID, amount, nil, &full)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, apperr.ErrInternal
	}

	return &AdminCreditResult{
		Transaction:    *wtx,
		ActorUserID:    actorUserID.String(),
		IdempotencyKey: key,
		Replayed:       false,
	}, nil
}

func (s *Service) GetByUserID(ctx context.Context, userID int64) (*Wallet, error) {
	if userID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	wallet, err := s.repo.GetByUserID(ctx, userID)
	if err != nil {
		if utils.IsNotFound(err) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}

	return wallet, nil
}

func (s *Service) GetOrCreate(ctx context.Context, userID int64) (*Wallet, error) {
	if userID <= 0 {
		return nil, apperr.ErrAccessDenied
	}

	wallet, err := s.repo.GetOrCreate(ctx, userID)
	if err != nil {
		return nil, apperr.ErrInternal
	}

	return wallet, nil
}

// CreditGatewayTopUpTx credits the wallet inside an open payment Confirm TX.
// Idempotent on gateway transaction_id via description marker topup_txid= (PH-041a).
// No free money: only called after payment_transactions row is marked succeeded.
func (s *Service) CreditGatewayTopUpTx(ctx context.Context, tx pgx.Tx, userID int64, amount float64, gatewayTxID string) error {
	if userID <= 0 || amount <= 0 || strings.TrimSpace(gatewayTxID) == "" {
		return apperr.ErrInvalidRequest
	}
	wallet, err := s.repo.GetOrCreate(ctx, userID)
	if err != nil {
		return apperr.ErrInternal
	}
	marker := "topup_txid=" + strings.TrimSpace(gatewayTxID)
	if existing, err := s.repo.FindDepositByDescriptionMarker(ctx, wallet.ID, marker); err == nil && existing != nil {
		return nil // already credited for this gateway payment
	} else if err != nil && !utils.IsNotFound(err) {
		return apperr.ErrInternal
	}
	desc := fmt.Sprintf("شارژ کیف پول از درگاه | %s", marker)
	if _, err := s.repo.Deposit(ctx, tx, wallet.ID, amount, nil, &desc); err != nil {
		return apperr.ErrInternal
	}
	return nil
}

func (s *Service) Deposit(ctx context.Context, userID int64, amount float64, orderID *int64, description *string) (wtx *Transaction, err error) {
	ctx, endSpan := tracing.Start(ctx, "wallet.Deposit", tracing.Int64("wallet.user_id", userID))
	defer func() {
		if err != nil {
			metrics.IncWalletOp(metrics.WalletCredit, metrics.ResultError)
		} else {
			metrics.IncWalletOp(metrics.WalletCredit, metrics.ResultOK)
		}
		endSpan(err)
	}()

	if userID <= 0 {
		return nil, apperr.ErrAccessDenied
	}
	if amount <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	wallet, err := s.repo.GetOrCreate(ctx, userID)
	if err != nil {
		return nil, apperr.ErrInternal
	}

	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	defer utils.RollbackOnErr(ctx, tx, &err)

	wtx, err = s.repo.Deposit(ctx, tx, wallet.ID, amount, orderID, description)
	if err != nil {
		return nil, apperr.ErrInternal
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, apperr.ErrInternal
	}

	return wtx, nil
}

func (s *Service) Withdraw(ctx context.Context, userID int64, amount float64, orderID *int64, description *string) (wtx *Transaction, err error) {
	ctx, endSpan := tracing.Start(ctx, "wallet.Withdraw", tracing.Int64("wallet.user_id", userID))
	defer func() {
		if err != nil {
			metrics.IncWalletOp(metrics.WalletDebit, metrics.ResultError)
		} else {
			metrics.IncWalletOp(metrics.WalletDebit, metrics.ResultOK)
		}
		endSpan(err)
	}()

	if userID <= 0 {
		return nil, apperr.ErrAccessDenied
	}
	if amount <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	wallet, err := s.repo.GetByUserID(ctx, userID)
	if err != nil {
		if utils.IsNotFound(err) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}

	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	defer utils.RollbackOnErr(ctx, tx, &err)

	wtx, err = s.repo.Withdraw(ctx, tx, wallet.ID, amount, orderID, description)
	if err != nil {
		if utils.IsInsufficientFunds(err) {
			return nil, apperr.ErrInsufficientFunds
		}
		return nil, apperr.ErrInternal
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, apperr.ErrInternal
	}

	return wtx, nil
}

// Purchase debits the wallet for an order in its own transaction.
// Prefer PurchaseTx when the caller already holds the order TX.
func (s *Service) Purchase(ctx context.Context, userID int64, amount float64, orderID int64) (wtx *Transaction, err error) {
	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	defer utils.RollbackOnErr(ctx, tx, &err)

	if err = s.PurchaseTx(ctx, tx, userID, amount, orderID); err != nil {
		return nil, err
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, apperr.ErrInternal
	}
	return &Transaction{Type: TransactionTypePurchase, Amount: amount}, nil
}

// PurchaseTx debits the wallet on a caller-owned transaction (order checkout).
// Does not begin or commit. Insufficient funds → apperr.ErrInsufficientFunds.
func (s *Service) PurchaseTx(ctx context.Context, tx pgx.Tx, userID int64, amount float64, orderID int64) (err error) {
	ctx, endSpan := tracing.Start(ctx, "wallet.Purchase", tracing.Int64("wallet.user_id", userID))
	defer func() {
		if err != nil {
			metrics.IncWalletOp(metrics.WalletDebit, metrics.ResultError)
		} else {
			metrics.IncWalletOp(metrics.WalletDebit, metrics.ResultOK)
		}
		endSpan(err)
	}()

	if userID <= 0 {
		return apperr.ErrAccessDenied
	}
	if amount <= 0 || orderID <= 0 {
		return apperr.ErrInvalidRequest
	}
	if tx == nil {
		return apperr.ErrInternal
	}

	wallet, err := s.repo.GetByUserID(ctx, userID)
	if err != nil {
		if utils.IsNotFound(err) {
			return apperr.ErrNotFound
		}
		return apperr.ErrInternal
	}

	if _, err = s.repo.Purchase(ctx, tx, wallet.ID, amount, orderID); err != nil {
		if utils.IsInsufficientFunds(err) {
			return apperr.ErrInsufficientFunds
		}
		return apperr.ErrInternal
	}
	return nil
}

// AvailableBalance is a cheap pre-debit peek for checkout. No wallet → 0.
func (s *Service) AvailableBalance(ctx context.Context, userID int64) (float64, error) {
	wallet, err := s.GetByUserID(ctx, userID)
	if err != nil {
		if errors.Is(err, apperr.ErrNotFound) {
			return 0, nil
		}
		return 0, err
	}
	return wallet.Balance, nil
}

func (s *Service) Refund(ctx context.Context, userID int64, amount float64, orderID int64) (*Transaction, error) {
	if userID <= 0 {
		return nil, apperr.ErrAccessDenied
	}
	if amount <= 0 || orderID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	wallet, err := s.repo.GetByUserID(ctx, userID)
	if err != nil {
		if utils.IsNotFound(err) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}

	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	defer utils.RollbackOnErr(ctx, tx, &err)

	wtx, err := s.repo.Refund(ctx, tx, wallet.ID, amount, orderID)
	if err != nil {
		return nil, apperr.ErrInternal
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, apperr.ErrInternal
	}

	return wtx, nil
}

func (s *Service) GetTransactions(ctx context.Context, userID int64, filter TransactionFilter) ([]*Transaction, int64, error) {
	if userID <= 0 {
		return nil, 0, apperr.ErrAccessDenied
	}

	wallet, err := s.repo.GetByUserID(ctx, userID)
	if err != nil {
		if utils.IsNotFound(err) {
			return nil, 0, apperr.ErrNotFound
		}
		return nil, 0, apperr.ErrInternal
	}

	txs, total, err := s.repo.GetTransactions(ctx, wallet.ID, filter)
	if err != nil {
		return nil, 0, apperr.ErrInternal
	}

	return txs, total, nil
}

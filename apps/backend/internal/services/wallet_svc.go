package services

import (
	"context"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
	"github.com/tiredbooy/pkg/utils"
)

type WalletService struct {
	walletRepo repositories.WalletRepository
}

func NewWalletService(walletRepo repositories.WalletRepository) *WalletService {
	return &WalletService{walletRepo: walletRepo}
}

func (s *WalletService) GetByUserID(ctx context.Context, userID int64) (*models.Wallet, error) {
	if userID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	wallet, err := s.walletRepo.GetByUserID(ctx, userID)
	if err != nil {
		if utils.IsNotFound(err) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}

	return wallet, nil
}

func (s *WalletService) GetOrCreate(ctx context.Context, userID int64) (*models.Wallet, error) {
	if userID <= 0 {
		return nil, apperr.ErrAccessDenied
	}

	wallet, err := s.walletRepo.GetOrCreate(ctx, userID)
	if err != nil {
		return nil, apperr.ErrInternal
	}

	return wallet, nil
}

func (s *WalletService) Deposit(ctx context.Context, userID int64, amount float64, orderID *int64, description *string) (*models.WalletTransaction, error) {
	if userID <= 0 {
		return nil, apperr.ErrAccessDenied
	}
	if amount <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	wallet, err := s.walletRepo.GetOrCreate(ctx, userID)
	if err != nil {
		return nil, apperr.ErrInternal
	}

	tx, err := s.walletRepo.BeginTx(ctx)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	defer utils.RollbackOnErr(ctx, tx, &err)

	wtx, err := s.walletRepo.Deposit(ctx, tx, wallet.ID, amount, orderID, description)
	if err != nil {
		return nil, apperr.ErrInternal
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, apperr.ErrInternal
	}

	return wtx, nil
}

func (s *WalletService) Withdraw(ctx context.Context, userID int64, amount float64, orderID *int64, description *string) (*models.WalletTransaction, error) {
	if userID <= 0 {
		return nil, apperr.ErrAccessDenied
	}
	if amount <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	wallet, err := s.walletRepo.GetByUserID(ctx, userID)
	if err != nil {
		if utils.IsNotFound(err) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}

	tx, err := s.walletRepo.BeginTx(ctx)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	defer utils.RollbackOnErr(ctx, tx, &err)

	wtx, err := s.walletRepo.Withdraw(ctx, tx, wallet.ID, amount, orderID, description)
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

func (s *WalletService) Purchase(ctx context.Context, userID int64, amount float64, orderID int64) (*models.WalletTransaction, error) {
	if userID <= 0 {
		return nil, apperr.ErrAccessDenied
	}
	if amount <= 0 || orderID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	wallet, err := s.walletRepo.GetByUserID(ctx, userID)
	if err != nil {
		if utils.IsNotFound(err) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}

	tx, err := s.walletRepo.BeginTx(ctx)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	defer utils.RollbackOnErr(ctx, tx, &err)

	wtx, err := s.walletRepo.Purchase(ctx, tx, wallet.ID, amount, orderID)
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

func (s *WalletService) Refund(ctx context.Context, userID int64, amount float64, orderID int64) (*models.WalletTransaction, error) {
	if userID <= 0 {
		return nil, apperr.ErrAccessDenied
	}
	if amount <= 0 || orderID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	wallet, err := s.walletRepo.GetByUserID(ctx, userID)
	if err != nil {
		if utils.IsNotFound(err) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}

	tx, err := s.walletRepo.BeginTx(ctx)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	defer utils.RollbackOnErr(ctx, tx, &err)

	wtx, err := s.walletRepo.Refund(ctx, tx, wallet.ID, amount, orderID)
	if err != nil {
		return nil, apperr.ErrInternal
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, apperr.ErrInternal
	}

	return wtx, nil
}

func (s *WalletService) GetTransactions(ctx context.Context, userID int64, filter models.WalletTransactionFilter) ([]*models.WalletTransaction, int64, error) {
	if userID <= 0 {
		return nil, 0, apperr.ErrAccessDenied
	}

	wallet, err := s.walletRepo.GetByUserID(ctx, userID)
	if err != nil {
		if utils.IsNotFound(err) {
			return nil, 0, apperr.ErrNotFound
		}
		return nil, 0, apperr.ErrInternal
	}

	txs, total, err := s.walletRepo.GetTransactions(ctx, wallet.ID, filter)
	if err != nil {
		return nil, 0, apperr.ErrInternal
	}

	return txs, total, nil
}

package services

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/tiredbooy/internal/mocks"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

func TestWalletService_Purchase_InsufficientFunds(t *testing.T) {
	repo := &mocks.WalletRepo{
		GetByUserIDFn: func(context.Context, int64) (*models.Wallet, error) {
			return &models.Wallet{ID: 1, Balance: 5}, nil
		},
		PurchaseFn: func(context.Context, pgx.Tx, int64, float64, int64) (*models.WalletTransaction, error) {
			return nil, models.ErrInsufficientFunds
		},
	}
	svc := NewWalletService(repo)

	_, err := svc.Purchase(context.Background(), 1, 100, 42)
	if !errors.Is(err, apperr.ErrInsufficientFunds) {
		t.Fatalf("err = %v; want apperr.ErrInsufficientFunds", err)
	}
}

func TestWalletService_Withdraw_InsufficientFunds(t *testing.T) {
	repo := &mocks.WalletRepo{
		GetByUserIDFn: func(context.Context, int64) (*models.Wallet, error) {
			return &models.Wallet{ID: 1, Balance: 5}, nil
		},
		WithdrawFn: func(context.Context, pgx.Tx, int64, float64, *int64, *string) (*models.WalletTransaction, error) {
			return nil, models.ErrInsufficientFunds
		},
	}
	svc := NewWalletService(repo)

	_, err := svc.Withdraw(context.Background(), 1, 100, nil, nil)
	if !errors.Is(err, apperr.ErrInsufficientFunds) {
		t.Fatalf("err = %v; want apperr.ErrInsufficientFunds", err)
	}
}

func TestWalletService_Purchase_Success(t *testing.T) {
	tx := &mocks.FakeTx{}
	repo := &mocks.WalletRepo{
		Tx: tx,
		GetByUserIDFn: func(context.Context, int64) (*models.Wallet, error) {
			return &models.Wallet{ID: 1, Balance: 1000}, nil
		},
		PurchaseFn: func(context.Context, pgx.Tx, int64, float64, int64) (*models.WalletTransaction, error) {
			return &models.WalletTransaction{}, nil
		},
	}
	svc := NewWalletService(repo)

	if _, err := svc.Purchase(context.Background(), 1, 100, 42); err != nil {
		t.Fatalf("Purchase err = %v; want nil", err)
	}
	if !tx.Committed {
		t.Fatal("successful purchase must commit the tx")
	}
}

func TestWalletService_Purchase_RejectsBadInput(t *testing.T) {
	svc := NewWalletService(&mocks.WalletRepo{})
	if _, err := svc.Purchase(context.Background(), 0, 100, 42); !errors.Is(err, apperr.ErrAccessDenied) {
		t.Fatalf("userID<=0 err = %v; want ErrAccessDenied", err)
	}
	if _, err := svc.Purchase(context.Background(), 1, 0, 42); !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("amount<=0 err = %v; want ErrInvalidRequest", err)
	}
}

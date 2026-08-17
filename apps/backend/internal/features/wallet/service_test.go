package wallet

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

// repoStub is a local mock — do not use internal/mocks here (would cycle:
// wallet tests → mocks → wallet.Repository).
type repoStub struct {
	tx            pgx.Tx
	getByUserIDFn func(ctx context.Context, userID int64) (*Wallet, error)
	purchaseFn    func(ctx context.Context, tx pgx.Tx, walletID int64, amount float64, orderID int64) (*Transaction, error)
	withdrawFn    func(ctx context.Context, tx pgx.Tx, walletID int64, amount float64, orderID *int64, description *string) (*Transaction, error)
	depositFn     func(ctx context.Context, tx pgx.Tx, walletID int64, amount float64, orderID *int64, description *string) (*Transaction, error)
	findIdemFn    func(ctx context.Context, walletID int64, key string) (*Transaction, error)
	depositCalls  int
}

func (s *repoStub) BeginTx(context.Context) (pgx.Tx, error) {
	if s.tx != nil {
		return s.tx, nil
	}
	return &fakeTx{}, nil
}
func (s *repoStub) GetByUserID(ctx context.Context, userID int64) (*Wallet, error) {
	if s.getByUserIDFn != nil {
		return s.getByUserIDFn(ctx, userID)
	}
	return &Wallet{ID: 1}, nil
}
func (s *repoStub) GetOrCreate(context.Context, int64) (*Wallet, error) {
	return &Wallet{ID: 1}, nil
}
func (s *repoStub) Deposit(ctx context.Context, tx pgx.Tx, walletID int64, amount float64, orderID *int64, description *string) (*Transaction, error) {
	if s.depositFn != nil {
		return s.depositFn(ctx, tx, walletID, amount, orderID, description)
	}
	return &Transaction{ID: 9, WalletID: walletID, Amount: amount, Type: TransactionTypeDeposit}, nil
}
func (s *repoStub) FindAdminCreditByIdempotencyKey(ctx context.Context, walletID int64, key string) (*Transaction, error) {
	if s.findIdemFn != nil {
		return s.findIdemFn(ctx, walletID, key)
	}
	return nil, models.ErrNotFound
}
func (s *repoStub) FindDepositByDescriptionMarker(ctx context.Context, walletID int64, marker string) (*Transaction, error) {
	if strings.HasPrefix(marker, "idem=") {
		return s.FindAdminCreditByIdempotencyKey(ctx, walletID, strings.TrimPrefix(marker, "idem="))
	}
	return nil, models.ErrNotFound
}
func (s *repoStub) Withdraw(ctx context.Context, tx pgx.Tx, walletID int64, amount float64, orderID *int64, description *string) (*Transaction, error) {
	if s.withdrawFn != nil {
		return s.withdrawFn(ctx, tx, walletID, amount, orderID, description)
	}
	return &Transaction{}, nil
}
func (s *repoStub) Purchase(ctx context.Context, tx pgx.Tx, walletID int64, amount float64, orderID int64) (*Transaction, error) {
	if s.purchaseFn != nil {
		return s.purchaseFn(ctx, tx, walletID, amount, orderID)
	}
	return &Transaction{}, nil
}
func (s *repoStub) Refund(context.Context, pgx.Tx, int64, float64, int64) (*Transaction, error) {
	return &Transaction{}, nil
}
func (s *repoStub) GetTransactions(context.Context, int64, TransactionFilter) ([]*Transaction, int64, error) {
	return nil, 0, nil
}

type fakeTx struct {
	committed bool
}

func (f *fakeTx) Begin(context.Context) (pgx.Tx, error) { return f, nil }
func (f *fakeTx) Commit(context.Context) error          { f.committed = true; return nil }
func (f *fakeTx) Rollback(context.Context) error        { return nil }
func (f *fakeTx) CopyFrom(context.Context, pgx.Identifier, []string, pgx.CopyFromSource) (int64, error) {
	return 0, nil
}
func (f *fakeTx) SendBatch(context.Context, *pgx.Batch) pgx.BatchResults { return nil }
func (f *fakeTx) LargeObjects() pgx.LargeObjects                         { return pgx.LargeObjects{} }
func (f *fakeTx) Prepare(context.Context, string, string) (*pgconn.StatementDescription, error) {
	return nil, nil
}
func (f *fakeTx) Exec(context.Context, string, ...any) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, nil
}
func (f *fakeTx) Query(context.Context, string, ...any) (pgx.Rows, error) { return nil, nil }
func (f *fakeTx) QueryRow(context.Context, string, ...any) pgx.Row        { return nil }
func (f *fakeTx) Conn() *pgx.Conn                                         { return nil }

func TestService_Purchase_InsufficientFunds(t *testing.T) {
	repo := &repoStub{
		getByUserIDFn: func(context.Context, int64) (*Wallet, error) {
			return &Wallet{ID: 1, Balance: 5}, nil
		},
		purchaseFn: func(context.Context, pgx.Tx, int64, float64, int64) (*Transaction, error) {
			return nil, models.ErrInsufficientFunds
		},
	}
	svc := NewService(repo)

	_, err := svc.Purchase(context.Background(), 1, 100, 42)
	if !errors.Is(err, apperr.ErrInsufficientFunds) {
		t.Fatalf("err = %v; want apperr.ErrInsufficientFunds", err)
	}
}

func TestService_Withdraw_InsufficientFunds(t *testing.T) {
	repo := &repoStub{
		getByUserIDFn: func(context.Context, int64) (*Wallet, error) {
			return &Wallet{ID: 1, Balance: 5}, nil
		},
		withdrawFn: func(context.Context, pgx.Tx, int64, float64, *int64, *string) (*Transaction, error) {
			return nil, models.ErrInsufficientFunds
		},
	}
	svc := NewService(repo)

	_, err := svc.Withdraw(context.Background(), 1, 100, nil, nil)
	if !errors.Is(err, apperr.ErrInsufficientFunds) {
		t.Fatalf("err = %v; want apperr.ErrInsufficientFunds", err)
	}
}

func TestService_Purchase_Success(t *testing.T) {
	tx := &fakeTx{}
	repo := &repoStub{
		tx: tx,
		getByUserIDFn: func(context.Context, int64) (*Wallet, error) {
			return &Wallet{ID: 1, Balance: 1000}, nil
		},
		purchaseFn: func(context.Context, pgx.Tx, int64, float64, int64) (*Transaction, error) {
			return &Transaction{}, nil
		},
	}
	svc := NewService(repo)

	if _, err := svc.Purchase(context.Background(), 1, 100, 42); err != nil {
		t.Fatalf("Purchase err = %v; want nil", err)
	}
	if !tx.committed {
		t.Fatal("successful purchase must commit the tx")
	}
}

func TestService_Purchase_RejectsBadInput(t *testing.T) {
	svc := NewService(&repoStub{})
	if _, err := svc.Purchase(context.Background(), 0, 100, 42); !errors.Is(err, apperr.ErrAccessDenied) {
		t.Fatalf("userID<=0 err = %v; want ErrAccessDenied", err)
	}
	if _, err := svc.Purchase(context.Background(), 1, 0, 42); !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("amount<=0 err = %v; want ErrInvalidRequest", err)
	}
}

func TestService_PurchaseTx_UsesCallerTx(t *testing.T) {
	caller := &fakeTx{}
	var gotTx pgx.Tx
	repo := &repoStub{
		tx: &fakeTx{},
		getByUserIDFn: func(context.Context, int64) (*Wallet, error) {
			return &Wallet{ID: 1, Balance: 1000}, nil
		},
		purchaseFn: func(_ context.Context, tx pgx.Tx, walletID int64, amount float64, orderID int64) (*Transaction, error) {
			gotTx = tx
			return &Transaction{WalletID: walletID, Amount: amount, Type: TransactionTypePurchase}, nil
		},
	}
	svc := NewService(repo)

	if err := svc.PurchaseTx(context.Background(), caller, 1, 100, 42); err != nil {
		t.Fatalf("PurchaseTx err = %v; want nil", err)
	}
	if gotTx != caller {
		t.Fatal("PurchaseTx must debit on the caller TX")
	}
	if caller.committed {
		t.Fatal("PurchaseTx must not commit the caller TX")
	}
}

func TestService_PurchaseTx_InsufficientFunds(t *testing.T) {
	repo := &repoStub{
		getByUserIDFn: func(context.Context, int64) (*Wallet, error) {
			return &Wallet{ID: 1, Balance: 5}, nil
		},
		purchaseFn: func(context.Context, pgx.Tx, int64, float64, int64) (*Transaction, error) {
			return nil, models.ErrInsufficientFunds
		},
	}
	svc := NewService(repo)

	err := svc.PurchaseTx(context.Background(), &fakeTx{}, 1, 100, 42)
	if !errors.Is(err, apperr.ErrInsufficientFunds) {
		t.Fatalf("err = %v; want apperr.ErrInsufficientFunds", err)
	}
}

func TestService_AvailableBalance(t *testing.T) {
	svc := NewService(&repoStub{
		getByUserIDFn: func(context.Context, int64) (*Wallet, error) {
			return &Wallet{ID: 1, Balance: 250}, nil
		},
	})
	bal, err := svc.AvailableBalance(context.Background(), 1)
	if err != nil {
		t.Fatalf("AvailableBalance: %v", err)
	}
	if bal != 250 {
		t.Fatalf("balance = %v; want 250", bal)
	}
}

func TestService_AdminCredit_RecordsActorAndIdempotency(t *testing.T) {
	actor := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	tx := &fakeTx{}
	var gotDesc *string
	repo := &repoStub{
		tx: tx,
		depositFn: func(_ context.Context, _ pgx.Tx, _ int64, amount float64, _ *int64, description *string) (*Transaction, error) {
			gotDesc = description
			return &Transaction{ID: 3, Amount: amount, Type: TransactionTypeDeposit, Description: description}, nil
		},
	}
	// Count deposit via wrapper.
	orig := repo.depositFn
	repo.depositFn = func(ctx context.Context, txx pgx.Tx, walletID int64, amount float64, orderID *int64, description *string) (*Transaction, error) {
		repo.depositCalls++
		return orig(ctx, txx, walletID, amount, orderID, description)
	}
	svc := NewService(repo)

	res, err := svc.AdminCredit(context.Background(), actor, 42, 50000, "جبران", "idem-key-01")
	if err != nil {
		t.Fatalf("AdminCredit: %v", err)
	}
	if res.Replayed || res.ActorUserID != actor.String() || res.IdempotencyKey != "idem-key-01" {
		t.Fatalf("result = %+v", res)
	}
	if gotDesc == nil || !strings.Contains(*gotDesc, "actor="+actor.String()) || !strings.Contains(*gotDesc, "idem=idem-key-01") {
		t.Fatalf("description = %v", gotDesc)
	}
	if repo.depositCalls != 1 {
		t.Fatalf("deposit calls = %d", repo.depositCalls)
	}
}

func TestService_AdminCredit_ReplaysSameKey(t *testing.T) {
	actor := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	existing := &Transaction{ID: 7, Amount: 1000, Type: TransactionTypeDeposit}
	repo := &repoStub{
		findIdemFn: func(context.Context, int64, string) (*Transaction, error) {
			return existing, nil
		},
		depositFn: func(context.Context, pgx.Tx, int64, float64, *int64, *string) (*Transaction, error) {
			t.Fatal("deposit must not run on replay")
			return nil, nil
		},
	}
	svc := NewService(repo)
	res, err := svc.AdminCredit(context.Background(), actor, 9, 1000, "", "same-key-xx")
	if err != nil {
		t.Fatalf("AdminCredit: %v", err)
	}
	if !res.Replayed || res.Transaction.ID != 7 {
		t.Fatalf("result = %+v", res)
	}
}

func TestService_AdminCredit_RejectsBadKey(t *testing.T) {
	actor := uuid.MustParse("33333333-3333-3333-3333-333333333333")
	svc := NewService(&repoStub{})
	if _, err := svc.AdminCredit(context.Background(), actor, 1, 10, "", "short"); !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("short key err = %v", err)
	}
	if _, err := svc.AdminCredit(context.Background(), actor, 1, 10, "", "has space xx"); !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("space key err = %v", err)
	}
}

func TestTopUpResponseJSON_PaymentURL(t *testing.T) {
	payload, err := json.Marshal(TopUpResponse{
		PaymentID:     901,
		TransactionID: "wtop-abc",
		Amount:        "100000.00",
		Currency:      "IRT",
		Status:        "pending",
		PaymentURL:    "https://pay.example.com/start?transaction_id=wtop-abc",
	})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var got map[string]any
	if err := json.Unmarshal(payload, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got["payment_url"] != "https://pay.example.com/start?transaction_id=wtop-abc" {
		t.Fatalf("payment_url = %#v", got["payment_url"])
	}

	empty, err := json.Marshal(TopUpResponse{TransactionID: "wtop-abc"})
	if err != nil {
		t.Fatalf("marshal empty: %v", err)
	}
	var emptyGot map[string]any
	if err := json.Unmarshal(empty, &emptyGot); err != nil {
		t.Fatalf("unmarshal empty: %v", err)
	}
	if emptyGot["payment_url"] != "" {
		t.Fatalf("unset payment_url = %#v; want empty string", emptyGot["payment_url"])
	}
}

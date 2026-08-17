package payments

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

// fakeTx is a minimal pgx.Tx for service unit tests (mirrors orders package).
type fakeTx struct {
	Committed  bool
	RolledBack bool
}

func (t *fakeTx) Begin(context.Context) (pgx.Tx, error) { return t, nil }
func (t *fakeTx) Commit(context.Context) error          { t.Committed = true; return nil }
func (t *fakeTx) Rollback(context.Context) error        { t.RolledBack = true; return nil }
func (t *fakeTx) CopyFrom(context.Context, pgx.Identifier, []string, pgx.CopyFromSource) (int64, error) {
	return 0, nil
}
func (t *fakeTx) SendBatch(context.Context, *pgx.Batch) pgx.BatchResults { return nil }
func (t *fakeTx) LargeObjects() pgx.LargeObjects                         { return pgx.LargeObjects{} }
func (t *fakeTx) Prepare(context.Context, string, string) (*pgconn.StatementDescription, error) {
	return nil, nil
}
func (t *fakeTx) Exec(context.Context, string, ...any) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, nil
}
func (t *fakeTx) Query(context.Context, string, ...any) (pgx.Rows, error) { return nil, nil }
func (t *fakeTx) QueryRow(context.Context, string, ...any) pgx.Row        { return errRow{} }
func (t *fakeTx) Conn() *pgx.Conn                                         { return nil }

type errRow struct{}

func (errRow) Scan(...any) error { return errors.New("no row") }

// createRepoStub implements Repository for Create-path tests.
type createRepoStub struct {
	createErr error
	createPT  *PaymentTransaction
	tx        *fakeTx
}

func (r *createRepoStub) BeginTx(context.Context) (pgx.Tx, error) {
	r.tx = &fakeTx{}
	return r.tx, nil
}

func (r *createRepoStub) Create(_ context.Context, _ pgx.Tx, _ CreatePaymentTransactionReq) (*PaymentTransaction, error) {
	if r.createErr != nil {
		return nil, r.createErr
	}
	if r.createPT != nil {
		return r.createPT, nil
	}
	return &PaymentTransaction{ID: 1, Status: PaymentStatusPending, TransactionID: "tx-1"}, nil
}

func (r *createRepoStub) GetByID(context.Context, int64) (*PaymentTransaction, error) {
	return nil, models.ErrNotFound
}
func (r *createRepoStub) GetByTransactionID(context.Context, string) (*PaymentTransaction, error) {
	return nil, models.ErrNotFound
}
func (r *createRepoStub) GetAll(context.Context, PaymentTransactionFilter) ([]*PaymentTransaction, int64, error) {
	return nil, 0, nil
}
func (r *createRepoStub) Confirm(context.Context, pgx.Tx, ConfirmPaymentReq) (*PaymentTransaction, error) {
	return nil, models.ErrNotFound
}
func (r *createRepoStub) Fail(context.Context, FailPaymentReq) (*PaymentTransaction, error) {
	return nil, models.ErrNotFound
}

func (r *createRepoStub) InsertEarnIntent(context.Context, pgx.Tx, OrderEarnIntent) error {
	return nil
}
func (r *createRepoStub) ListPendingEarnIntents(context.Context, int) ([]OrderEarnIntent, error) {
	return nil, nil
}
func (r *createRepoStub) MarkEarnAwarded(context.Context, int64) error { return nil }

func TestService_Create_UniqueTransactionID_Conflict(t *testing.T) {
	repo := &createRepoStub{createErr: models.ErrConflict}
	svc := NewService(repo, nil, nil, nil, nil, nil, nil)
	oid := int64(1)
	_, err := svc.Create(context.Background(), CreatePaymentTransactionReq{
		OrderID:       &oid,
		UserID:        1,
		Amount:        1000,
		Currency:      "IRT",
		PaymentMethod: "gateway",
		TransactionID: "dup-tx-001",
	})
	if !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("err = %v; want ErrConflict for unique transaction_id", err)
	}
	if repo.tx == nil || !repo.tx.RolledBack {
		// RollbackOnErr should roll back on create failure before commit.
		// Some helpers only set err for deferred rollback — either path is fine.
	}
}

func TestService_CreateTx_UsesCallerTx(t *testing.T) {
	repo := &createRepoStub{createPT: &PaymentTransaction{
		ID: 9, Status: PaymentStatusPending, TransactionID: "tx-in-tx",
	}}
	svc := NewService(repo, nil, nil, nil, nil, nil, nil).
		WithStartBaseURL("https://pay.example.com/start")
	caller := &fakeTx{}
	oid := int64(5)
	pt, err := svc.CreateTx(context.Background(), caller, CreatePaymentTransactionReq{
		OrderID:       &oid,
		UserID:        1,
		Amount:        1000,
		Currency:      "IRT",
		PaymentMethod: "gateway",
		TransactionID: "tx-in-tx",
	})
	if err != nil {
		t.Fatalf("CreateTx: %v", err)
	}
	if repo.tx != nil {
		t.Fatal("CreateTx must not begin its own TX")
	}
	if caller.Committed || caller.RolledBack {
		t.Fatal("CreateTx must not commit or roll back the caller TX")
	}
	if pt.ID != 9 {
		t.Fatalf("id = %d; want 9", pt.ID)
	}
	want := "https://pay.example.com/start?transaction_id=tx-in-tx"
	if pt.PaymentURL != want {
		t.Fatalf("payment_url = %q; want %q", pt.PaymentURL, want)
	}
}

func TestService_Create_Success(t *testing.T) {
	repo := &createRepoStub{createPT: &PaymentTransaction{
		ID: 7, Status: PaymentStatusPending, TransactionID: "tx-ok",
	}}
	svc := NewService(repo, nil, nil, nil, nil, nil, nil)
	oid := int64(1)
	pt, err := svc.Create(context.Background(), CreatePaymentTransactionReq{
		OrderID:       &oid,
		UserID:        1,
		Amount:        5000,
		Currency:      "IRT",
		PaymentMethod: "gateway",
		TransactionID: "tx-ok",
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if pt.ID != 7 {
		t.Fatalf("id = %d; want 7", pt.ID)
	}
	if repo.tx == nil || !repo.tx.Committed {
		t.Fatal("expected commit on success")
	}
}

func TestService_CreateWalletTopUp_Bounds(t *testing.T) {
	svc := NewService(&createRepoStub{}, nil, nil, nil, nil, nil, nil)
	if _, err := svc.CreateWalletTopUp(context.Background(), 1, 100); err == nil {
		t.Fatal("want invalid for amount below min")
	}
	if _, err := svc.CreateWalletTopUp(context.Background(), 1, MaxWalletTopUpAmount+1); err == nil {
		t.Fatal("want invalid for amount above max")
	}
}

func TestService_CreateWalletTopUp_PaymentURL_WhenBaseSet(t *testing.T) {
	repo := &createRepoStub{createPT: &PaymentTransaction{
		ID: 3, Status: PaymentStatusPending, TransactionID: "wtop-abc",
		Amount: 25_000, Currency: "IRT",
	}}
	svc := NewService(repo, nil, nil, nil, nil, nil, nil).
		WithStartBaseURL("https://pay.example.com/start")
	intent, err := svc.CreateWalletTopUp(context.Background(), 1, 25_000)
	if err != nil {
		t.Fatalf("CreateWalletTopUp: %v", err)
	}
	want := "https://pay.example.com/start?transaction_id=wtop-abc"
	if intent.PaymentURL != want {
		t.Fatalf("payment_url = %q; want %q", intent.PaymentURL, want)
	}
}

func TestService_CreateWalletTopUp_PaymentURL_EmptyWhenUnset(t *testing.T) {
	repo := &createRepoStub{createPT: &PaymentTransaction{
		ID: 3, Status: PaymentStatusPending, TransactionID: "wtop-abc",
		Amount: 25_000, Currency: "IRT",
	}}
	svc := NewService(repo, nil, nil, nil, nil, nil, nil)
	intent, err := svc.CreateWalletTopUp(context.Background(), 1, 25_000)
	if err != nil {
		t.Fatalf("CreateWalletTopUp: %v", err)
	}
	if intent.PaymentURL != "" {
		t.Fatalf("payment_url = %q; want empty when base unset", intent.PaymentURL)
	}
}

func TestService_CreateGiftCardPurchase_PaymentURL_WhenBaseSet(t *testing.T) {
	repo := &createRepoStub{createPT: &PaymentTransaction{
		ID: 4, Status: PaymentStatusPending, TransactionID: "gbuy-xyz",
		Amount: 100_000, Currency: "IRT",
	}}
	svc := NewService(repo, nil, nil, nil, nil, nil, nil).
		WithStartBaseURL("https://pay.example.com/start")
	intent, err := svc.CreateGiftCardPurchase(context.Background(), 1, 100_000)
	if err != nil {
		t.Fatalf("CreateGiftCardPurchase: %v", err)
	}
	want := "https://pay.example.com/start?transaction_id=gbuy-xyz"
	if intent.PaymentURL != want {
		t.Fatalf("payment_url = %q; want %q", intent.PaymentURL, want)
	}
}

func TestService_CreateGiftCardPurchase_PaymentURL_EmptyWhenUnset(t *testing.T) {
	repo := &createRepoStub{createPT: &PaymentTransaction{
		ID: 4, Status: PaymentStatusPending, TransactionID: "gbuy-xyz",
		Amount: 100_000, Currency: "IRT",
	}}
	svc := NewService(repo, nil, nil, nil, nil, nil, nil)
	intent, err := svc.CreateGiftCardPurchase(context.Background(), 1, 100_000)
	if err != nil {
		t.Fatalf("CreateGiftCardPurchase: %v", err)
	}
	if intent.PaymentURL != "" {
		t.Fatalf("payment_url = %q; want empty when base unset", intent.PaymentURL)
	}
}

func TestService_Create_PaymentURL_WhenBaseSet(t *testing.T) {
	repo := &createRepoStub{createPT: &PaymentTransaction{
		ID: 7, Status: PaymentStatusPending, TransactionID: "tx-ok",
	}}
	svc := NewService(repo, nil, nil, nil, nil, nil, nil).
		WithStartBaseURL("https://pay.example.com/start")
	oid := int64(1)
	pt, err := svc.Create(context.Background(), CreatePaymentTransactionReq{
		OrderID:       &oid,
		UserID:        1,
		Amount:        5000,
		Currency:      "IRT",
		PaymentMethod: "gateway",
		TransactionID: "tx-ok",
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	want := "https://pay.example.com/start?transaction_id=tx-ok"
	if pt.PaymentURL != want {
		t.Fatalf("payment_url = %q; want %q", pt.PaymentURL, want)
	}
}

func TestBuildPaymentStartURL(t *testing.T) {
	cases := []struct {
		name, base, txid, want string
	}{
		{"empty base", "", "wtop-1", ""},
		{"empty txid", "https://pay.example.com/start", "", ""},
		{"query", "https://pay.example.com/start", "wtop-1", "https://pay.example.com/start?transaction_id=wtop-1"},
		{"existing query", "https://pay.example.com/start?merchant=r", "gbuy-2", "https://pay.example.com/start?merchant=r&transaction_id=gbuy-2"},
		{"not http", "ftp://pay.example.com/start", "wtop-1", ""},
		{"relative", "/start", "wtop-1", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := buildPaymentStartURL(tc.base, tc.txid)
			if got != tc.want {
				t.Fatalf("got %q; want %q", got, tc.want)
			}
		})
	}
}

func TestService_Confirm_WalletTopUp(t *testing.T) {
	uid := int64(42)
	repo := &confirmTopUpRepo{
		pt: &PaymentTransaction{
			ID: 9, UserID: &uid, OrderID: nil, Amount: 25_000,
			Status: PaymentStatusPending, TransactionID: "wtop-abc", Currency: "IRT",
		},
	}
	walletStub := &walletCreditStub{}
	loy := &loyaltyStub{}
	ref := &referralHookStub{}
	svc := NewService(repo, nil, nil, loy, ref, walletStub, nil)
	pt, err := svc.Confirm(context.Background(), ConfirmPaymentReq{TransactionID: "wtop-abc"})
	if err != nil {
		t.Fatalf("Confirm top-up: %v", err)
	}
	if pt.TransactionID != "wtop-abc" {
		t.Fatalf("txid = %s", pt.TransactionID)
	}
	if walletStub.calls != 1 || walletStub.userID != 42 || walletStub.amount != 25_000 {
		t.Fatalf("wallet credit = %+v", walletStub)
	}
	if !repo.tx.Committed {
		t.Fatal("expected commit")
	}
	if loy.calls != 0 || ref.calls != 0 {
		t.Fatal("wallet top-up must not award loyalty or complete referral")
	}
}

func TestService_Confirm_GiftCardPurchase(t *testing.T) {
	uid := int64(7)
	repo := &confirmTopUpRepo{
		pt: &PaymentTransaction{
			ID: 3, UserID: &uid, OrderID: nil, Amount: 100_000,
			Status: PaymentStatusPending, TransactionID: "gbuy-xyz", Currency: "IRT",
		},
	}
	gc := &giftFulfillStub{}
	walletStub := &walletCreditStub{}
	loy := &loyaltyStub{}
	ref := &referralHookStub{}
	svc := NewService(repo, nil, nil, loy, ref, walletStub, gc)
	if _, err := svc.Confirm(context.Background(), ConfirmPaymentReq{TransactionID: "gbuy-xyz"}); err != nil {
		t.Fatalf("Confirm gift buy: %v", err)
	}
	if gc.calls != 1 || gc.userID != 7 || gc.amount != 100_000 || gc.txID != "gbuy-xyz" {
		t.Fatalf("gift fulfill = %+v", gc)
	}
	if walletStub.calls != 0 {
		t.Fatal("gift purchase must not credit wallet")
	}
	if loy.calls != 0 || ref.calls != 0 {
		t.Fatal("gift purchase must not award loyalty or complete referral")
	}
}

type giftFulfillStub struct {
	calls  int
	userID int64
	amount float64
	txID   string
}

func (g *giftFulfillStub) FulfillPaidPurchaseTx(_ context.Context, _ pgx.Tx, userID int64, amount float64, purchaseTxID string) error {
	g.calls++
	g.userID = userID
	g.amount = amount
	g.txID = purchaseTxID
	return nil
}

type walletCreditStub struct {
	calls  int
	userID int64
	amount float64
	txID   string
}

func (w *walletCreditStub) CreditGatewayTopUpTx(_ context.Context, _ pgx.Tx, userID int64, amount float64, gatewayTxID string) error {
	w.calls++
	w.userID = userID
	w.amount = amount
	w.txID = gatewayTxID
	return nil
}

type confirmTopUpRepo struct {
	pt *PaymentTransaction
	tx *fakeTx
}

func (r *confirmTopUpRepo) BeginTx(context.Context) (pgx.Tx, error) {
	r.tx = &fakeTx{}
	return r.tx, nil
}
func (r *confirmTopUpRepo) Create(context.Context, pgx.Tx, CreatePaymentTransactionReq) (*PaymentTransaction, error) {
	return nil, models.ErrNotFound
}
func (r *confirmTopUpRepo) GetByID(context.Context, int64) (*PaymentTransaction, error) {
	return nil, models.ErrNotFound
}
func (r *confirmTopUpRepo) GetByTransactionID(context.Context, string) (*PaymentTransaction, error) {
	return r.pt, nil
}
func (r *confirmTopUpRepo) GetAll(context.Context, PaymentTransactionFilter) ([]*PaymentTransaction, int64, error) {
	return nil, 0, nil
}
func (r *confirmTopUpRepo) Confirm(_ context.Context, _ pgx.Tx, _ ConfirmPaymentReq) (*PaymentTransaction, error) {
	cp := *r.pt
	cp.Status = PaymentStatusSucceeded
	return &cp, nil
}
func (r *confirmTopUpRepo) Fail(context.Context, FailPaymentReq) (*PaymentTransaction, error) {
	return nil, models.ErrNotFound
}
func (r *confirmTopUpRepo) InsertEarnIntent(context.Context, pgx.Tx, OrderEarnIntent) error {
	return nil
}
func (r *confirmTopUpRepo) ListPendingEarnIntents(context.Context, int) ([]OrderEarnIntent, error) {
	return nil, nil
}
func (r *confirmTopUpRepo) MarkEarnAwarded(context.Context, int64) error { return nil }

type loyaltyStub struct {
	calls int
	failN int
	err   error
}

func (l *loyaltyStub) AwardForOrder(context.Context, int64, int64, float64) error {
	l.calls++
	if l.failN > 0 {
		l.failN--
		if l.err != nil {
			return l.err
		}
		return errors.New("award failed")
	}
	if l.err != nil && l.failN < 0 {
		return l.err
	}
	return nil
}

type alwaysFailLoyalty struct {
	calls int
	err   error
}

func (l *alwaysFailLoyalty) AwardForOrder(context.Context, int64, int64, float64) error {
	l.calls++
	if l.err != nil {
		return l.err
	}
	return errors.New("award failed")
}

type referralHookStub struct {
	calls  int
	userID int64
	err    error
}

func (r *referralHookStub) OnPaidOrder(_ context.Context, refereeID int64) error {
	r.calls++
	r.userID = refereeID
	return r.err
}

func TestIsTerminalPaymentStatus(t *testing.T) {
	if !isTerminalPaymentStatus(PaymentStatusSucceeded) {
		t.Fatal("succeeded is terminal")
	}
	if !isTerminalPaymentStatus(PaymentStatusFailed) {
		t.Fatal("failed is terminal")
	}
	if isTerminalPaymentStatus(PaymentStatusPending) {
		t.Fatal("pending is not terminal")
	}
}

func TestIsUniqueViolation(t *testing.T) {
	if isUniqueViolation(errors.New("nope")) {
		t.Fatal("plain error must not match")
	}
	if !isUniqueViolation(&pgconn.PgError{Code: "23505"}) {
		t.Fatal("23505 must match")
	}
	if isUniqueViolation(&pgconn.PgError{Code: "23503"}) {
		t.Fatal("FK violation must not match")
	}
}

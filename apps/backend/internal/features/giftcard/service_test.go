package giftcard

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/shopspring/decimal"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

type giftCardBatchRepo struct {
	createCalls int
	createFn    func(codes []string, amount decimal.Decimal) ([]GiftCard, error)
	redeemErr   error
	redeemAmt   decimal.Decimal
}

func (r *giftCardBatchRepo) CreateBatch(_ context.Context, codes []string, amount decimal.Decimal) ([]GiftCard, error) {
	r.createCalls++
	if r.createFn != nil {
		return r.createFn(codes, amount)
	}
	cards := make([]GiftCard, len(codes))
	for i, code := range codes {
		cards[i] = GiftCard{
			ID:            int64(i + 1),
			Code:          code,
			InitialAmount: amount,
			Status:        GiftCardStatusActive,
			CreatedAt:     time.Date(2026, time.July, 29, 12, 0, 0, 0, time.UTC),
		}
	}
	return cards, nil
}

func (r *giftCardBatchRepo) RedeemAndCredit(context.Context, string, int64, string) (decimal.Decimal, error) {
	if r.redeemErr != nil {
		return decimal.Zero, r.redeemErr
	}
	if r.redeemAmt.IsZero() {
		return decimal.Zero, nil
	}
	return r.redeemAmt, nil
}
func (r *giftCardBatchRepo) GetByPurchaseTxID(context.Context, string) (*GiftCard, error) {
	return nil, models.ErrNotFound
}
func (r *giftCardBatchRepo) InsertPurchasedTx(context.Context, pgx.Tx, string, decimal.Decimal, int64, string) (*GiftCard, error) {
	return nil, models.ErrNotFound
}
func (r *giftCardBatchRepo) ListByPurchaser(context.Context, int64, int) ([]GiftCard, error) {
	return nil, nil
}
func (r *giftCardBatchRepo) ListAdmin(context.Context, AdminFilter) ([]GiftCard, int64, error) {
	return nil, 0, nil
}
func (r *giftCardBatchRepo) GetByID(context.Context, int64) (*GiftCard, error) {
	return nil, models.ErrNotFound
}
func (r *giftCardBatchRepo) VoidActive(context.Context, int64) (*GiftCard, error) {
	return nil, models.ErrNotFound
}

func TestGiftCardIssueCreatesTheCompleteBatchInOneRepositoryCall(t *testing.T) {
	repo := &giftCardBatchRepo{}
	service := NewService(repo, nil)
	amount := decimal.RequireFromString("125000.50")

	cards, err := service.Issue(context.Background(), amount, 4)
	if err != nil {
		t.Fatalf("Issue: %v", err)
	}
	if repo.createCalls != 1 {
		t.Fatalf("CreateBatch calls = %d, want 1", repo.createCalls)
	}
	if len(cards) != 4 {
		t.Fatalf("issued cards = %d, want 4", len(cards))
	}

	codePattern := regexp.MustCompile(`^[A-HJ-NP-Z2-9]{4}(?:-[A-HJ-NP-Z2-9]{4}){3}$`)
	seen := make(map[string]struct{}, len(cards))
	for _, card := range cards {
		if !codePattern.MatchString(card.Code) {
			t.Fatalf("code %q does not match the gift-card format", card.Code)
		}
		if _, duplicate := seen[card.Code]; duplicate {
			t.Fatalf("duplicate generated code %q", card.Code)
		}
		seen[card.Code] = struct{}{}
		if !card.InitialAmount.Equal(amount) || card.Status != GiftCardStatusActive {
			t.Fatalf("unexpected issued card: %#v", card)
		}
	}
}

func TestGiftCardRedeemUnknownCodeIsClearContract(t *testing.T) {
	repo := &giftCardBatchRepo{}
	repo.redeemErr = models.ErrNotFound
	service := NewService(repo, nil)
	_, err := service.Redeem(context.Background(), 1, "NOPE-NOPE-NOPE-NOPE")
	if !errors.Is(err, apperr.ErrGiftCardInvalid) {
		t.Fatalf("err = %v, want ErrGiftCardInvalid", err)
	}
	if e, ok := apperr.As(err); !ok || e.Message == "" || e.Code != "GIFT_CARD_INVALID" {
		t.Fatalf("app err = %#v", err)
	}
}

func TestFulfillPaidPurchaseIdempotent(t *testing.T) {
	repo := &purchaseRepoStub{}
	svc := NewService(repo, nil)
	// First fulfill inserts; second sees existing purchase_txid.
	if err := svc.FulfillPaidPurchaseTx(context.Background(), nil, 1, 50_000, "gbuy-1"); err != nil {
		t.Fatalf("first: %v", err)
	}
	if repo.inserts != 1 {
		t.Fatalf("inserts = %d", repo.inserts)
	}
	if err := svc.FulfillPaidPurchaseTx(context.Background(), nil, 1, 50_000, "gbuy-1"); err != nil {
		t.Fatalf("second: %v", err)
	}
	if repo.inserts != 1 {
		t.Fatalf("second must not insert again; inserts=%d", repo.inserts)
	}
}

type stubGiftMailer struct {
	sends                     int
	lastTo, lastSubject, last string
	err                       error
}

func (m *stubGiftMailer) Send(_ context.Context, to, subject, htmlBody string) error {
	m.sends++
	m.lastTo = to
	m.lastSubject = subject
	m.last = htmlBody
	return m.err
}

type stubGiftDispatcher struct {
	calls                      int
	lastTo, lastBody, lastIdem string
	lastTx                     pgx.Tx
	err                        error
}

func (d *stubGiftDispatcher) DispatchGiftPurchasedTx(_ context.Context, tx pgx.Tx, to, _, htmlBody, _, idempotencyKey string) error {
	d.calls++
	d.lastTx = tx
	d.lastTo = to
	d.lastBody = htmlBody
	d.lastIdem = idempotencyKey
	return d.err
}

type stubEmails struct {
	email string
	err   error
	calls int
}

func (e *stubEmails) EmailByUserID(context.Context, int64) (string, error) {
	e.calls++
	return e.email, e.err
}

func TestFulfillPaidPurchaseNotifiesOnce(t *testing.T) {
	repo := &purchaseRepoStub{}
	mail := &stubGiftMailer{}
	emails := &stubEmails{email: "buyer@example.com"}
	svc := NewService(repo, nil).WithMailer(mail).WithPurchaserEmailLookup(emails)

	if err := svc.FulfillPaidPurchaseTx(context.Background(), nil, 1, 50_000, "gbuy-1"); err != nil {
		t.Fatalf("first: %v", err)
	}
	if mail.sends != 1 {
		t.Fatalf("sends = %d, want 1", mail.sends)
	}
	if mail.lastTo != "buyer@example.com" {
		t.Fatalf("to = %q", mail.lastTo)
	}
	if repo.card == nil || !strings.Contains(mail.last, repo.card.Code) {
		t.Fatalf("body missing code")
	}
	if !strings.Contains(mail.last, "50000") || !strings.Contains(mail.last, "تومان") {
		t.Fatalf("body missing amount: %s", mail.last)
	}
	if mail.lastSubject != "کد کارت هدیه رومرا" {
		t.Fatalf("subject = %q", mail.lastSubject)
	}

	if err := svc.FulfillPaidPurchaseTx(context.Background(), nil, 1, 50_000, "gbuy-1"); err != nil {
		t.Fatalf("replay: %v", err)
	}
	if mail.sends != 1 {
		t.Fatalf("replay must not re-send; sends=%d", mail.sends)
	}
	if emails.calls != 1 {
		t.Fatalf("replay must not look up email; calls=%d", emails.calls)
	}
}

func TestFulfillPaidPurchaseDispatcherNotifiesOnce(t *testing.T) {
	repo := &purchaseRepoStub{}
	disp := &stubGiftDispatcher{}
	mail := &stubGiftMailer{}
	emails := &stubEmails{email: "buyer@example.com"}
	svc := NewService(repo, nil).
		WithMailer(mail).
		WithDispatcher(disp).
		WithPurchaserEmailLookup(emails)

	if err := svc.FulfillPaidPurchaseTx(context.Background(), nil, 1, 50_000, "gbuy-2"); err != nil {
		t.Fatalf("first: %v", err)
	}
	if disp.calls != 1 || mail.sends != 0 {
		t.Fatalf("dispatcher=%d mailer=%d; want dispatcher only", disp.calls, mail.sends)
	}
	if disp.lastIdem != "gift_purchase:gbuy-2" {
		t.Fatalf("idem = %q", disp.lastIdem)
	}
	if repo.card == nil || !strings.Contains(disp.lastBody, repo.card.Code) {
		t.Fatalf("dispatcher body missing code")
	}

	if err := svc.FulfillPaidPurchaseTx(context.Background(), nil, 1, 50_000, "gbuy-2"); err != nil {
		t.Fatalf("replay: %v", err)
	}
	if disp.calls != 1 {
		t.Fatalf("replay must not dispatch; calls=%d", disp.calls)
	}
}

func TestFulfillPaidPurchaseNilMailerStillSucceeds(t *testing.T) {
	repo := &purchaseRepoStub{}
	svc := NewService(repo, nil)
	if err := svc.FulfillPaidPurchaseTx(context.Background(), nil, 1, 50_000, "gbuy-3"); err != nil {
		t.Fatalf("fulfill without mailer: %v", err)
	}
	if repo.inserts != 1 {
		t.Fatalf("inserts = %d", repo.inserts)
	}
}

func TestFulfillPaidPurchaseSendFailureDoesNotFailFulfill(t *testing.T) {
	repo := &purchaseRepoStub{}
	mail := &stubGiftMailer{err: errors.New("smtp down")}
	emails := &stubEmails{email: "buyer@example.com"}
	svc := NewService(repo, nil).WithMailer(mail).WithPurchaserEmailLookup(emails)
	if err := svc.FulfillPaidPurchaseTx(context.Background(), nil, 1, 50_000, "gbuy-4"); err != nil {
		t.Fatalf("send fail must not fail fulfill: %v", err)
	}
	if repo.inserts != 1 || mail.sends != 1 {
		t.Fatalf("inserts=%d sends=%d", repo.inserts, mail.sends)
	}
}

type purchaseRepoStub struct {
	giftCardBatchRepo
	inserts int
	card    *GiftCard
}

func (r *purchaseRepoStub) GetByPurchaseTxID(_ context.Context, txid string) (*GiftCard, error) {
	if r.card != nil && r.card.PurchaseTxID != nil && *r.card.PurchaseTxID == txid {
		return r.card, nil
	}
	return nil, models.ErrNotFound
}
func (r *purchaseRepoStub) InsertPurchasedTx(_ context.Context, _ pgx.Tx, code string, amount decimal.Decimal, userID int64, txid string) (*GiftCard, error) {
	r.inserts++
	txidCopy := txid
	uid := userID
	r.card = &GiftCard{
		ID: 1, Code: code, InitialAmount: amount, Status: GiftCardStatusActive,
		PurchaserUserID: &uid, PurchaseTxID: &txidCopy,
	}
	return r.card, nil
}

func TestGiftCardIssueDefaultsToOneAndRejectsOversizedBatches(t *testing.T) {
	repo := &giftCardBatchRepo{}
	service := NewService(repo, nil)
	amount := decimal.NewFromInt(100)

	cards, err := service.Issue(context.Background(), amount, 0)
	if err != nil || len(cards) != 1 {
		t.Fatalf("default issuance = (%d, %v), want one card", len(cards), err)
	}
	if _, err := service.Issue(context.Background(), amount, maxGiftCardBatchSize+1); !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("oversized batch error = %v, want ErrInvalidRequest", err)
	}
	if repo.createCalls != 1 {
		t.Fatalf("CreateBatch calls = %d, oversized batch must not reach repository", repo.createCalls)
	}
}

func TestListAdminMapsRowsAndEmptyPage(t *testing.T) {
	txID := "gbuy-1"
	uid := int64(9)
	repo := &adminRepoStub{
		cards: []GiftCard{{
			ID: 3, Code: "ABCD-EFGH-JKLM-NPQR",
			InitialAmount:   decimal.NewFromInt(50_000),
			Status:          GiftCardStatusActive,
			PurchaserUserID: &uid, PurchaseTxID: &txID,
			CreatedAt: time.Date(2026, time.August, 16, 10, 0, 0, 0, time.UTC),
		}},
		total: 1,
	}
	svc := NewService(repo, nil)

	rows, total, err := svc.ListAdmin(context.Background(), AdminFilter{})
	if err != nil {
		t.Fatalf("ListAdmin: %v", err)
	}
	if total != 1 || len(rows) != 1 {
		t.Fatalf("got total=%d rows=%d", total, len(rows))
	}
	got := rows[0]
	if got.ID != 3 || got.Code != "ABCD-EFGH-JKLM-NPQR" || got.Status != GiftCardStatusActive {
		t.Fatalf("row = %#v", got)
	}
	if got.PurchaseTxID == nil || *got.PurchaseTxID != txID {
		t.Fatalf("purchase_txid = %#v", got.PurchaseTxID)
	}

	repo.cards = nil
	repo.total = 0
	empty, total, err := svc.ListAdmin(context.Background(), AdminFilter{})
	if err != nil {
		t.Fatalf("empty ListAdmin: %v", err)
	}
	if total != 0 || empty == nil || len(empty) != 0 {
		t.Fatalf("empty page = (%#v, %d)", empty, total)
	}
}

func TestVoidActiveCard(t *testing.T) {
	repo := &adminRepoStub{
		card: &GiftCard{
			ID: 7, Code: "AAAA-BBBB-CCCC-DDDD",
			InitialAmount: decimal.NewFromInt(10_000),
			Status:        GiftCardStatusActive,
		},
	}
	svc := NewService(repo, nil)
	out, err := svc.Void(context.Background(), 7)
	if err != nil {
		t.Fatalf("Void: %v", err)
	}
	if repo.voidID != 7 {
		t.Fatalf("void id = %d", repo.voidID)
	}
	if out == nil || out.ID != 7 || out.Status != GiftCardStatusDisabled {
		t.Fatalf("voided = %#v", out)
	}
}

func TestVoidRejectsMissingAndNonActive(t *testing.T) {
	svc := NewService(&adminRepoStub{voidErr: models.ErrNotFound}, nil)
	if _, err := svc.Void(context.Background(), 99); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("missing = %v, want ErrNotFound", err)
	}

	svc = NewService(&adminRepoStub{voidErr: models.ErrInvalidState}, nil)
	if _, err := svc.Void(context.Background(), 8); !errors.Is(err, models.ErrInvalidState) {
		t.Fatalf("redeemed/disabled = %v, want ErrInvalidState", err)
	}

	if _, err := svc.Void(context.Background(), 0); !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("id 0 = %v, want ErrInvalidRequest", err)
	}
}

type adminRepoStub struct {
	giftCardBatchRepo
	cards   []GiftCard
	total   int64
	card    *GiftCard
	voidID  int64
	voidErr error
}

func (r *adminRepoStub) ListAdmin(context.Context, AdminFilter) ([]GiftCard, int64, error) {
	if r.cards == nil {
		return []GiftCard{}, r.total, nil
	}
	return r.cards, r.total, nil
}

func (r *adminRepoStub) GetByID(_ context.Context, id int64) (*GiftCard, error) {
	if r.card != nil && r.card.ID == id {
		return r.card, nil
	}
	return nil, models.ErrNotFound
}

func (r *adminRepoStub) VoidActive(_ context.Context, id int64) (*GiftCard, error) {
	r.voidID = id
	if r.voidErr != nil {
		return nil, r.voidErr
	}
	if r.card == nil || r.card.ID != id {
		return nil, models.ErrNotFound
	}
	cp := *r.card
	cp.Status = GiftCardStatusDisabled
	r.card = &cp
	return r.card, nil
}

func TestGiftCardIssueRetriesAnAtomicCollision(t *testing.T) {
	repo := &giftCardBatchRepo{}
	repo.createFn = func(codes []string, amount decimal.Decimal) ([]GiftCard, error) {
		if repo.createCalls == 1 {
			return nil, models.ErrConflict
		}
		cards := make([]GiftCard, len(codes))
		for i, code := range codes {
			cards[i] = GiftCard{Code: code, InitialAmount: amount, Status: GiftCardStatusActive}
		}
		return cards, nil
	}
	service := NewService(repo, nil)

	cards, err := service.Issue(context.Background(), decimal.NewFromInt(100), 3)
	if err != nil {
		t.Fatalf("Issue after collision: %v", err)
	}
	if repo.createCalls != 2 || len(cards) != 3 {
		t.Fatalf("retry result = calls %d, cards %d; want 2 and 3", repo.createCalls, len(cards))
	}
}

// savepointTx is the minimal pgx.Tx a savepoint test needs. Everything else is
// nil-embedded and panics if the code under test touches it.
type savepointTx struct {
	pgx.Tx
	parent    *savepointTx
	begins    int
	commits   int
	rollbacks int
}

func (t *savepointTx) Begin(context.Context) (pgx.Tx, error) {
	t.begins++
	return &savepointTx{parent: t}, nil
}
func (t *savepointTx) Commit(context.Context) error   { t.commits++; return nil }
func (t *savepointTx) Rollback(context.Context) error { t.rollbacks++; return nil }

// conflictOnceRepo collides on the first code, like a real UNIQUE violation. On a
// bare shared transaction that aborts it (25P02) and every later statement fails —
// including the payments.Confirm that owns the tx, after the customer has paid.
type conflictOnceRepo struct {
	purchaseRepoStub
	failed bool
}

func (r *conflictOnceRepo) InsertPurchasedTx(ctx context.Context, tx pgx.Tx, code string, amount decimal.Decimal, userID int64, txid string) (*GiftCard, error) {
	if !r.failed {
		r.failed = true
		return nil, models.ErrConflict
	}
	return r.purchaseRepoStub.InsertPurchasedTx(ctx, tx, code, amount, userID, txid)
}

func TestFulfillPaidPurchaseRetriesOnASavepoint(t *testing.T) {
	repo := &conflictOnceRepo{}
	disp := &stubGiftDispatcher{}
	emails := &stubEmails{email: "buyer@example.com"}
	tx := &savepointTx{}
	svc := NewService(repo, nil).WithDispatcher(disp).WithPurchaserEmailLookup(emails)

	if err := svc.FulfillPaidPurchaseTx(context.Background(), tx, 1, 50_000, "gbuy-sp"); err != nil {
		t.Fatalf("collision must not fail the paid confirm: %v", err)
	}
	if tx.begins != 2 {
		t.Fatalf("savepoints opened = %d; want one per attempt (2)", tx.begins)
	}
	if tx.rollbacks != 0 || tx.commits != 0 {
		t.Fatalf("the caller's tx was settled by us: commits=%d rollbacks=%d", tx.commits, tx.rollbacks)
	}
	// ED-011c: the email must ride the caller's transaction, not the savepoint
	// and not a second connection — a rollback would otherwise mail a code for a
	// card that never committed.
	if disp.calls != 1 {
		t.Fatalf("dispatch calls = %d; want 1", disp.calls)
	}
	if disp.lastTx != pgx.Tx(tx) {
		t.Fatalf("gift email enqueued off the caller's transaction: %#v", disp.lastTx)
	}
}

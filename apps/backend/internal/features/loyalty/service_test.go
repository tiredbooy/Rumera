package loyalty

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

type repoStub struct {
	awardCalls   []awardCall
	awardGranted bool
	awardErr     error
	spendReplay  bool
	spendErr     error
	spendRef     string
	spendCalls   []spendCall
	clawbackN    int
	clawbackErr  error
	ledgerDelta  int
	ledgerErr    error
	birthdayIDs  []int64
	birthdayErr  error
	account      *LoyaltyAccount
	accountErr   error

	members          []AdminMemberRow
	membersTotal     int64
	membersErr       error
	lastMemberFilter MemberFilter

	member    *AdminMemberRow
	memberErr error

	memberTxs      []LoyaltyTransaction
	memberTxsTotal int64
	memberTxsErr   error
	lastTxUUID     uuid.UUID
	lastTxFilter   MemberTransactionFilter

	txs              []LoyaltyTransaction
	txsTotal         int64
	txsErr           error
	lastCustomerID   int64
	lastCustomerFilt TransactionFilter

	internalID    int64
	resolveErr    error
	adjustTx      *LoyaltyTransaction
	adjustErr     error
	clawbackCalls []clawbackCall

	programme    *programmeRow
	programmeErr error
	tiers        []ProgrammeTier
	tiersErr     error
	savedRow     *programmeRow
	savedTiers   []ProgrammeTier
	lastTiers    TierThresholds
}

type clawbackCall struct {
	userID             int64
	maxPoints          int
	reason, refT, refI string
}

type spendCall struct {
	userID, points int64
	refID          string
}

type awardCall struct {
	userID             int64
	delta              int
	reason, refT, refI string
}

func (r *repoStub) GetAccount(ctx context.Context, userID int64) (*LoyaltyAccount, error) {
	if r.accountErr != nil {
		return nil, r.accountErr
	}
	if r.account != nil {
		return r.account, nil
	}
	return nil, models.ErrNotFound
}

func (r *repoStub) Award(ctx context.Context, userID int64, delta int, reason, refType, refID string, tiers TierThresholds) (bool, error) {
	r.awardCalls = append(r.awardCalls, awardCall{userID, delta, reason, refType, refID})
	r.lastTiers = tiers
	if r.awardErr != nil {
		return false, r.awardErr
	}
	if r.awardGranted {
		if r.member != nil {
			r.member.PointsBalance += delta
			if delta > 0 {
				r.member.LifetimePoints += delta
			}
		}
		if r.adjustTx == nil {
			r.adjustTx = &LoyaltyTransaction{
				UserID:  userID,
				Delta:   delta,
				Reason:  LoyaltyTransactionReason(reason),
				RefType: refType,
				RefID:   refID,
			}
		}
	}
	return r.awardGranted, nil
}

func (r *repoStub) Spend(ctx context.Context, userID, points int64, refID string) (bool, error) {
	r.spendCalls = append(r.spendCalls, spendCall{userID: userID, points: points, refID: refID})
	r.spendRef = refID
	if r.spendErr != nil {
		return false, r.spendErr
	}
	return r.spendReplay, nil
}

func (r *repoStub) Clawback(ctx context.Context, userID int64, maxPoints int, reason, refType, refID string) (int, error) {
	r.clawbackCalls = append(r.clawbackCalls, clawbackCall{userID, maxPoints, reason, refType, refID})
	if r.clawbackErr != nil {
		return 0, r.clawbackErr
	}
	n := maxPoints
	if r.clawbackN > 0 {
		n = r.clawbackN
	}
	if r.member != nil {
		if r.member.PointsBalance < n {
			n = r.member.PointsBalance
		}
		r.member.PointsBalance -= n
	}
	if r.adjustTx == nil {
		r.adjustTx = &LoyaltyTransaction{
			UserID:  userID,
			Delta:   -n,
			Reason:  LoyaltyTransactionReason(reason),
			RefType: refType,
			RefID:   refID,
		}
	}
	return n, nil
}

func (r *repoStub) GetLedgerDelta(ctx context.Context, reason, refType, refID string) (int, error) {
	if r.ledgerErr != nil {
		return 0, r.ledgerErr
	}
	return r.ledgerDelta, nil
}

func (r *repoStub) ListBirthdayUserIDs(ctx context.Context, month, day int, includeFeb29 bool) ([]int64, error) {
	if r.birthdayErr != nil {
		return nil, r.birthdayErr
	}
	return r.birthdayIDs, nil
}

func (r *repoStub) ListTransactions(ctx context.Context, userID int64, filter TransactionFilter) ([]LoyaltyTransaction, int64, error) {
	r.lastCustomerID = userID
	r.lastCustomerFilt = filter
	if r.txsErr != nil {
		return nil, 0, r.txsErr
	}
	if r.txs == nil {
		return []LoyaltyTransaction{}, r.txsTotal, nil
	}
	return r.txs, r.txsTotal, nil
}

func (r *repoStub) ListMembers(ctx context.Context, filter MemberFilter) ([]AdminMemberRow, int64, error) {
	r.lastMemberFilter = filter
	if r.membersErr != nil {
		return nil, 0, r.membersErr
	}
	return r.members, r.membersTotal, nil
}

func (r *repoStub) GetMemberByUserUUID(ctx context.Context, userUUID uuid.UUID) (*AdminMemberRow, error) {
	if r.memberErr != nil {
		return nil, r.memberErr
	}
	if r.member != nil {
		return r.member, nil
	}
	return nil, models.ErrNotFound
}

func (r *repoStub) ResolveUserID(ctx context.Context, userUUID uuid.UUID) (int64, error) {
	if r.resolveErr != nil {
		return 0, r.resolveErr
	}
	if r.internalID != 0 {
		return r.internalID, nil
	}
	if r.member != nil {
		return 1, nil
	}
	return 0, models.ErrNotFound
}

func (r *repoStub) FindAdminAdjust(ctx context.Context, userID int64, refIdentity string) (*LoyaltyTransaction, error) {
	if r.adjustErr != nil {
		return nil, r.adjustErr
	}
	if r.adjustTx != nil {
		return r.adjustTx, nil
	}
	return nil, models.ErrNotFound
}

func (r *repoStub) ListMemberTransactions(ctx context.Context, userUUID uuid.UUID, filter MemberTransactionFilter) ([]LoyaltyTransaction, int64, error) {
	r.lastTxUUID = userUUID
	r.lastTxFilter = filter
	if r.memberTxsErr != nil {
		return nil, 0, r.memberTxsErr
	}
	return r.memberTxs, r.memberTxsTotal, nil
}

func (r *repoStub) GetProgramme(ctx context.Context) (*programmeRow, error) {
	if r.programmeErr != nil {
		return nil, r.programmeErr
	}
	if r.programme != nil {
		return r.programme, nil
	}
	return nil, models.ErrNotFound
}

func (r *repoStub) ListProgrammeTiers(ctx context.Context) ([]ProgrammeTier, error) {
	if r.tiersErr != nil {
		return nil, r.tiersErr
	}
	if r.tiers != nil {
		return r.tiers, nil
	}
	return nil, nil
}

func (r *repoStub) SaveProgramme(ctx context.Context, row programmeRow, tiers []ProgrammeTier) error {
	cp := row
	r.savedRow = &cp
	r.savedTiers = append([]ProgrammeTier(nil), tiers...)
	r.programme = &cp
	r.tiers = append([]ProgrammeTier(nil), tiers...)
	return nil
}

func TestAwardForReviewVerifiedOnly(t *testing.T) {
	repo := &repoStub{awardGranted: true}
	svc := NewService(repo, nil, 10000, 1000, 100, 50, 200, 300, "Asia/Tehran")

	if err := svc.AwardForReview(context.Background(), 1, 9, false); err != nil {
		t.Fatal(err)
	}
	if len(repo.awardCalls) != 0 {
		t.Fatalf("non-verified should not award: %+v", repo.awardCalls)
	}

	if err := svc.AwardForReview(context.Background(), 1, 9, true); err != nil {
		t.Fatal(err)
	}
	if len(repo.awardCalls) != 1 || repo.awardCalls[0].delta != 50 {
		t.Fatalf("verified award = %+v", repo.awardCalls)
	}
	if repo.awardCalls[0].reason != "review" || repo.awardCalls[0].refI != "9" {
		t.Fatalf("key = %+v", repo.awardCalls[0])
	}

	// Second call still goes to Award (idempotency is repo layer).
	repo.awardGranted = false
	if err := svc.AwardForReview(context.Background(), 1, 9, true); err != nil {
		t.Fatal(err)
	}
	if len(repo.awardCalls) != 2 {
		t.Fatalf("expected second award attempt for double-earn path, got %d", len(repo.awardCalls))
	}
}

func TestAwardForReviewDisabled(t *testing.T) {
	repo := &repoStub{awardGranted: true}
	svc := NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC")
	if err := svc.AwardForReview(context.Background(), 1, 1, true); err != nil {
		t.Fatal(err)
	}
	if len(repo.awardCalls) != 0 {
		t.Fatal("bonus 0 must not award")
	}
}

func TestAwardBirthdayRefID(t *testing.T) {
	repo := &repoStub{awardGranted: true}
	svc := NewService(repo, nil, 10000, 1000, 0, 0, 200, 300, "Asia/Tehran")
	if err := svc.AwardBirthday(context.Background(), 42, 2026); err != nil {
		t.Fatal(err)
	}
	if len(repo.awardCalls) != 1 {
		t.Fatal(repo.awardCalls)
	}
	c := repo.awardCalls[0]
	if c.reason != "birthday" || c.refT != "user" || c.refI != "42:2026" || c.delta != 200 {
		t.Fatalf("birthday call = %+v", c)
	}
}

func TestRunBirthdayAwardsOncePerYearKey(t *testing.T) {
	repo := &repoStub{
		awardGranted: true,
		birthdayIDs:  []int64{7, 8},
	}
	svc := NewService(repo, nil, 10000, 1000, 0, 0, 200, 300, "UTC")
	// Fixed UTC noon so TZ does not shift day.
	now := time.Date(2026, 3, 15, 12, 0, 0, 0, time.UTC)
	n, err := svc.RunBirthdayAwards(context.Background(), now)
	if err != nil || n != 2 {
		t.Fatalf("granted=%d err=%v calls=%+v", n, err, repo.awardCalls)
	}
	for _, c := range repo.awardCalls {
		if c.refI != "7:2026" && c.refI != "8:2026" {
			t.Fatalf("unexpected ref %q", c.refI)
		}
	}
}

func TestClawbackOrderEarn(t *testing.T) {
	repo := &repoStub{ledgerDelta: 40, clawbackN: 40}
	svc := NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC")
	if err := svc.ClawbackOrderEarn(context.Background(), 3, 99); err != nil {
		t.Fatal(err)
	}

	repo.ledgerErr = models.ErrNotFound
	if err := svc.ClawbackOrderEarn(context.Background(), 3, 99); err != nil {
		t.Fatalf("missing order earn should no-op: %v", err)
	}
}

func TestGetIncludesRedeemValueFromProgramme(t *testing.T) {
	repo := &repoStub{
		account: &LoyaltyAccount{PointsBalance: 12, LifetimePoints: 20, Tier: TierBronze},
		programme: &programmeRow{
			Enabled:     true,
			EarnDivisor: 8000,
			RedeemValue: 500,
			BirthdayTZ:  "UTC",
		},
	}
	svc := NewService(repo, nil, 10000, 1000, 100, 50, 200, 300, "UTC")
	acc, err := svc.Get(context.Background(), 5)
	if err != nil {
		t.Fatal(err)
	}
	if acc.RedeemValue != 500 {
		t.Fatalf("redeem_value = %v, want 500", acc.RedeemValue)
	}
	if acc.PointsBalance != 12 || acc.LifetimePoints != 20 || acc.Tier != TierBronze {
		t.Fatalf("existing account fields changed: %+v", acc)
	}
}

func TestGetIncludesRedeemValueEnvFallback(t *testing.T) {
	repo := &repoStub{
		account: &LoyaltyAccount{PointsBalance: 3, LifetimePoints: 3, Tier: TierBronze},
	}
	svc := NewService(repo, nil, 10000, 2000, 100, 50, 200, 300, "UTC")
	acc, err := svc.Get(context.Background(), 5)
	if err != nil {
		t.Fatal(err)
	}
	if acc.RedeemValue != 2000 {
		t.Fatalf("env redeem_value = %v, want 2000", acc.RedeemValue)
	}
}

func TestGetEmptyAccountIncludesRedeemValue(t *testing.T) {
	svc := NewService(&repoStub{}, nil, 10000, 1000, 100, 50, 200, 300, "UTC")
	acc, err := svc.Get(context.Background(), 9)
	if err != nil {
		t.Fatal(err)
	}
	if acc.RedeemValue != 1000 {
		t.Fatalf("empty account redeem_value = %v", acc.RedeemValue)
	}
	if acc.PointsBalance != 0 || acc.Tier != TierBronze {
		t.Fatalf("empty = %+v", acc)
	}
}

func TestRedeemUsesIdempotencyKey(t *testing.T) {
	repo := &repoStub{
		spendReplay: true,
		account:     &LoyaltyAccount{PointsBalance: 10, LifetimePoints: 10, Tier: TierBronze},
	}
	svc := NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC")
	// Replayed spend must not require wallet (nil wallet would panic on deposit).
	acc, err := svc.Redeem(context.Background(), 5, 3, "client-key-01")
	if err != nil {
		t.Fatal(err)
	}
	if repo.spendRef != "5:idem:client-key-01" {
		t.Fatalf("ref = %q", repo.spendRef)
	}
	if acc.PointsBalance != 10 {
		t.Fatalf("acc = %+v", acc)
	}
}

func TestRedeemReplaySameUser(t *testing.T) {
	repo := &repoStub{
		spendReplay: true,
		account:     &LoyaltyAccount{PointsBalance: 7, LifetimePoints: 20, Tier: TierBronze},
	}
	svc := NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC")
	first, err := svc.Redeem(context.Background(), 5, 3, "replay-key-01")
	if err != nil {
		t.Fatal(err)
	}
	second, err := svc.Redeem(context.Background(), 5, 3, "replay-key-01")
	if err != nil {
		t.Fatal(err)
	}
	if first.PointsBalance != 7 || second.PointsBalance != 7 {
		t.Fatalf("first=%+v second=%+v", first, second)
	}
	if len(repo.spendCalls) != 2 {
		t.Fatalf("spend calls = %d", len(repo.spendCalls))
	}
	if repo.spendCalls[0].refID != "5:idem:replay-key-01" || repo.spendCalls[1].refID != repo.spendCalls[0].refID {
		t.Fatalf("spend refs = %+v", repo.spendCalls)
	}
}

func TestRedeemSameKeyDifferentUsers(t *testing.T) {
	repo := &repoStub{
		spendReplay: true,
		account:     &LoyaltyAccount{PointsBalance: 10, LifetimePoints: 10, Tier: TierBronze},
	}
	svc := NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC")
	if _, err := svc.Redeem(context.Background(), 1, 3, "shared-key-01"); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Redeem(context.Background(), 2, 3, "shared-key-01"); err != nil {
		t.Fatal(err)
	}
	if len(repo.spendCalls) != 2 {
		t.Fatalf("spend calls = %d", len(repo.spendCalls))
	}
	if repo.spendCalls[0].refID != "1:idem:shared-key-01" {
		t.Fatalf("user1 ref = %q", repo.spendCalls[0].refID)
	}
	if repo.spendCalls[1].refID != "2:idem:shared-key-01" {
		t.Fatalf("user2 ref = %q", repo.spendCalls[1].refID)
	}
	if repo.spendCalls[0].refID == repo.spendCalls[1].refID {
		t.Fatal("same client key must not collide across users")
	}
}

func TestRedeemRequiresKey(t *testing.T) {
	repo := &repoStub{account: &LoyaltyAccount{PointsBalance: 10, LifetimePoints: 10, Tier: TierBronze}}
	svc := NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC")
	for _, key := range []string{"", "   "} {
		_, err := svc.Redeem(context.Background(), 1, 5, key)
		if !errors.Is(err, apperr.ErrInvalidRequest) {
			t.Fatalf("key %q err = %v", key, err)
		}
	}
	if len(repo.spendCalls) != 0 {
		t.Fatalf("must not spend without key: %+v", repo.spendCalls)
	}
}

func TestRedeemInsufficientPoints(t *testing.T) {
	repo := &repoStub{spendErr: models.ErrInsufficientFunds}
	svc := NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC")
	_, err := svc.Redeem(context.Background(), 1, 5, "client-key-01")
	if !errors.Is(err, apperr.ErrInsufficientPoints) {
		t.Fatalf("err = %v", err)
	}
}

func TestRedeemRefIDScopedToUser(t *testing.T) {
	if got := redeemRefID(9, "  abc  "); got != "9:idem:abc" {
		t.Fatalf("got %q", got)
	}
	if got := redeemRefID(9, ""); got != "" {
		t.Fatalf("empty key must be invalid, got %q", got)
	}
	if redeemRefID(1, "same") == redeemRefID(2, "same") {
		t.Fatal("same client key must be user-scoped")
	}
}

func TestIsLeapYear(t *testing.T) {
	if !isLeapYear(2024) || isLeapYear(2026) {
		t.Fatal("leap year helper")
	}
}

func TestListMembersPagination(t *testing.T) {
	uid := uuid.MustParse("5b2c0000-0000-0000-0000-000000000001")
	repo := &repoStub{
		members: []AdminMemberRow{
			{UserID: uid, Email: "a@example.com", PointsBalance: 10, LifetimePoints: 40, Tier: TierBronze},
		},
		membersTotal: 25,
	}
	svc := NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC")

	rows, total, err := svc.ListMembers(context.Background(), MemberFilter{
		PaginationParams: models.PaginationParams{Page: 2, Limit: 10},
		Q:                "  a@  ",
		Tier:             " Silver ",
	})
	if err != nil {
		t.Fatal(err)
	}
	if total != 25 || len(rows) != 1 {
		t.Fatalf("rows=%d total=%d", len(rows), total)
	}
	if repo.lastMemberFilter.Page != 2 || repo.lastMemberFilter.Limit != 10 {
		t.Fatalf("filter page/limit = %+v", repo.lastMemberFilter)
	}
	if repo.lastMemberFilter.Q != "a@" || repo.lastMemberFilter.Tier != "silver" {
		t.Fatalf("q/tier not trimmed: %+v", repo.lastMemberFilter)
	}

	_, _, err = svc.ListMembers(context.Background(), MemberFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if repo.lastMemberFilter.Page != 1 || repo.lastMemberFilter.Limit != 20 {
		t.Fatalf("defaults = %+v", repo.lastMemberFilter)
	}
}

func TestGetMemberNotFound(t *testing.T) {
	repo := &repoStub{memberErr: models.ErrNotFound}
	svc := NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC")
	_, err := svc.GetMember(context.Background(), uuid.MustParse("5b2c0000-0000-0000-0000-000000000099"))
	if !errors.Is(err, apperr.ErrUserNotFound) {
		t.Fatalf("err = %v", err)
	}
}

func TestGetMemberNilUUID(t *testing.T) {
	svc := NewService(&repoStub{}, nil, 10000, 1000, 0, 0, 0, 300, "UTC")
	_, err := svc.GetMember(context.Background(), uuid.Nil)
	if !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("err = %v", err)
	}
}

func TestGetMemberBuildsStanding(t *testing.T) {
	uid := uuid.MustParse("5b2c0000-0000-0000-0000-000000000002")
	name := "Ada Lovelace"
	repo := &repoStub{
		member: &AdminMemberRow{
			UserID:         uid,
			Email:          "ada@example.com",
			DisplayName:    &name,
			PointsBalance:  80,
			LifetimePoints: 1200,
			Tier:           TierSilver,
			UpdatedAt:      time.Date(2026, 8, 16, 10, 0, 0, 0, time.UTC),
		},
	}
	svc := NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC")
	acc, err := svc.GetMember(context.Background(), uid)
	if err != nil {
		t.Fatal(err)
	}
	if acc.UserID != uid || acc.Email != "ada@example.com" || acc.DisplayName == nil || *acc.DisplayName != name {
		t.Fatalf("identity = %+v", acc)
	}
	if acc.Tier != TierSilver || acc.NextTier != TierGold || acc.PointsToNext != 3800 {
		t.Fatalf("standing = %+v", acc)
	}
}

func TestListTransactionsPagination(t *testing.T) {
	created := time.Date(2026, 8, 16, 12, 0, 0, 0, time.UTC)
	repo := &repoStub{
		txs: []LoyaltyTransaction{
			{ID: 7, Delta: 50, Reason: LoyaltyReasonOrderPaid, RefType: "order", RefID: "99", CreatedAt: created},
		},
		txsTotal: 41,
	}
	svc := NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC")
	rows, total, err := svc.ListTransactions(context.Background(), 5, TransactionFilter{
		PaginationParams: models.PaginationParams{Page: 2, Limit: 10},
	})
	if err != nil {
		t.Fatal(err)
	}
	if total != 41 || len(rows) != 1 {
		t.Fatalf("rows=%d total=%d", len(rows), total)
	}
	if rows[0].ID != 7 || rows[0].RefType != "order" || rows[0].RefID != "99" {
		t.Fatalf("row = %+v", rows[0])
	}
	if rows[0].Delta != 50 || rows[0].Reason != LoyaltyReasonOrderPaid {
		t.Fatalf("row = %+v", rows[0])
	}
	if repo.lastCustomerID != 5 {
		t.Fatalf("user = %d", repo.lastCustomerID)
	}
	if repo.lastCustomerFilt.Page != 2 || repo.lastCustomerFilt.Limit != 10 {
		t.Fatalf("filter = %+v", repo.lastCustomerFilt)
	}

	_, _, err = svc.ListTransactions(context.Background(), 5, TransactionFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if repo.lastCustomerFilt.Page != 1 || repo.lastCustomerFilt.Limit != 20 {
		t.Fatalf("defaults = %+v", repo.lastCustomerFilt)
	}
}

func TestListTransactionsEmpty(t *testing.T) {
	repo := &repoStub{txsTotal: 0}
	svc := NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC")
	rows, total, err := svc.ListTransactions(context.Background(), 5, TransactionFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if total != 0 || rows == nil || len(rows) != 0 {
		t.Fatalf("empty = rows=%v total=%d", rows, total)
	}
}

func TestListTransactionsRepoError(t *testing.T) {
	repo := &repoStub{txsErr: errors.New("db down")}
	svc := NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC")
	rows, total, err := svc.ListTransactions(context.Background(), 5, TransactionFilter{})
	if !errors.Is(err, apperr.ErrInternal) {
		t.Fatalf("err = %v", err)
	}
	if rows != nil || total != 0 {
		t.Fatalf("must not collapse error to empty: rows=%v total=%d", rows, total)
	}
}

func TestListMemberTransactionsPagination(t *testing.T) {
	uid := uuid.MustParse("5b2c0000-0000-0000-0000-000000000003")
	created := time.Date(2026, 8, 16, 12, 0, 0, 0, time.UTC)
	repo := &repoStub{
		memberTxs: []LoyaltyTransaction{
			{ID: 9, Delta: -20, Reason: LoyaltyReasonRedeem, RefType: "redeem", RefID: "idem:abc", CreatedAt: created},
		},
		memberTxsTotal: 41,
	}
	svc := NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC")
	txs, total, err := svc.ListMemberTransactions(context.Background(), uid, MemberTransactionFilter{
		PaginationParams: models.PaginationParams{Page: 3, Limit: 15},
		Reason:           " redeem ",
	})
	if err != nil {
		t.Fatal(err)
	}
	if total != 41 || len(txs) != 1 {
		t.Fatalf("txs=%d total=%d", len(txs), total)
	}
	if txs[0].ID != 9 || txs[0].RefType != "redeem" || txs[0].RefID != "idem:abc" {
		t.Fatalf("row = %+v", txs[0])
	}
	if repo.lastTxUUID != uid {
		t.Fatalf("uuid = %s", repo.lastTxUUID)
	}
	if repo.lastTxFilter.Page != 3 || repo.lastTxFilter.Limit != 15 || repo.lastTxFilter.Reason != "redeem" {
		t.Fatalf("tx filter = %+v", repo.lastTxFilter)
	}
}

func TestListMemberTransactionsNotFound(t *testing.T) {
	repo := &repoStub{memberTxsErr: models.ErrNotFound}
	svc := NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC")
	_, _, err := svc.ListMemberTransactions(context.Background(), uuid.New(), MemberTransactionFilter{})
	if !errors.Is(err, apperr.ErrUserNotFound) {
		t.Fatalf("err = %v", err)
	}
}

func TestAdjustGrant(t *testing.T) {
	uid := uuid.MustParse("5b2c0000-0000-0000-0000-000000000020")
	actor := uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	repo := &repoStub{
		awardGranted: true,
		internalID:   7,
		member: &AdminMemberRow{
			UserID:         uid,
			Email:          "m@example.com",
			PointsBalance:  10,
			LifetimePoints: 10,
			Tier:           TierBronze,
		},
	}
	svc := NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC")
	res, err := svc.Adjust(context.Background(), actor, uid, 25, "goodwill", "adjust-key-01")
	if err != nil {
		t.Fatal(err)
	}
	if res.Replayed || res.Delta != 25 || res.ActorUserID != actor.String() {
		t.Fatalf("result = %+v", res)
	}
	if res.PointsBalance != 35 || res.LifetimePoints != 35 {
		t.Fatalf("standing = %+v", res)
	}
	if len(repo.awardCalls) != 1 {
		t.Fatalf("award calls = %d", len(repo.awardCalls))
	}
	c := repo.awardCalls[0]
	if c.userID != 7 || c.delta != 25 || c.reason != "admin_adjust" || c.refT != "admin" {
		t.Fatalf("award = %+v", c)
	}
	if c.refI != "adjust-key-01|actor="+actor.String() {
		t.Fatalf("ref_id = %q", c.refI)
	}
	if len(repo.clawbackCalls) != 0 {
		t.Fatalf("clawback should not run on grant: %+v", repo.clawbackCalls)
	}
}

func TestAdjustClawbackLifetimeUnchanged(t *testing.T) {
	uid := uuid.MustParse("5b2c0000-0000-0000-0000-000000000021")
	actor := uuid.MustParse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
	repo := &repoStub{
		internalID: 8,
		member: &AdminMemberRow{
			UserID:         uid,
			Email:          "c@example.com",
			PointsBalance:  40,
			LifetimePoints: 100,
			Tier:           TierBronze,
		},
	}
	svc := NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC")
	res, err := svc.Adjust(context.Background(), actor, uid, -20, "clawback", "adjust-key-02")
	if err != nil {
		t.Fatal(err)
	}
	if res.Replayed || res.Delta != -20 {
		t.Fatalf("result = %+v", res)
	}
	if res.PointsBalance != 20 {
		t.Fatalf("balance = %d", res.PointsBalance)
	}
	if res.LifetimePoints != 100 {
		t.Fatalf("lifetime changed: %d", res.LifetimePoints)
	}
	if len(repo.awardCalls) != 0 {
		t.Fatalf("award must not run on clawback: %+v", repo.awardCalls)
	}
	if len(repo.clawbackCalls) != 1 || repo.clawbackCalls[0].maxPoints != 20 {
		t.Fatalf("clawback = %+v", repo.clawbackCalls)
	}
	if repo.clawbackCalls[0].reason != "admin_adjust" || repo.clawbackCalls[0].refT != "admin" {
		t.Fatalf("clawback key = %+v", repo.clawbackCalls[0])
	}
}

func TestAdjustReplay(t *testing.T) {
	uid := uuid.MustParse("5b2c0000-0000-0000-0000-000000000022")
	actor := uuid.MustParse("cccccccc-cccc-cccc-cccc-cccccccccccc")
	repo := &repoStub{
		internalID: 9,
		member: &AdminMemberRow{
			UserID:         uid,
			PointsBalance:  50,
			LifetimePoints: 50,
			Tier:           TierBronze,
		},
		adjustTx: &LoyaltyTransaction{
			Delta:   50,
			Reason:  LoyaltyReasonAdminAdjust,
			RefType: adminAdjustRefType,
			RefID:   "same-key-xx|actor=" + actor.String(),
		},
	}
	svc := NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC")
	res, err := svc.Adjust(context.Background(), actor, uid, 50, "again", "same-key-xx")
	if err != nil {
		t.Fatal(err)
	}
	if !res.Replayed || res.Delta != 50 {
		t.Fatalf("result = %+v", res)
	}
	if len(repo.awardCalls) != 0 || len(repo.clawbackCalls) != 0 {
		t.Fatalf("replay must not write: award=%+v clawback=%+v", repo.awardCalls, repo.clawbackCalls)
	}
}

func TestAdjustUnknownUser(t *testing.T) {
	svc := NewService(&repoStub{resolveErr: models.ErrNotFound}, nil, 10000, 1000, 0, 0, 0, 300, "UTC")
	_, err := svc.Adjust(
		context.Background(),
		uuid.MustParse("dddddddd-dddd-dddd-dddd-dddddddddddd"),
		uuid.MustParse("5b2c0000-0000-0000-0000-000000000404"),
		10, "n", "adjust-key-03",
	)
	if !errors.Is(err, apperr.ErrUserNotFound) {
		t.Fatalf("err = %v", err)
	}
}

func TestAdjustDeltaZero(t *testing.T) {
	svc := NewService(&repoStub{internalID: 1}, nil, 10000, 1000, 0, 0, 0, 300, "UTC")
	_, err := svc.Adjust(
		context.Background(),
		uuid.MustParse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"),
		uuid.MustParse("5b2c0000-0000-0000-0000-000000000023"),
		0, "n", "adjust-key-04",
	)
	if !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("err = %v", err)
	}
}

func TestAdjustRejectsBadKey(t *testing.T) {
	svc := NewService(&repoStub{internalID: 1}, nil, 10000, 1000, 0, 0, 0, 300, "UTC")
	actor := uuid.MustParse("ffffffff-ffff-ffff-ffff-ffffffffffff")
	uid := uuid.MustParse("5b2c0000-0000-0000-0000-000000000024")
	if _, err := svc.Adjust(context.Background(), actor, uid, 5, "", "short"); !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("short key err = %v", err)
	}
	if _, err := svc.Adjust(context.Background(), actor, uid, 5, "", "has space xx"); !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("space key err = %v", err)
	}
}

func TestAdminAdjustRefIDFitsActor(t *testing.T) {
	actor := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	got := adminAdjustRefID("adjust01", actor)
	if got != "adjust01|actor="+actor.String() {
		t.Fatalf("got %q", got)
	}
	if ident := adminAdjustRefIdentity("adjust01"); ident != "adjust01" {
		t.Fatalf("ident = %q", ident)
	}
}

func TestProgrammeEnvFallbackWhenRowMissing(t *testing.T) {
	svc := NewService(&repoStub{}, nil, 10000, 1000, 100, 50, 200, 300, "Asia/Tehran")
	p, err := svc.Programme(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if p.Editable || p.ConfigSource != "env" {
		t.Fatalf("expected env fallback: %+v", p)
	}
	if !p.Enabled {
		t.Fatal("env fallback must be enabled")
	}
	if p.EarnDivisor != 10000 || p.RedeemValue != 1000 || p.SignupBonus != 100 {
		t.Fatalf("rates = %+v", p)
	}
	if p.ReviewBonus != 50 || p.BirthdayBonus != 200 || p.ReferralReward != 300 {
		t.Fatalf("bonuses = %+v", p)
	}
	if p.BirthdayTZ != "Asia/Tehran" || len(p.Tiers) != 4 {
		t.Fatalf("tz/tiers = %+v", p)
	}
	if p.Tiers[3].ID != "cellar" || p.Tiers[3].MinLifetimePoints != 20000 {
		t.Fatalf("cellar tier = %+v", p.Tiers[3])
	}
}

func TestProgrammeFromDBIncludesEnabled(t *testing.T) {
	repo := &repoStub{
		programme: &programmeRow{
			Enabled:        true,
			EarnDivisor:    8000,
			RedeemValue:    500,
			SignupBonus:    10,
			ReviewBonus:    20,
			BirthdayBonus:  30,
			BirthdayTZ:     "UTC",
			ReferralReward: 40,
		},
		tiers: []ProgrammeTier{
			{ID: "bronze", MinLifetimePoints: 0},
			{ID: "silver", MinLifetimePoints: 100},
			{ID: "gold", MinLifetimePoints: 200},
			{ID: "cellar", MinLifetimePoints: 300},
		},
	}
	svc := NewService(repo, nil, 10000, 1000, 100, 50, 200, 300, "Asia/Tehran")
	p, err := svc.Programme(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if !p.Enabled || !p.Editable || p.ConfigSource != "db" {
		t.Fatalf("expected db source: %+v", p)
	}
	if p.EarnDivisor != 8000 || p.RedeemValue != 500 || p.ReferralReward != 40 {
		t.Fatalf("rates = %+v", p)
	}
	if p.Tiers[1].MinLifetimePoints != 100 || p.Tiers[3].MinLifetimePoints != 300 {
		t.Fatalf("tiers = %+v", p.Tiers)
	}
}

func TestUpdateProgrammePersistsThenGet(t *testing.T) {
	repo := &repoStub{}
	svc := NewService(repo, nil, 10000, 1000, 100, 50, 200, 300, "Asia/Tehran")
	enabled := false
	got, err := svc.UpdateProgramme(context.Background(), UpdateProgrammeRequest{
		EarnDivisor:    2500,
		RedeemValue:    200,
		SignupBonus:    5,
		ReviewBonus:    6,
		BirthdayBonus:  7,
		BirthdayTZ:     "UTC",
		ReferralReward: 8,
		Enabled:        &enabled,
		Tiers: []ProgrammeTier{
			{ID: "bronze", MinLifetimePoints: 0},
			{ID: "silver", MinLifetimePoints: 50},
			{ID: "gold", MinLifetimePoints: 150},
			{ID: "cellar", MinLifetimePoints: 400},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if repo.savedRow == nil || repo.savedRow.EarnDivisor != 2500 || repo.savedRow.Enabled {
		t.Fatalf("saved = %+v", repo.savedRow)
	}
	if got.ConfigSource != "db" || got.Enabled || got.EarnDivisor != 2500 || got.RedeemValue != 200 {
		t.Fatalf("update response = %+v", got)
	}
	if got.Tiers[2].ID != "gold" || got.Tiers[2].MinLifetimePoints != 150 {
		t.Fatalf("tiers = %+v", got.Tiers)
	}

	again, err := svc.Programme(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if again.EarnDivisor != 2500 || again.Enabled || again.BirthdayTZ != "UTC" {
		t.Fatalf("get after put = %+v", again)
	}
}

func TestUpdateProgrammeValidation(t *testing.T) {
	svc := NewService(&repoStub{}, nil, 10000, 1000, 100, 50, 200, 300, "UTC")
	enabled := true
	validTiers := []ProgrammeTier{
		{ID: "bronze", MinLifetimePoints: 0},
		{ID: "silver", MinLifetimePoints: 1000},
		{ID: "gold", MinLifetimePoints: 5000},
		{ID: "cellar", MinLifetimePoints: 20000},
	}
	cases := []struct {
		name string
		req  UpdateProgrammeRequest
	}{
		{
			name: "divisor",
			req: UpdateProgrammeRequest{
				EarnDivisor: 0, RedeemValue: 1000, Enabled: &enabled, Tiers: validTiers,
			},
		},
		{
			name: "missing enabled",
			req: UpdateProgrammeRequest{
				EarnDivisor: 10000, RedeemValue: 1000, Tiers: validTiers,
			},
		},
		{
			name: "bronze not zero",
			req: UpdateProgrammeRequest{
				EarnDivisor: 10000, RedeemValue: 1000, Enabled: &enabled,
				Tiers: []ProgrammeTier{
					{ID: "bronze", MinLifetimePoints: 10},
					{ID: "silver", MinLifetimePoints: 1000},
					{ID: "gold", MinLifetimePoints: 5000},
					{ID: "cellar", MinLifetimePoints: 20000},
				},
			},
		},
		{
			name: "not increasing",
			req: UpdateProgrammeRequest{
				EarnDivisor: 10000, RedeemValue: 1000, Enabled: &enabled,
				Tiers: []ProgrammeTier{
					{ID: "bronze", MinLifetimePoints: 0},
					{ID: "silver", MinLifetimePoints: 5000},
					{ID: "gold", MinLifetimePoints: 1000},
					{ID: "cellar", MinLifetimePoints: 20000},
				},
			},
		},
		{
			name: "bad tz",
			req: UpdateProgrammeRequest{
				EarnDivisor: 10000, RedeemValue: 1000, Enabled: &enabled,
				BirthdayTZ: "Not/AZone", Tiers: validTiers,
			},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := svc.UpdateProgramme(context.Background(), tc.req)
			if !errors.Is(err, apperr.ErrValidation) {
				t.Fatalf("err = %v", err)
			}
		})
	}
}

func TestEnabledFalseSkipsAwardAndRejectsRedeem(t *testing.T) {
	repo := &repoStub{
		awardGranted: true,
		account:      &LoyaltyAccount{PointsBalance: 10, LifetimePoints: 10, Tier: TierBronze},
		programme:    &programmeRow{Enabled: false, EarnDivisor: 10000, RedeemValue: 1000, BirthdayTZ: "UTC"},
		tiers:        DefaultProgrammeTiers(),
	}
	svc := NewService(repo, nil, 10000, 1000, 100, 50, 200, 300, "UTC")

	if err := svc.AwardForOrder(context.Background(), 1, 9, 100000); err != nil {
		t.Fatal(err)
	}
	if err := svc.AwardSignup(context.Background(), 1); err != nil {
		t.Fatal(err)
	}
	if err := svc.AwardForReview(context.Background(), 1, 3, true); err != nil {
		t.Fatal(err)
	}
	if err := svc.Award(context.Background(), 1, 10, "referral", "referral", "1"); err != nil {
		t.Fatal(err)
	}
	if len(repo.awardCalls) != 0 {
		t.Fatalf("disabled programme must skip awards: %+v", repo.awardCalls)
	}

	_, err := svc.Redeem(context.Background(), 1, 3, "client-key-01")
	if !errors.Is(err, apperr.ErrLoyaltyDisabled) {
		t.Fatalf("redeem err = %v", err)
	}
	if len(repo.spendCalls) != 0 {
		t.Fatalf("must not spend when disabled: %+v", repo.spendCalls)
	}

	uid := uuid.MustParse("5b2c0000-0000-0000-0000-000000000040")
	actor := uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa10")
	repo.internalID = 4
	repo.member = &AdminMemberRow{UserID: uid, PointsBalance: 10, LifetimePoints: 10, Tier: TierBronze}
	_, err = svc.Adjust(context.Background(), actor, uid, 5, "n", "adjust-key-disabled")
	if !errors.Is(err, apperr.ErrLoyaltyDisabled) {
		t.Fatalf("adjust grant err = %v", err)
	}
	_, err = svc.Adjust(context.Background(), actor, uid, -5, "n", "adjust-key-disabled2")
	if !errors.Is(err, apperr.ErrLoyaltyDisabled) {
		t.Fatalf("adjust clawback err = %v", err)
	}
	if len(repo.awardCalls) != 0 || len(repo.clawbackCalls) != 0 {
		t.Fatalf("adjust must not write when disabled")
	}

	// Reads still work.
	if _, err := svc.Get(context.Background(), 1); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Programme(context.Background()); err != nil {
		t.Fatal(err)
	}
}

func TestAwardUsesLiveTierThresholds(t *testing.T) {
	repo := &repoStub{
		awardGranted: true,
		programme: &programmeRow{
			Enabled:     true,
			EarnDivisor: 1000,
			RedeemValue: 1000,
			BirthdayTZ:  "UTC",
		},
		tiers: []ProgrammeTier{
			{ID: "bronze", MinLifetimePoints: 0},
			{ID: "silver", MinLifetimePoints: 100},
			{ID: "gold", MinLifetimePoints: 250},
			{ID: "cellar", MinLifetimePoints: 400},
		},
	}
	svc := NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC")
	if err := svc.AwardForOrder(context.Background(), 2, 77, 5000); err != nil {
		t.Fatal(err)
	}
	if len(repo.awardCalls) != 1 || repo.awardCalls[0].delta != 5 {
		t.Fatalf("award = %+v", repo.awardCalls)
	}
	if repo.lastTiers.Silver != 100 || repo.lastTiers.Gold != 250 || repo.lastTiers.Cellar != 400 {
		t.Fatalf("thresholds = %+v (must not be hardcoded 1000/5000/20000)", repo.lastTiers)
	}

	repo.member = &AdminMemberRow{
		UserID:         uuid.MustParse("5b2c0000-0000-0000-0000-000000000041"),
		PointsBalance:  80,
		LifetimePoints: 120,
		Tier:           TierSilver,
	}
	acc, err := svc.GetMember(context.Background(), repo.member.UserID)
	if err != nil {
		t.Fatal(err)
	}
	if acc.NextTier != TierGold || acc.PointsToNext != 130 {
		t.Fatalf("standing with custom tiers = %+v", acc)
	}
}

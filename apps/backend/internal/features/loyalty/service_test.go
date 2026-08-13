package loyalty

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

type repoStub struct {
	awardCalls    []awardCall
	awardGranted  bool
	awardErr      error
	spendReplay   bool
	spendErr      error
	spendRef      string
	clawbackN     int
	clawbackErr   error
	ledgerDelta   int
	ledgerErr     error
	birthdayIDs   []int64
	birthdayErr   error
	account       *LoyaltyAccount
	accountErr    error
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

func (r *repoStub) Award(ctx context.Context, userID int64, delta int, reason, refType, refID string) (bool, error) {
	r.awardCalls = append(r.awardCalls, awardCall{userID, delta, reason, refType, refID})
	if r.awardErr != nil {
		return false, r.awardErr
	}
	return r.awardGranted, nil
}

func (r *repoStub) Spend(ctx context.Context, userID, points int64, refID string) (bool, error) {
	r.spendRef = refID
	if r.spendErr != nil {
		return false, r.spendErr
	}
	return r.spendReplay, nil
}

func (r *repoStub) Clawback(ctx context.Context, userID int64, maxPoints int, reason, refType, refID string) (int, error) {
	if r.clawbackErr != nil {
		return 0, r.clawbackErr
	}
	if r.clawbackN > 0 {
		return r.clawbackN, nil
	}
	return maxPoints, nil
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

func (r *repoStub) ListTransactions(ctx context.Context, userID int64, limit int) ([]LoyaltyTransaction, error) {
	return nil, nil
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
	if repo.spendRef != "idem:client-key-01" {
		t.Fatalf("ref = %q", repo.spendRef)
	}
	if acc.PointsBalance != 10 {
		t.Fatalf("acc = %+v", acc)
	}
}

func TestRedeemInsufficientPoints(t *testing.T) {
	repo := &repoStub{spendErr: models.ErrInsufficientFunds}
	svc := NewService(repo, nil, 10000, 1000, 0, 0, 0, 300, "UTC")
	_, err := svc.Redeem(context.Background(), 1, 5, "")
	if !errors.Is(err, apperr.ErrInsufficientPoints) {
		t.Fatalf("err = %v", err)
	}
}

func TestRedeemRefIDFallback(t *testing.T) {
	if got := redeemRefID(9, "  abc  "); got != "idem:abc" {
		// Trim is applied in Redeem before redeemRefID only if we trim in Redeem —
		// redeemRefID also trims.
		t.Fatalf("got %q", got)
	}
	got := redeemRefID(9, "")
	if got == "" || got[:2] != "9-" {
		t.Fatalf("fallback ref = %q", got)
	}
}

func TestIsLeapYear(t *testing.T) {
	if !isLeapYear(2024) || isLeapYear(2026) {
		t.Fatal("leap year helper")
	}
}

func TestProgrammeReadOnlyEnvSnapshot(t *testing.T) {
	svc := NewService(nil, nil, 10000, 1000, 100, 50, 200, 300, "Asia/Tehran")
	p := svc.Programme()
	if p.Editable || p.ConfigSource != "env" {
		t.Fatalf("expected env read-only: %+v", p)
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

package referral

import (
	"context"
	"errors"
	"testing"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

type awardCall struct {
	userID  int64
	delta   int
	reason  string
	refType string
	refID   string
}

type awardStub struct {
	calls  []awardCall
	failOn int // 1-based call index to fail; 0 = never
	err    error
}

func (a *awardStub) Award(_ context.Context, userID int64, delta int, reason, refType, refID string) error {
	a.calls = append(a.calls, awardCall{userID, delta, reason, refType, refID})
	if a.failOn > 0 && len(a.calls) == a.failOn {
		if a.err != nil {
			return a.err
		}
		return errors.New("award failed")
	}
	return nil
}

type refRepoStub struct {
	pending       *Referral
	completeCalls int
	findErr       error
	completeErr   error

	codes       map[string]int64
	codeErr     error
	hasReferral bool
	hasErr      error
	createErr   error
	createCalls int
	createdFor  int64
}

func (r *refRepoStub) GetCode(context.Context, int64) (string, error)  { return "", models.ErrNotFound }
func (r *refRepoStub) CreateCode(context.Context, int64, string) error { return nil }
func (r *refRepoStub) GetUserByCode(_ context.Context, code string) (int64, error) {
	if r.codeErr != nil {
		return 0, r.codeErr
	}
	if r.codes != nil {
		if id, ok := r.codes[code]; ok {
			return id, nil
		}
	}
	return 0, models.ErrNotFound
}
func (r *refRepoStub) HasReferral(context.Context, int64) (bool, error) {
	if r.hasErr != nil {
		return false, r.hasErr
	}
	return r.hasReferral, nil
}
func (r *refRepoStub) CreateReferral(_ context.Context, referrerID, refereeID int64, _ int) error {
	r.createCalls++
	r.createdFor = refereeID
	_ = referrerID
	if r.createErr != nil {
		return r.createErr
	}
	return nil
}
func (r *refRepoStub) FindPendingByReferee(context.Context, int64) (*Referral, error) {
	if r.findErr != nil {
		return nil, r.findErr
	}
	if r.pending == nil {
		return nil, models.ErrNotFound
	}
	cp := *r.pending
	return &cp, nil
}
func (r *refRepoStub) Complete(context.Context, int64) error {
	r.completeCalls++
	if r.completeErr != nil {
		return r.completeErr
	}
	r.pending = nil
	return nil
}
func (r *refRepoStub) Counts(context.Context, int64) (int, int, error) { return 0, 0, nil }

func pendingRef() *Referral {
	return &Referral{
		ID:             42,
		ReferrerUserID: 7,
		RefereeUserID:  9,
		Status:         ReferralStatusPending,
		RewardPoints:   300,
	}
}

func TestOnPaidOrder_AwardFailureDoesNotComplete(t *testing.T) {
	repo := &refRepoStub{pending: pendingRef()}
	loy := &awardStub{failOn: 1, err: errors.New("ledger down")}
	svc := NewService(repo, loy, 300)

	err := svc.OnPaidOrder(context.Background(), 9)
	if err == nil {
		t.Fatal("want award error so the caller can retry")
	}
	if repo.completeCalls != 0 {
		t.Fatalf("Complete calls = %d; must not Complete when Award fails", repo.completeCalls)
	}
	if repo.pending == nil {
		t.Fatal("pending row must remain for retry")
	}
	if len(loy.calls) != 1 {
		t.Fatalf("Award calls = %d; want 1 (referrer only before fail)", len(loy.calls))
	}
}

func TestOnPaidOrder_RefereeAwardFailureDoesNotComplete(t *testing.T) {
	repo := &refRepoStub{pending: pendingRef()}
	loy := &awardStub{failOn: 2, err: errors.New("second side down")}
	svc := NewService(repo, loy, 300)

	if err := svc.OnPaidOrder(context.Background(), 9); err == nil {
		t.Fatal("want error when referee Award fails")
	}
	if repo.completeCalls != 0 {
		t.Fatal("must not Complete when referee Award fails")
	}
	if len(loy.calls) != 2 {
		t.Fatalf("Award calls = %d; want referrer + referee", len(loy.calls))
	}
}

func TestOnPaidOrder_RetryThenCompletes_NoDoubleAwardKeys(t *testing.T) {
	repo := &refRepoStub{pending: pendingRef()}
	loy := &awardStub{failOn: 1, err: errors.New("transient")}
	svc := NewService(repo, loy, 300)

	if err := svc.OnPaidOrder(context.Background(), 9); err == nil {
		t.Fatal("first call should fail on Award")
	}
	if repo.completeCalls != 0 {
		t.Fatal("first call must not Complete")
	}

	loy.failOn = 0
	if err := svc.OnPaidOrder(context.Background(), 9); err != nil {
		t.Fatalf("retry OnPaidOrder: %v", err)
	}
	if repo.completeCalls != 1 {
		t.Fatalf("Complete calls = %d; want 1 after successful awards", repo.completeCalls)
	}
	if repo.pending != nil {
		t.Fatal("pending row should be cleared after Complete")
	}

	// Replay: no pending row → no further Award / Complete (idempotent at service).
	if err := svc.OnPaidOrder(context.Background(), 9); err != nil {
		t.Fatalf("third OnPaidOrder: %v", err)
	}
	if repo.completeCalls != 1 {
		t.Fatalf("Complete after replay = %d; want still 1", repo.completeCalls)
	}

	// Awards on retry reuse the same referral-id key (loyalty UNIQUE is the double-grant guard).
	if len(loy.calls) != 3 {
		t.Fatalf("Award calls = %d; want 3 (1 fail + 2 success)", len(loy.calls))
	}
	for _, c := range loy.calls {
		if c.refType != "referral" || c.refID != "42" || c.delta != 300 {
			t.Fatalf("unexpected award %+v; want ref_id=42 reason keys", c)
		}
	}
	if loy.calls[1].reason != "referral" || loy.calls[1].userID != 7 {
		t.Fatalf("retry first award = %+v; want referrer", loy.calls[1])
	}
	if loy.calls[2].reason != "referral_welcome" || loy.calls[2].userID != 9 {
		t.Fatalf("retry second award = %+v; want referee", loy.calls[2])
	}
}

func TestClaim_Success(t *testing.T) {
	repo := &refRepoStub{codes: map[string]int64{"RUMERA24": 7}}
	svc := NewService(repo, nil, 300)

	if err := svc.Claim(context.Background(), 9, " rumera24 "); err != nil {
		t.Fatalf("claim: %v", err)
	}
	if repo.createCalls != 1 {
		t.Fatalf("CreateReferral calls = %d; want 1", repo.createCalls)
	}
	if repo.createdFor != 9 {
		t.Fatalf("created referee = %d; want 9", repo.createdFor)
	}
}

func TestClaim_RejectsInvalidAndAlreadyClaimed(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name string
		repo *refRepoStub
		id   int64
		code string
	}{
		{name: "empty", repo: &refRepoStub{}, id: 9, code: "  "},
		{name: "unknown", repo: &refRepoStub{}, id: 9, code: "NOPE"},
		{name: "self", repo: &refRepoStub{codes: map[string]int64{"RUMERA24": 9}}, id: 9, code: "RUMERA24"},
		{name: "already", repo: &refRepoStub{codes: map[string]int64{"RUMERA24": 7}, hasReferral: true}, id: 9, code: "RUMERA24"},
		{name: "race", repo: &refRepoStub{codes: map[string]int64{"RUMERA24": 7}, createErr: models.ErrConflict}, id: 9, code: "RUMERA24"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			svc := NewService(tc.repo, nil, 300)
			err := svc.Claim(context.Background(), tc.id, tc.code)
			if !errors.Is(err, apperr.ErrInvalidRequest) {
				t.Fatalf("err = %v; want INVALID_REQUEST", err)
			}
			if tc.name != "race" && tc.repo.createCalls != 0 {
				t.Fatalf("CreateReferral calls = %d; rejected claim must not insert", tc.repo.createCalls)
			}
		})
	}
}

func TestClaim_LookupFailureIsInternal(t *testing.T) {
	repo := &refRepoStub{codeErr: errors.New("db down")}
	svc := NewService(repo, nil, 300)
	if err := svc.Claim(context.Background(), 9, "RUMERA24"); !errors.Is(err, apperr.ErrInternal) {
		t.Fatalf("err = %v; want INTERNAL_ERROR", err)
	}
	if repo.createCalls != 0 {
		t.Fatal("must not insert when lookup fails")
	}
}

func TestOnPaidOrder_NoPending_NoOp(t *testing.T) {
	repo := &refRepoStub{}
	loy := &awardStub{}
	svc := NewService(repo, loy, 300)
	if err := svc.OnPaidOrder(context.Background(), 9); err != nil {
		t.Fatalf("no pending: %v", err)
	}
	if len(loy.calls) != 0 || repo.completeCalls != 0 {
		t.Fatal("no pending referral must not award or complete")
	}
}

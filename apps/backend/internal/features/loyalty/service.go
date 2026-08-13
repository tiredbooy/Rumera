package loyalty

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/tiredbooy/internal/features/wallet"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
	"github.com/tiredbooy/pkg/metrics"
)

// Service runs the points programme: earning (idempotent), tier tracking,
// and redemption into the customer's wallet.
type Service struct {
	repo           Repository
	wallet         *wallet.Service
	earnDivisor    float64 // Toman per point earned
	redeemValue    float64 // Toman of wallet credit per point redeemed
	signupBonus    int
	reviewBonus    int
	birthdayBonus  int
	referralReward int
	birthdayTZ     string
	birthdayLoc    *time.Location
}

// NewService constructs the loyalty programme service.
// birthdayTZ is an IANA name (e.g. Asia/Tehran); invalid values fall back to Tehran then UTC.
// referralReward is mirrored from LOYALTY_REFERRAL_REWARD for the admin programme view.
func NewService(
	repo Repository,
	wallet *wallet.Service,
	earnDivisor, redeemValue float64,
	signupBonus, reviewBonus, birthdayBonus, referralReward int,
	birthdayTZ string,
) *Service {
	if earnDivisor <= 0 {
		earnDivisor = 10000
	}
	if redeemValue <= 0 {
		redeemValue = 1000
	}
	loc := loadBirthdayLocation(birthdayTZ)
	tzName := strings.TrimSpace(birthdayTZ)
	if tzName == "" {
		tzName = "Asia/Tehran"
	}
	return &Service{
		repo:           repo,
		wallet:         wallet,
		earnDivisor:    earnDivisor,
		redeemValue:    redeemValue,
		signupBonus:    signupBonus,
		reviewBonus:    reviewBonus,
		birthdayBonus:  birthdayBonus,
		referralReward: referralReward,
		birthdayTZ:     tzName,
		birthdayLoc:    loc,
	}
}

func loadBirthdayLocation(name string) *time.Location {
	name = strings.TrimSpace(name)
	if name == "" {
		name = "Asia/Tehran"
	}
	if loc, err := time.LoadLocation(name); err == nil {
		return loc
	}
	if loc, err := time.LoadLocation("Asia/Tehran"); err == nil {
		return loc
	}
	return time.UTC
}

// BirthdayLocation is the calendar TZ used for birthday awards (tests/ops).
func (s *Service) BirthdayLocation() *time.Location {
	if s == nil || s.birthdayLoc == nil {
		return time.UTC
	}
	return s.birthdayLoc
}

// Programme returns the effective env-backed rates and tier table for admin
// operators (PH-040d). Not a free-money surface; read-only snapshot.
func (s *Service) Programme() *ProgrammeResponse {
	return &ProgrammeResponse{
		ConfigSource:   "env",
		Editable:       false,
		EarnDivisor:    s.earnDivisor,
		RedeemValue:    s.redeemValue,
		SignupBonus:    s.signupBonus,
		ReviewBonus:    s.reviewBonus,
		BirthdayBonus:  s.birthdayBonus,
		BirthdayTZ:     s.birthdayTZ,
		ReferralReward: s.referralReward,
		Tiers: []ProgrammeTier{
			{ID: string(TierBronze), MinLifetimePoints: 0},
			{ID: string(TierSilver), MinLifetimePoints: 1000},
			{ID: string(TierGold), MinLifetimePoints: 5000},
			{ID: string(TierCellar), MinLifetimePoints: 20000},
		},
		Runbook: "Rates are process env (LOYALTY_*). Redeploy/restart to change. " +
			"No public grant endpoint. Full rules: docs/architecture/loyalty.md",
	}
}

// Get returns the customer's loyalty standing, defaulting to an empty bronze
// account when they've never earned a point.
func (s *Service) Get(ctx context.Context, userID int64) (*LoyaltyResponse, error) {
	acc, err := s.repo.GetAccount(ctx, userID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return buildLoyaltyResponse(&LoyaltyAccount{Tier: TierBronze}), nil
		}
		return nil, apperr.ErrInternal
	}
	return buildLoyaltyResponse(acc), nil
}

// AwardForOrder grants points for a paid order. Idempotent per order id, so a
// retried payment confirmation never double-awards. Best-effort by design — the
// caller should not fail the payment if this errors.
func (s *Service) AwardForOrder(ctx context.Context, userID, orderID int64, amount float64) error {
	delta := int(amount / s.earnDivisor)
	if delta <= 0 {
		metrics.IncLoyaltyAward(string(LoyaltyReasonOrderPaid), metrics.ResultSkip)
		return nil
	}
	return s.Award(ctx, userID, delta, string(LoyaltyReasonOrderPaid), "order", strconv.FormatInt(orderID, 10))
}

// Award grants points for any reason, idempotent per (reason, refType, refID).
// Used by other services (e.g. referrals) to credit points.
// Emits loyalty_award_total{reason,result} (PH-040e).
func (s *Service) Award(ctx context.Context, userID int64, delta int, reason, refType, refID string) error {
	_, err := s.award(ctx, userID, delta, reason, refType, refID)
	return err
}

// award is the instrumented grant path. granted is true when the ledger row was new.
func (s *Service) award(ctx context.Context, userID int64, delta int, reason, refType, refID string) (granted bool, err error) {
	if delta == 0 {
		metrics.IncLoyaltyAward(reasonOrUnknown(reason), metrics.ResultSkip)
		return false, nil
	}
	granted, err = s.repo.Award(ctx, userID, delta, reason, refType, refID)
	if err != nil {
		metrics.IncLoyaltyAward(reasonOrUnknown(reason), metrics.ResultError)
		return false, err
	}
	if granted {
		metrics.IncLoyaltyAward(reasonOrUnknown(reason), metrics.ResultOK)
	} else {
		metrics.IncLoyaltyAward(reasonOrUnknown(reason), metrics.ResultReplay)
	}
	return granted, nil
}

// AwardSignup grants the one-time welcome bonus. Idempotent per user.
func (s *Service) AwardSignup(ctx context.Context, userID int64) error {
	if s.signupBonus <= 0 {
		metrics.IncLoyaltyAward(string(LoyaltyReasonSignup), metrics.ResultSkip)
		return nil
	}
	return s.Award(ctx, userID, s.signupBonus, string(LoyaltyReasonSignup), "user", strconv.FormatInt(userID, 10))
}

// AwardForReview grants LOYALTY_REVIEW_BONUS for a verified-purchase review.
// Non-verified reviews earn nothing. Idempotent per review id. Best-effort —
// review create must not fail if this errors.
func (s *Service) AwardForReview(ctx context.Context, userID, reviewID int64, verifiedPurchase bool) error {
	if !verifiedPurchase || s.reviewBonus <= 0 || userID <= 0 || reviewID <= 0 {
		metrics.IncLoyaltyAward(string(LoyaltyReasonReview), metrics.ResultSkip)
		return nil
	}
	return s.Award(ctx, userID, s.reviewBonus, string(LoyaltyReasonReview), "review", strconv.FormatInt(reviewID, 10))
}

// AwardBirthday grants the yearly birthday bonus. ref_id = "{userID}:{year}".
func (s *Service) AwardBirthday(ctx context.Context, userID int64, year int) error {
	if s.birthdayBonus <= 0 || userID <= 0 || year < 2000 {
		metrics.IncLoyaltyAward(string(LoyaltyReasonBirthday), metrics.ResultSkip)
		return nil
	}
	refID := strconv.FormatInt(userID, 10) + ":" + strconv.Itoa(year)
	return s.Award(ctx, userID, s.birthdayBonus, string(LoyaltyReasonBirthday), "user", refID)
}

// RunBirthdayAwards awards all eligible users for "today" in the birthday TZ.
// Returns how many ledger grants succeeded (including first-time only).
func (s *Service) RunBirthdayAwards(ctx context.Context, now time.Time) (granted int, err error) {
	if s.birthdayBonus <= 0 {
		return 0, nil
	}
	local := now.In(s.birthdayLoc)
	month := int(local.Month())
	day := local.Day()
	year := local.Year()

	includeFeb29 := month == 2 && day == 28 && !isLeapYear(year)
	ids, err := s.repo.ListBirthdayUserIDs(ctx, month, day, includeFeb29)
	if err != nil {
		return 0, err
	}
	for _, id := range ids {
		ok, aerr := s.award(ctx, id, s.birthdayBonus, string(LoyaltyReasonBirthday), "user",
			strconv.FormatInt(id, 10)+":"+strconv.Itoa(year))
		if aerr != nil {
			// Best-effort per user; continue.
			continue
		}
		if ok {
			granted++
		}
	}
	return granted, nil
}

func reasonOrUnknown(reason string) string {
	if reason == "" {
		return "unknown"
	}
	return reason
}

func isLeapYear(year int) bool {
	return time.Date(year, time.December, 31, 0, 0, 0, 0, time.UTC).YearDay() == 366
}

// ClawbackOrderEarn reverses points granted for a paid order (refund policy).
// Reduces balance only (not lifetime). Idempotent per order id. No-op if no
// prior order_paid row or balance already zero.
func (s *Service) ClawbackOrderEarn(ctx context.Context, userID, orderID int64) error {
	if userID <= 0 || orderID <= 0 {
		metrics.IncLoyaltyAward(string(LoyaltyReasonOrderClawback), metrics.ResultSkip)
		return nil
	}
	refID := strconv.FormatInt(orderID, 10)
	delta, err := s.repo.GetLedgerDelta(ctx, string(LoyaltyReasonOrderPaid), "order", refID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			metrics.IncLoyaltyAward(string(LoyaltyReasonOrderClawback), metrics.ResultSkip)
			return nil
		}
		metrics.IncLoyaltyAward(string(LoyaltyReasonOrderClawback), metrics.ResultError)
		return err
	}
	if delta <= 0 {
		metrics.IncLoyaltyAward(string(LoyaltyReasonOrderClawback), metrics.ResultSkip)
		return nil
	}
	deducted, err := s.repo.Clawback(ctx, userID, delta, string(LoyaltyReasonOrderClawback), "order", refID)
	if err != nil {
		metrics.IncLoyaltyAward(string(LoyaltyReasonOrderClawback), metrics.ResultError)
		return err
	}
	if deducted == 0 {
		// Already clawed or zero balance — treat as replay/no-op.
		metrics.IncLoyaltyAward(string(LoyaltyReasonOrderClawback), metrics.ResultReplay)
		return nil
	}
	metrics.IncLoyaltyAward(string(LoyaltyReasonOrderClawback), metrics.ResultOK)
	return nil
}

// Redeem converts points into wallet credit. Points are spent first; if the
// wallet deposit then fails, the points are restored (compensating award).
// clientKey, when non-empty (HTTP Idempotency-Key), is the durable spend ref
// so domain replay matches HTTP replay after cache expiry.
func (s *Service) Redeem(ctx context.Context, userID int64, points int, clientKey string) (*LoyaltyResponse, error) {
	if points <= 0 {
		metrics.IncLoyaltyRedeem(metrics.ResultError)
		return nil, apperr.ErrInvalidRequest
	}

	refID := redeemRefID(userID, clientKey)

	replayed, err := s.repo.Spend(ctx, userID, int64(points), refID)
	if err != nil {
		if errors.Is(err, models.ErrInsufficientFunds) {
			metrics.IncLoyaltyRedeem(metrics.ResultInsufficient)
			return nil, apperr.ErrInsufficientPoints
		}
		metrics.IncLoyaltyRedeem(metrics.ResultError)
		return nil, apperr.ErrInternal
	}
	if replayed {
		metrics.IncLoyaltyRedeem(metrics.ResultReplay)
		return s.Get(ctx, userID)
	}

	credit := float64(points) * s.redeemValue
	desc := fmt.Sprintf("بازخرید %d امتیاز باشگاه مشتریان", points)
	if _, err := s.wallet.Deposit(ctx, userID, credit, nil, &desc); err != nil {
		// Compensate: give the points back so they're never lost.
		// Use repo.Award directly to avoid double-counting redeem_reversal as success award noise.
		_, _ = s.repo.Award(ctx, userID, points, string(LoyaltyReasonRedeemReversal), "redeem", refID)
		metrics.IncLoyaltyRedeem(metrics.ResultError)
		return nil, apperr.ErrInternal
	}

	metrics.IncLoyaltyRedeem(metrics.ResultOK)
	return s.Get(ctx, userID)
}

func redeemRefID(userID int64, clientKey string) string {
	key := strings.TrimSpace(clientKey)
	if key != "" {
		return "idem:" + key
	}
	return strconv.FormatInt(userID, 10) + "-" + strconv.FormatInt(time.Now().UnixNano(), 10)
}

func (s *Service) ListTransactions(ctx context.Context, userID int64) ([]LoyaltyTransactionResponse, error) {
	txs, err := s.repo.ListTransactions(ctx, userID, 50)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	out := make([]LoyaltyTransactionResponse, len(txs))
	for i, t := range txs {
		out[i] = LoyaltyTransactionResponse{Delta: t.Delta, Reason: t.Reason, CreatedAt: t.CreatedAt}
	}
	return out, nil
}

func buildLoyaltyResponse(acc *LoyaltyAccount) *LoyaltyResponse {
	tier := acc.Tier
	if tier == "" {
		tier = TierBronze
	}
	resp := &LoyaltyResponse{
		PointsBalance:  acc.PointsBalance,
		LifetimePoints: acc.LifetimePoints,
		Tier:           tier,
	}
	// Progress toward the next tier.
	switch {
	case acc.LifetimePoints < 1000:
		resp.NextTier, resp.PointsToNext = TierSilver, 1000-acc.LifetimePoints
	case acc.LifetimePoints < 5000:
		resp.NextTier, resp.PointsToNext = TierGold, 5000-acc.LifetimePoints
	case acc.LifetimePoints < 20000:
		resp.NextTier, resp.PointsToNext = TierCellar, 20000-acc.LifetimePoints
	default:
		resp.NextTier, resp.PointsToNext = "", 0
	}
	return resp
}

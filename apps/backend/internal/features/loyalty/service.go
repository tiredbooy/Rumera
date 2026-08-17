package loyalty

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
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
// Constructor rates are seed/fallback when loyalty_programme is missing (PR-003f).
// birthdayTZ is an IANA name (e.g. Asia/Tehran); invalid values fall back to Tehran then UTC.
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

// Programme returns the effective rates and tier table for admin operators.
// DB is source of truth after seed; env LOYALTY_* is last-resort fallback.
func (s *Service) Programme(ctx context.Context) (*ProgrammeResponse, error) {
	cfg, err := s.loadConfig(ctx)
	if err != nil {
		return nil, err
	}
	return cfg.toResponse(), nil
}

func (s *Service) envConfig() programmeConfig {
	tiers := DefaultProgrammeTiers()
	return programmeConfig{
		Enabled:        true,
		EarnDivisor:    s.earnDivisor,
		RedeemValue:    s.redeemValue,
		SignupBonus:    s.signupBonus,
		ReviewBonus:    s.reviewBonus,
		BirthdayBonus:  s.birthdayBonus,
		BirthdayTZ:     s.birthdayTZ,
		ReferralReward: s.referralReward,
		Tiers:          tiers,
		BirthdayLoc:    s.birthdayLoc,
		FromDB:         false,
	}
}

func (s *Service) loadConfig(ctx context.Context) (programmeConfig, error) {
	fallback := s.envConfig()
	if s == nil || s.repo == nil {
		return fallback, nil
	}
	row, err := s.repo.GetProgramme(ctx)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return fallback, nil
		}
		return programmeConfig{}, apperr.ErrInternal
	}
	tiers, err := s.repo.ListProgrammeTiers(ctx)
	if err != nil {
		return programmeConfig{}, apperr.ErrInternal
	}
	if len(tiers) == 0 {
		tiers = DefaultProgrammeTiers()
	}
	tz := strings.TrimSpace(row.BirthdayTZ)
	if tz == "" {
		tz = "Asia/Tehran"
	}
	return programmeConfig{
		Enabled:        row.Enabled,
		EarnDivisor:    row.EarnDivisor,
		RedeemValue:    row.RedeemValue,
		SignupBonus:    row.SignupBonus,
		ReviewBonus:    row.ReviewBonus,
		BirthdayBonus:  row.BirthdayBonus,
		BirthdayTZ:     tz,
		ReferralReward: row.ReferralReward,
		Tiers:          tiers,
		BirthdayLoc:    loadBirthdayLocation(tz),
		FromDB:         true,
	}, nil
}

func (c programmeConfig) toResponse() *ProgrammeResponse {
	src := "env"
	runbook := "Rates are process env (LOYALTY_*). Redeploy/restart to change. " +
		"No public grant endpoint. Full rules: docs/architecture/loyalty.md"
	if c.FromDB {
		src = "db"
		runbook = "Rates and tiers persist in loyalty_programme (not site_settings). " +
			"Env LOYALTY_* seeds the first row only. PUT /admin/loyalty/programme to change. " +
			"enabled=false skips earn and rejects redeem/adjust. No public grant endpoint."
	}
	tiers := c.Tiers
	if len(tiers) == 0 {
		tiers = DefaultProgrammeTiers()
	}
	return &ProgrammeResponse{
		ConfigSource:   src,
		Editable:       c.FromDB,
		Enabled:        c.Enabled,
		EarnDivisor:    c.EarnDivisor,
		RedeemValue:    c.RedeemValue,
		SignupBonus:    c.SignupBonus,
		ReviewBonus:    c.ReviewBonus,
		BirthdayBonus:  c.BirthdayBonus,
		BirthdayTZ:     c.BirthdayTZ,
		ReferralReward: c.ReferralReward,
		Tiers:          tiers,
		Runbook:        runbook,
	}
}

// Get returns the customer's loyalty standing, defaulting to an empty bronze
// account when they've never earned a point.
func (s *Service) Get(ctx context.Context, userID int64) (*LoyaltyResponse, error) {
	cfg, err := s.loadConfig(ctx)
	if err != nil {
		return nil, err
	}
	acc, err := s.repo.GetAccount(ctx, userID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return buildLoyaltyResponse(&LoyaltyAccount{Tier: TierBronze}, cfg.Tiers, cfg.RedeemValue), nil
		}
		return nil, apperr.ErrInternal
	}
	return buildLoyaltyResponse(acc, cfg.Tiers, cfg.RedeemValue), nil
}

// AwardForOrder grants points for a paid order. Idempotent per order id, so a
// retried payment confirmation never double-awards. Best-effort by design — the
// caller should not fail the payment if this errors.
func (s *Service) AwardForOrder(ctx context.Context, userID, orderID int64, amount float64) error {
	cfg, err := s.loadConfig(ctx)
	if err != nil {
		return err
	}
	if !cfg.Enabled {
		metrics.IncLoyaltyAward(string(LoyaltyReasonOrderPaid), metrics.ResultSkip)
		return nil
	}
	delta := int(amount / cfg.EarnDivisor)
	if delta <= 0 {
		metrics.IncLoyaltyAward(string(LoyaltyReasonOrderPaid), metrics.ResultSkip)
		return nil
	}
	_, err = s.awardWith(ctx, cfg, userID, delta, string(LoyaltyReasonOrderPaid), "order", strconv.FormatInt(orderID, 10))
	return err
}

// Award grants points for any reason, idempotent per (reason, refType, refID).
// Used by other services (e.g. referrals) to credit points.
// Emits loyalty_award_total{reason,result} (PH-040e).
func (s *Service) Award(ctx context.Context, userID int64, delta int, reason, refType, refID string) error {
	cfg, err := s.loadConfig(ctx)
	if err != nil {
		return err
	}
	if !cfg.Enabled {
		metrics.IncLoyaltyAward(reasonOrUnknown(reason), metrics.ResultSkip)
		return nil
	}
	_, err = s.awardWith(ctx, cfg, userID, delta, reason, refType, refID)
	return err
}

func (s *Service) award(ctx context.Context, userID int64, delta int, reason, refType, refID string) (bool, error) {
	cfg, err := s.loadConfig(ctx)
	if err != nil {
		return false, err
	}
	if !cfg.Enabled {
		metrics.IncLoyaltyAward(reasonOrUnknown(reason), metrics.ResultSkip)
		return false, nil
	}
	return s.awardWith(ctx, cfg, userID, delta, reason, refType, refID)
}

// awardWith is the instrumented grant path. granted is true when the ledger row was new.
func (s *Service) awardWith(ctx context.Context, cfg programmeConfig, userID int64, delta int, reason, refType, refID string) (granted bool, err error) {
	if delta == 0 {
		metrics.IncLoyaltyAward(reasonOrUnknown(reason), metrics.ResultSkip)
		return false, nil
	}
	granted, err = s.repo.Award(ctx, userID, delta, reason, refType, refID, cfg.thresholds())
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
	cfg, err := s.loadConfig(ctx)
	if err != nil {
		return err
	}
	if !cfg.Enabled || cfg.SignupBonus <= 0 {
		metrics.IncLoyaltyAward(string(LoyaltyReasonSignup), metrics.ResultSkip)
		return nil
	}
	_, err = s.awardWith(ctx, cfg, userID, cfg.SignupBonus, string(LoyaltyReasonSignup), "user", strconv.FormatInt(userID, 10))
	return err
}

// AwardForReview grants LOYALTY_REVIEW_BONUS for a verified-purchase review.
// Non-verified reviews earn nothing. Idempotent per review id. Best-effort —
// review create must not fail if this errors.
func (s *Service) AwardForReview(ctx context.Context, userID, reviewID int64, verifiedPurchase bool) error {
	cfg, err := s.loadConfig(ctx)
	if err != nil {
		return err
	}
	if !cfg.Enabled || !verifiedPurchase || cfg.ReviewBonus <= 0 || userID <= 0 || reviewID <= 0 {
		metrics.IncLoyaltyAward(string(LoyaltyReasonReview), metrics.ResultSkip)
		return nil
	}
	_, err = s.awardWith(ctx, cfg, userID, cfg.ReviewBonus, string(LoyaltyReasonReview), "review", strconv.FormatInt(reviewID, 10))
	return err
}

// AwardBirthday grants the yearly birthday bonus. ref_id = "{userID}:{year}".
func (s *Service) AwardBirthday(ctx context.Context, userID int64, year int) error {
	cfg, err := s.loadConfig(ctx)
	if err != nil {
		return err
	}
	if !cfg.Enabled || cfg.BirthdayBonus <= 0 || userID <= 0 || year < 2000 {
		metrics.IncLoyaltyAward(string(LoyaltyReasonBirthday), metrics.ResultSkip)
		return nil
	}
	refID := strconv.FormatInt(userID, 10) + ":" + strconv.Itoa(year)
	_, err = s.awardWith(ctx, cfg, userID, cfg.BirthdayBonus, string(LoyaltyReasonBirthday), "user", refID)
	return err
}

// RunBirthdayAwards awards all eligible users for "today" in the birthday TZ.
// Returns how many ledger grants succeeded (including first-time only).
func (s *Service) RunBirthdayAwards(ctx context.Context, now time.Time) (granted int, err error) {
	cfg, err := s.loadConfig(ctx)
	if err != nil {
		return 0, err
	}
	if !cfg.Enabled || cfg.BirthdayBonus <= 0 {
		return 0, nil
	}
	loc := cfg.BirthdayLoc
	if loc == nil {
		loc = s.BirthdayLocation()
	}
	local := now.In(loc)
	month := int(local.Month())
	day := local.Day()
	year := local.Year()

	includeFeb29 := month == 2 && day == 28 && !isLeapYear(year)
	ids, err := s.repo.ListBirthdayUserIDs(ctx, month, day, includeFeb29)
	if err != nil {
		return 0, err
	}
	for _, id := range ids {
		ok, aerr := s.awardWith(ctx, cfg, id, cfg.BirthdayBonus, string(LoyaltyReasonBirthday), "user",
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
// clientKey is required (HTTP Idempotency-Key or body idempotency_key).
// Ledger ref_id is "{userID}:idem:{key}" so the global UNIQUE
// (reason, ref_type, ref_id) cannot collide across users (PR-003g).
func (s *Service) Redeem(ctx context.Context, userID int64, points int, clientKey string) (*LoyaltyResponse, error) {
	if points <= 0 {
		metrics.IncLoyaltyRedeem(metrics.ResultError)
		return nil, apperr.ErrInvalidRequest
	}

	cfg, err := s.loadConfig(ctx)
	if err != nil {
		metrics.IncLoyaltyRedeem(metrics.ResultError)
		return nil, err
	}
	if !cfg.Enabled {
		metrics.IncLoyaltyRedeem(metrics.ResultError)
		return nil, apperr.ErrLoyaltyDisabled
	}

	refID := redeemRefID(userID, clientKey)
	if refID == "" {
		metrics.IncLoyaltyRedeem(metrics.ResultError)
		return nil, apperr.ErrInvalidRequest
	}

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

	credit := float64(points) * cfg.RedeemValue
	desc := fmt.Sprintf("بازخرید %d امتیاز باشگاه مشتریان", points)
	if _, err := s.wallet.Deposit(ctx, userID, credit, nil, &desc); err != nil {
		// Compensate: give the points back so they're never lost.
		// Use repo.Award directly to avoid double-counting redeem_reversal as success award noise.
		_, _ = s.repo.Award(ctx, userID, points, string(LoyaltyReasonRedeemReversal), "redeem", refID, cfg.thresholds())
		metrics.IncLoyaltyRedeem(metrics.ResultError)
		return nil, apperr.ErrInternal
	}

	metrics.IncLoyaltyRedeem(metrics.ResultOK)
	return s.Get(ctx, userID)
}

// redeemRefID scopes a client idempotency key to the spender.
// Format: "{userID}:idem:{key}". Empty key is invalid — no nano fallback.
func redeemRefID(userID int64, clientKey string) string {
	key := strings.TrimSpace(clientKey)
	if key == "" {
		return ""
	}
	return strconv.FormatInt(userID, 10) + ":idem:" + key
}

// adminAdjustRefIdentity is the lookup key for a staff adjust (architecture
// §4.6: admin_adjust / admin / {idempotency_key}). Keys longer than the
// ledger VARCHAR(80) are hashed so UNIQUE still fits.
func adminAdjustRefIdentity(key string) string {
	key = strings.TrimSpace(key)
	if key == "" {
		return ""
	}
	if len(key) <= 80 {
		return key
	}
	sum := sha256.Sum256([]byte(key))
	return hex.EncodeToString(sum[:])
}

// adminAdjustRefID encodes actor on the ledger row when it fits, matching
// wallet credit's "note | actor= | idem=" audit (no actor/note columns).
func adminAdjustRefID(key string, actor uuid.UUID) string {
	ident := adminAdjustRefIdentity(key)
	if ident == "" || actor == uuid.Nil {
		return ident
	}
	encoded := ident + "|actor=" + actor.String()
	if len(encoded) <= 80 {
		return encoded
	}
	return ident
}

// Adjust is the staff grant/clawback (PR-003e). Positive delta awards
// (lifetime increases). Negative delta claws back balance only.
// Same idempotency key replays without a second ledger write.
func (s *Service) Adjust(
	ctx context.Context,
	actorUserID, targetUserUUID uuid.UUID,
	delta int,
	note, idempotencyKey string,
) (*AdminAdjustResult, error) {
	if actorUserID == uuid.Nil || targetUserUUID == uuid.Nil {
		return nil, apperr.ErrInvalidRequest
	}
	if delta == 0 {
		return nil, apperr.ErrInvalidRequest
	}
	key := strings.TrimSpace(idempotencyKey)
	if utf8.RuneCountInString(key) < 8 || utf8.RuneCountInString(key) > 128 {
		return nil, apperr.ErrInvalidRequest
	}
	if strings.ContainsAny(key, " \t\n|") {
		return nil, apperr.ErrInvalidRequest
	}
	note = strings.TrimSpace(note)
	if utf8.RuneCountInString(note) > 400 {
		note = string([]rune(note)[:400])
	}

	cfg, err := s.loadConfig(ctx)
	if err != nil {
		return nil, err
	}
	if !cfg.Enabled {
		return nil, apperr.ErrLoyaltyDisabled
	}

	internalID, err := s.repo.ResolveUserID(ctx, targetUserUUID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrUserNotFound
		}
		return nil, apperr.ErrInternal
	}

	ident := adminAdjustRefIdentity(key)
	if existing, err := s.repo.FindAdminAdjust(ctx, internalID, ident); err == nil && existing != nil {
		return s.adjustResult(ctx, targetUserUUID, existing.Delta, note, actorUserID, key, existing.RefID, true)
	} else if err != nil && !errors.Is(err, models.ErrNotFound) {
		return nil, apperr.ErrInternal
	}

	refID := adminAdjustRefID(key, actorUserID)
	reason := string(LoyaltyReasonAdminAdjust)
	if delta > 0 {
		granted, err := s.awardWith(ctx, cfg, internalID, delta, reason, adminAdjustRefType, refID)
		if err != nil {
			return nil, apperr.ErrInternal
		}
		if !granted {
			return s.adjustResult(ctx, targetUserUUID, delta, note, actorUserID, key, refID, true)
		}
		return s.adjustResult(ctx, targetUserUUID, delta, note, actorUserID, key, refID, false)
	}

	deducted, err := s.repo.Clawback(ctx, internalID, -delta, reason, adminAdjustRefType, refID)
	if err != nil {
		metrics.IncLoyaltyAward(reason, metrics.ResultError)
		return nil, apperr.ErrInternal
	}
	applied := -deducted
	if deducted == 0 {
		// Either a race-replay or a first apply against a zero balance.
		// If the ledger row now exists under this identity, treat a prior
		// row with a non-zero delta as replay; a brand-new 0-delta row is
		// still a first apply (201).
		if existing, ferr := s.repo.FindAdminAdjust(ctx, internalID, ident); ferr == nil && existing != nil && existing.Delta != 0 {
			metrics.IncLoyaltyAward(reason, metrics.ResultReplay)
			return s.adjustResult(ctx, targetUserUUID, existing.Delta, note, actorUserID, key, existing.RefID, true)
		}
		metrics.IncLoyaltyAward(reason, metrics.ResultOK)
		return s.adjustResult(ctx, targetUserUUID, applied, note, actorUserID, key, refID, false)
	}
	metrics.IncLoyaltyAward(reason, metrics.ResultOK)
	return s.adjustResult(ctx, targetUserUUID, applied, note, actorUserID, key, refID, false)
}

func (s *Service) adjustResult(
	ctx context.Context,
	target uuid.UUID,
	delta int,
	note string,
	actor uuid.UUID,
	key, refID string,
	replayed bool,
) (*AdminAdjustResult, error) {
	acc, err := s.GetMember(ctx, target)
	if err != nil {
		return nil, err
	}
	return &AdminAdjustResult{
		UserID:         acc.UserID,
		PointsBalance:  acc.PointsBalance,
		LifetimePoints: acc.LifetimePoints,
		Tier:           acc.Tier,
		NextTier:       acc.NextTier,
		PointsToNext:   acc.PointsToNext,
		Delta:          delta,
		Note:           note,
		ActorUserID:    actor.String(),
		IdempotencyKey: key,
		RefType:        adminAdjustRefType,
		RefID:          refID,
		Replayed:       replayed,
		Reason:         LoyaltyReasonAdminAdjust,
	}, nil
}

// ListTransactions pages the caller's ledger (PR-003j). Includes id / refs.
// Empty page is [] — repo errors are not collapsed to an empty list.
func (s *Service) ListTransactions(ctx context.Context, userID int64, filter TransactionFilter) ([]LoyaltyTransactionResponse, int64, error) {
	filter.Defaults()
	txs, total, err := s.repo.ListTransactions(ctx, userID, filter)
	if err != nil {
		return nil, 0, apperr.ErrInternal
	}
	out := make([]LoyaltyTransactionResponse, len(txs))
	for i, t := range txs {
		out[i] = toTransactionResponse(t)
	}
	return out, total, nil
}

// ListMembers is the admin Cellar Club search (PR-003d). Envelope is built
// by the handler as {results, pagination}.
func (s *Service) ListMembers(ctx context.Context, filter MemberFilter) ([]AdminMemberRow, int64, error) {
	filter.Defaults()
	rows, total, err := s.repo.ListMembers(ctx, filter)
	if err != nil {
		return nil, 0, apperr.ErrInternal
	}
	if rows == nil {
		rows = []AdminMemberRow{}
	}
	return rows, total, nil
}

// GetMember returns the public-UUID member account. Unknown UUID → ErrUserNotFound.
func (s *Service) GetMember(ctx context.Context, userUUID uuid.UUID) (*AdminMemberAccount, error) {
	if userUUID == uuid.Nil {
		return nil, apperr.ErrInvalidRequest
	}
	row, err := s.repo.GetMemberByUserUUID(ctx, userUUID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrUserNotFound
		}
		return nil, apperr.ErrInternal
	}
	cfg, cfgErr := s.loadConfig(ctx)
	if cfgErr != nil {
		return nil, cfgErr
	}
	standing := buildLoyaltyResponse(&LoyaltyAccount{
		PointsBalance:  row.PointsBalance,
		LifetimePoints: row.LifetimePoints,
		Tier:           row.Tier,
	}, cfg.Tiers, cfg.RedeemValue)
	return &AdminMemberAccount{
		UserID:         row.UserID,
		Email:          row.Email,
		DisplayName:    row.DisplayName,
		PointsBalance:  standing.PointsBalance,
		LifetimePoints: standing.LifetimePoints,
		Tier:           standing.Tier,
		NextTier:       standing.NextTier,
		PointsToNext:   standing.PointsToNext,
		UpdatedAt:      row.UpdatedAt,
	}, nil
}

// ListMemberTransactions pages the admin ledger for a public user UUID.
// Same row fields as the customer ledger (id / ref_type / ref_id).
func (s *Service) ListMemberTransactions(ctx context.Context, userUUID uuid.UUID, filter MemberTransactionFilter) ([]AdminMemberTransaction, int64, error) {
	if userUUID == uuid.Nil {
		return nil, 0, apperr.ErrInvalidRequest
	}
	filter.Defaults()
	txs, total, err := s.repo.ListMemberTransactions(ctx, userUUID, filter)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, 0, apperr.ErrUserNotFound
		}
		return nil, 0, apperr.ErrInternal
	}
	out := make([]AdminMemberTransaction, len(txs))
	for i, t := range txs {
		row := toTransactionResponse(t)
		out[i] = AdminMemberTransaction{
			ID:        row.ID,
			Delta:     row.Delta,
			Reason:    row.Reason,
			RefType:   row.RefType,
			RefID:     row.RefID,
			CreatedAt: row.CreatedAt,
		}
	}
	return out, total, nil
}

func buildLoyaltyResponse(acc *LoyaltyAccount, tiers []ProgrammeTier, redeemValue float64) *LoyaltyResponse {
	if acc == nil {
		acc = &LoyaltyAccount{Tier: TierBronze}
	}
	tier := acc.Tier
	if tier == "" {
		tier = TierBronze
	}
	resp := &LoyaltyResponse{
		PointsBalance:  acc.PointsBalance,
		LifetimePoints: acc.LifetimePoints,
		Tier:           tier,
		RedeemValue:    redeemValue,
	}
	resp.NextTier, resp.PointsToNext = nextTierProgress(acc.LifetimePoints, tiers)
	return resp
}

func nextTierProgress(lifetime int, tiers []ProgrammeTier) (LoyaltyTier, int) {
	if len(tiers) == 0 {
		tiers = DefaultProgrammeTiers()
	}
	type step struct {
		id  LoyaltyTier
		min int
	}
	steps := make([]step, 0, len(tiers))
	for _, t := range tiers {
		id := LoyaltyTier(strings.ToLower(strings.TrimSpace(t.ID)))
		if id == "" {
			continue
		}
		steps = append(steps, step{id: id, min: t.MinLifetimePoints})
	}
	sort.SliceStable(steps, func(i, j int) bool { return steps[i].min < steps[j].min })
	for _, s := range steps {
		if lifetime < s.min {
			return s.id, s.min - lifetime
		}
	}
	return "", 0
}

// UpdateProgramme persists rates/tiers/enabled (PR-003f). customers:write only.
func (s *Service) UpdateProgramme(ctx context.Context, req UpdateProgrammeRequest) (*ProgrammeResponse, error) {
	if s.repo == nil {
		return nil, apperr.ErrInternal
	}
	normalized, err := validateProgrammeUpdate(req)
	if err != nil {
		return nil, err
	}
	if err := s.repo.SaveProgramme(ctx, normalized.row, normalized.tiers); err != nil {
		return nil, apperr.ErrInternal
	}
	return s.Programme(ctx)
}

type validatedProgramme struct {
	row   programmeRow
	tiers []ProgrammeTier
}

func validateProgrammeUpdate(req UpdateProgrammeRequest) (validatedProgramme, error) {
	if req.Enabled == nil {
		return validatedProgramme{}, apperr.WithFields(apperr.ErrValidation, map[string][]string{
			"enabled": {"enabled is required"},
		})
	}
	if req.EarnDivisor <= 0 {
		return validatedProgramme{}, apperr.WithFields(apperr.ErrValidation, map[string][]string{
			"earn_divisor": {"earn_divisor must be greater than 0"},
		})
	}
	if req.RedeemValue <= 0 {
		return validatedProgramme{}, apperr.WithFields(apperr.ErrValidation, map[string][]string{
			"redeem_value": {"redeem_value must be greater than 0"},
		})
	}
	if req.SignupBonus < 0 || req.ReviewBonus < 0 || req.BirthdayBonus < 0 || req.ReferralReward < 0 {
		return validatedProgramme{}, apperr.WithFields(apperr.ErrValidation, map[string][]string{
			"bonuses": {"signup, review, birthday, and referral bonuses must be >= 0"},
		})
	}

	tz := strings.TrimSpace(req.BirthdayTZ)
	if tz == "" {
		tz = "Asia/Tehran"
	}
	if _, err := time.LoadLocation(tz); err != nil {
		return validatedProgramme{}, apperr.WithFields(apperr.ErrValidation, map[string][]string{
			"birthday_tz": {"birthday_tz must be a valid IANA timezone"},
		})
	}

	tiers, err := validateProgrammeTiers(req.Tiers)
	if err != nil {
		return validatedProgramme{}, err
	}

	return validatedProgramme{
		row: programmeRow{
			ID:             1,
			Enabled:        *req.Enabled,
			EarnDivisor:    req.EarnDivisor,
			RedeemValue:    req.RedeemValue,
			SignupBonus:    req.SignupBonus,
			ReviewBonus:    req.ReviewBonus,
			BirthdayBonus:  req.BirthdayBonus,
			BirthdayTZ:     tz,
			ReferralReward: req.ReferralReward,
		},
		tiers: tiers,
	}, nil
}

func validateProgrammeTiers(in []ProgrammeTier) ([]ProgrammeTier, error) {
	byID := make(map[string]int, len(in))
	for _, t := range in {
		id := strings.ToLower(strings.TrimSpace(t.ID))
		switch id {
		case string(TierBronze), string(TierSilver), string(TierGold), string(TierCellar):
		default:
			return nil, apperr.WithFields(apperr.ErrValidation, map[string][]string{
				"tiers": {"tiers must be bronze, silver, gold, cellar"},
			})
		}
		if _, dup := byID[id]; dup {
			return nil, apperr.WithFields(apperr.ErrValidation, map[string][]string{
				"tiers": {"duplicate tier id " + id},
			})
		}
		if t.MinLifetimePoints < 0 {
			return nil, apperr.WithFields(apperr.ErrValidation, map[string][]string{
				"tiers": {"min_lifetime_points must be >= 0"},
			})
		}
		byID[id] = t.MinLifetimePoints
	}
	bronze, okB := byID[string(TierBronze)]
	silver, okS := byID[string(TierSilver)]
	gold, okG := byID[string(TierGold)]
	cellar, okC := byID[string(TierCellar)]
	if !okB || !okS || !okG || !okC {
		return nil, apperr.WithFields(apperr.ErrValidation, map[string][]string{
			"tiers": {"tiers must include bronze, silver, gold, and cellar"},
		})
	}
	if bronze != 0 {
		return nil, apperr.WithFields(apperr.ErrValidation, map[string][]string{
			"tiers": {"bronze min_lifetime_points must be 0"},
		})
	}
	if !(silver > bronze && gold > silver && cellar > gold) {
		return nil, apperr.WithFields(apperr.ErrValidation, map[string][]string{
			"tiers": {"tier minima must be strictly increasing (bronze < silver < gold < cellar)"},
		})
	}
	return []ProgrammeTier{
		{ID: string(TierBronze), MinLifetimePoints: bronze},
		{ID: string(TierSilver), MinLifetimePoints: silver},
		{ID: string(TierGold), MinLifetimePoints: gold},
		{ID: string(TierCellar), MinLifetimePoints: cellar},
	}, nil
}

package loyalty

import (
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/tiredbooy/internal/models"
)

type LoyaltyTier string

// Loyalty tiers, ordered by lifetime points earned.
const (
	TierBronze LoyaltyTier = "bronze"
	TierSilver LoyaltyTier = "silver"
	TierGold   LoyaltyTier = "gold"
	TierCellar LoyaltyTier = "cellar"
)

// DefaultProgrammeTiers is the seed table (bronze@0 / silver@1000 / gold@5000 / cellar@20000).
func DefaultProgrammeTiers() []ProgrammeTier {
	return []ProgrammeTier{
		{ID: string(TierBronze), MinLifetimePoints: 0},
		{ID: string(TierSilver), MinLifetimePoints: 1000},
		{ID: string(TierGold), MinLifetimePoints: 5000},
		{ID: string(TierCellar), MinLifetimePoints: 20000},
	}
}

// TierThresholds are the live Award CASE cutovers (not hardcoded in SQL).
type TierThresholds struct {
	Silver int
	Gold   int
	Cellar int
}

// DefaultTierThresholds matches the seed tiers.
func DefaultTierThresholds() TierThresholds {
	return TierThresholds{Silver: 1000, Gold: 5000, Cellar: 20000}
}

// ThresholdsFromTiers reads silver/gold/cellar minima from a programme table.
func ThresholdsFromTiers(tiers []ProgrammeTier) TierThresholds {
	t := DefaultTierThresholds()
	for _, x := range tiers {
		switch strings.ToLower(strings.TrimSpace(x.ID)) {
		case string(TierSilver):
			t.Silver = x.MinLifetimePoints
		case string(TierGold):
			t.Gold = x.MinLifetimePoints
		case string(TierCellar):
			t.Cellar = x.MinLifetimePoints
		}
	}
	return t
}

func (t TierThresholds) orDefault() TierThresholds {
	if t.Silver <= 0 || t.Gold <= t.Silver || t.Cellar <= t.Gold {
		return DefaultTierThresholds()
	}
	return t
}

// TierFor maps lifetime points to a tier name using the seed thresholds.
func TierFor(lifetime int) LoyaltyTier {
	return TierForTiers(lifetime, DefaultProgrammeTiers())
}

// TierForTiers maps lifetime points using a live programme table.
func TierForTiers(lifetime int, tiers []ProgrammeTier) LoyaltyTier {
	if len(tiers) == 0 {
		tiers = DefaultProgrammeTiers()
	}
	type step struct {
		id  LoyaltyTier
		min int
	}
	steps := make([]step, 0, len(tiers))
	for _, t := range tiers {
		steps = append(steps, step{LoyaltyTier(strings.ToLower(strings.TrimSpace(t.ID))), t.MinLifetimePoints})
	}
	sort.Slice(steps, func(i, j int) bool { return steps[i].min < steps[j].min })
	cur := TierBronze
	for _, s := range steps {
		if lifetime >= s.min {
			cur = s.id
		}
	}
	return cur
}

type LoyaltyTransactionReason string

const (
	LoyaltyReasonOrderPaid       LoyaltyTransactionReason = "order_paid"
	LoyaltyReasonSignup          LoyaltyTransactionReason = "signup"
	LoyaltyReasonRedeem          LoyaltyTransactionReason = "redeem"
	LoyaltyReasonRedeemReversal  LoyaltyTransactionReason = "redeem_reversal"
	LoyaltyReasonReferral        LoyaltyTransactionReason = "referral"
	LoyaltyReasonReferralWelcome LoyaltyTransactionReason = "referral_welcome"
	LoyaltyReasonReview          LoyaltyTransactionReason = "review"
	LoyaltyReasonBirthday        LoyaltyTransactionReason = "birthday"
	LoyaltyReasonAdminAdjust     LoyaltyTransactionReason = "admin_adjust"
	LoyaltyReasonOrderClawback   LoyaltyTransactionReason = "order_clawback"
)

// adminAdjustRefType is the ledger ref_type for staff grant/clawback (PR-003e).
const adminAdjustRefType = "admin"

type LoyaltyAccount struct {
	UserID         int64       `db:"user_id"`
	PointsBalance  int         `db:"points_balance"`
	LifetimePoints int         `db:"lifetime_points"`
	Tier           LoyaltyTier `db:"tier"`
	TierSince      time.Time   `db:"tier_since"`
	UpdatedAt      time.Time   `db:"updated_at"`
}

type LoyaltyTransaction struct {
	ID      int64                    `db:"id"`
	UserID  int64                    `db:"user_id"`
	Delta   int                      `db:"delta"`
	Reason  LoyaltyTransactionReason `db:"reason"`
	RefType string                   `db:"ref_type"`
	RefID   string                   `db:"ref_id"`
	// Note / Actor* are the L-4 attribution columns. Only staff adjusts carry
	// them; every automated earn path leaves all three NULL.
	Note        *string    `db:"note"`
	ActorUserID *uuid.UUID `db:"actor_user_id"`
	ActorLabel  *string    `db:"actor_label"`
	CreatedAt   time.Time  `db:"created_at"`
}

// LedgerAudit is the who/why written on the same INSERT as the points move
// (L-4). The zero value is "no staff actor" and writes three NULLs.
//
// ActorLabel is a snapshot taken at mint time, not a join: the ledger has to
// name the colleague who granted the points after that account is deactivated
// or renamed.
type LedgerAudit struct {
	Note        string
	ActorUserID uuid.UUID
	ActorLabel  string
}

// args returns the three nullable INSERT arguments (untyped nil → NULL).
func (a LedgerAudit) args() (note, actor, label any) {
	if n := strings.TrimSpace(a.Note); n != "" {
		note = n
	}
	if a.ActorUserID != uuid.Nil {
		actor = a.ActorUserID
	}
	if l := strings.TrimSpace(a.ActorLabel); l != "" {
		label = l
	}
	return note, actor, label
}

// auditOf reads the attribution back off a stored ledger row, so a replayed
// adjust reports what was recorded rather than what the caller just retyped.
func auditOf(t *LoyaltyTransaction) LedgerAudit {
	if t == nil {
		return LedgerAudit{}
	}
	var a LedgerAudit
	if t.Note != nil {
		a.Note = *t.Note
	}
	if t.ActorUserID != nil {
		a.ActorUserID = *t.ActorUserID
	}
	if t.ActorLabel != nil {
		a.ActorLabel = *t.ActorLabel
	}
	return a
}

// ── Responses ────────────────────────────────────────────────────────────────

type LoyaltyResponse struct {
	PointsBalance  int         `json:"points_balance"`
	LifetimePoints int         `json:"lifetime_points"`
	Tier           LoyaltyTier `json:"tier"`
	// NextTier is omitted at the top tier; PointsToNext is then zero.
	NextTier     LoyaltyTier `json:"next_tier,omitempty"`
	PointsToNext int         `json:"points_to_next"`
	// RedeemValue is Toman of wallet credit per point (programme / env fallback).
	RedeemValue float64 `json:"redeem_value"`
}

// LoyaltyTransactionResponse is a customer ledger row (PR-003j). Same
// fields as AdminMemberTransaction: id + refs are not stripped.
type LoyaltyTransactionResponse struct {
	ID        int64                    `json:"id"`
	Delta     int                      `json:"delta"`
	Reason    LoyaltyTransactionReason `json:"reason"`
	RefType   string                   `json:"ref_type"`
	RefID     string                   `json:"ref_id"`
	CreatedAt time.Time                `json:"created_at"`
}

func toTransactionResponse(t LoyaltyTransaction) LoyaltyTransactionResponse {
	return LoyaltyTransactionResponse{
		ID:        t.ID,
		Delta:     t.Delta,
		Reason:    t.Reason,
		RefType:   t.RefType,
		RefID:     t.RefID,
		CreatedAt: t.CreatedAt,
	}
}

// TransactionFilter is the query for GET /loyalty/transactions (PR-003j).
type TransactionFilter struct {
	models.PaginationParams
}

func (f *TransactionFilter) Defaults() {
	if f.Page < 1 {
		f.Page = 1
	}
	if f.Limit < 1 || f.Limit > 100 {
		f.Limit = 20
	}
}

type RedeemPointsRequest struct {
	Points         int    `json:"points" validate:"required,min=1"`
	IdempotencyKey string `json:"idempotency_key"`
}

// AdminAdjustRequest is the body for POST /admin/users/:userID/loyalty/adjust.
// IdempotencyKey is required (body or Idempotency-Key header) so retries do not
// double-grant or double-clawback.
type AdminAdjustRequest struct {
	Delta          int    `json:"delta" validate:"ne=0"`
	Note           string `json:"note" validate:"omitempty,max=400"`
	IdempotencyKey string `json:"idempotency_key" validate:"required,min=8,max=128"`
}

// AdminAdjustResult is the member standing plus audit metadata after an adjust.
type AdminAdjustResult struct {
	UserID         uuid.UUID   `json:"user_id"`
	PointsBalance  int         `json:"points_balance"`
	LifetimePoints int         `json:"lifetime_points"`
	Tier           LoyaltyTier `json:"tier"`
	NextTier       LoyaltyTier `json:"next_tier,omitempty"`
	PointsToNext   int         `json:"points_to_next"`
	Delta          int         `json:"delta"`
	Note           string      `json:"note,omitempty"`
	ActorUserID    string      `json:"actor_user_id"`
	// ActorLabel is the staff name recorded with the row (L-4). Empty for a
	// replay of a pre-L-4 adjust, where no name was ever captured.
	ActorLabel     string                   `json:"actor_label,omitempty"`
	IdempotencyKey string                   `json:"idempotency_key"`
	RefType        string                   `json:"ref_type"`
	RefID          string                   `json:"ref_id"`
	Replayed       bool                     `json:"replayed"`
	Reason         LoyaltyTransactionReason `json:"reason"`
}

// ── Programme operations (L-9) ───────────────────────────────────────────────

// Birthday job health states.
const (
	// BirthdayStatusOff — the programme or the bonus is switched off.
	BirthdayStatusOff = "off"
	// BirthdayStatusIdle — nobody has a birthday today; nothing was due.
	BirthdayStatusIdle = "idle"
	// BirthdayStatusOK — everyone due today already holds this year's award.
	BirthdayStatusOK = "ok"
	// BirthdayStatusPending — people are due today whose award is not written.
	BirthdayStatusPending = "pending"
)

// TierDistribution is one bar of the tier histogram. Every configured tier
// appears, including the empty ones — a missing bar reads as a bug.
type TierDistribution struct {
	Tier          LoyaltyTier `json:"tier" db:"tier"`
	Members       int64       `json:"members" db:"members"`
	PointsBalance int64       `json:"points_balance" db:"points_balance"`
}

// BirthdayHealth answers the three questions about internal/corn's birthday
// job: did it run, when, and did it grant what it should. Awards are keyed
// once per user per year ("{userID}:{year}"), so the ledger is the evidence —
// no separate job bookkeeping is involved.
type BirthdayHealth struct {
	Timezone  string `json:"timezone"`
	LocalDate string `json:"local_date"`
	Bonus     int    `json:"bonus"`
	// DueToday / GrantedToday / PendingToday are today's cohort in the
	// programme timezone: eligible users, those already holding this year's
	// award, and the gap between them.
	DueToday        int        `json:"due_today"`
	GrantedToday    int        `json:"granted_today"`
	PendingToday    int        `json:"pending_today"`
	GrantedThisYear int64      `json:"granted_this_year"`
	LastAwardAt     *time.Time `json:"last_award_at,omitempty"`
	Status          string     `json:"status"`
}

// ProgrammeOverview is GET /admin/loyalty/overview (L-9): what the programme
// owes, how members are spread, and whether the birthday job is keeping up.
type ProgrammeOverview struct {
	Enabled bool  `json:"enabled"`
	Members int64 `json:"members"`
	// PointsOutstanding is the sum of unspent balances.
	PointsOutstanding int64 `json:"points_outstanding"`
	// PointsLiability is that in Toman as an exact decimal string. Points ×
	// redeem_value is multiplied as NUMERIC in Postgres and never routed
	// through a float — this is money the programme owes.
	PointsLiability string             `json:"points_liability"`
	RedeemValue     float64            `json:"redeem_value"`
	Tiers           []TierDistribution `json:"tiers"`
	Birthday        BirthdayHealth     `json:"birthday"`
	GeneratedAt     time.Time          `json:"generated_at"`
}

// ProgrammeTier is a lifetime threshold for admin/ops (PH-040d / PR-003f).
type ProgrammeTier struct {
	ID                string `json:"id" db:"id"`
	MinLifetimePoints int    `json:"min_lifetime_points" db:"min_lifetime_points"`
}

// MemberFilter is the query for GET /admin/loyalty/members (PR-003d).
type MemberFilter struct {
	models.PaginationParams
	Q       string `query:"q"`
	Tier    string `query:"tier" validate:"omitempty,oneof=bronze silver gold cellar"`
	SortBy  string `query:"sortBy" validate:"omitempty,oneof=updated_at points_balance lifetime_points tier"`
	OrderBy string `query:"orderBy" validate:"omitempty,oneof=asc desc"`
}

func (f *MemberFilter) Defaults() {
	if f.Page < 1 {
		f.Page = 1
	}
	if f.Limit < 1 || f.Limit > 100 {
		f.Limit = 20
	}
	f.Q = strings.TrimSpace(f.Q)
	f.Tier = strings.ToLower(strings.TrimSpace(f.Tier))
	switch f.SortBy {
	case "points_balance", "lifetime_points", "tier", "updated_at":
	default:
		f.SortBy = "updated_at"
	}
	if strings.EqualFold(f.OrderBy, "asc") {
		f.OrderBy = "asc"
	} else {
		f.OrderBy = "desc"
	}
}

// MemberTransactionFilter is the query for GET /admin/loyalty/members/:userID/transactions.
type MemberTransactionFilter struct {
	models.PaginationParams
	Reason string `query:"reason"`
}

func (f *MemberTransactionFilter) Defaults() {
	if f.Page < 1 {
		f.Page = 1
	}
	if f.Limit < 1 || f.Limit > 100 {
		f.Limit = 20
	}
	f.Reason = strings.TrimSpace(f.Reason)
}

// AdminMemberRow is one Cellar Club member in the admin search list.
// user_id is users.user_id (UUID), same as /admin/customers/:id.
type AdminMemberRow struct {
	UserID         uuid.UUID   `json:"user_id" db:"user_id"`
	Email          string      `json:"email" db:"email"`
	DisplayName    *string     `json:"display_name,omitempty" db:"display_name"`
	PointsBalance  int         `json:"points_balance" db:"points_balance"`
	LifetimePoints int         `json:"lifetime_points" db:"lifetime_points"`
	Tier           LoyaltyTier `json:"tier" db:"tier"`
	UpdatedAt      time.Time   `json:"updated_at" db:"updated_at"`
}

// AdminMemberAccount is GET /admin/loyalty/members/:userID.
type AdminMemberAccount struct {
	UserID         uuid.UUID   `json:"user_id"`
	Email          string      `json:"email"`
	DisplayName    *string     `json:"display_name,omitempty"`
	PointsBalance  int         `json:"points_balance"`
	LifetimePoints int         `json:"lifetime_points"`
	Tier           LoyaltyTier `json:"tier"`
	NextTier       LoyaltyTier `json:"next_tier,omitempty"`
	PointsToNext   int         `json:"points_to_next"`
	UpdatedAt      time.Time   `json:"updated_at"`
}

// AdminMemberTransaction is a ledger row for staff (includes refs and the
// L-4 attribution: who granted this and why). The customer-facing ledger
// deliberately does not carry either — the note is an internal ops record.
type AdminMemberTransaction struct {
	ID          int64                    `json:"id"`
	Delta       int                      `json:"delta"`
	Reason      LoyaltyTransactionReason `json:"reason"`
	RefType     string                   `json:"ref_type"`
	RefID       string                   `json:"ref_id"`
	Note        *string                  `json:"note,omitempty"`
	ActorUserID *uuid.UUID               `json:"actor_user_id,omitempty"`
	ActorLabel  *string                  `json:"actor_label,omitempty"`
	CreatedAt   time.Time                `json:"created_at"`
}

// ProgrammeResponse is the effective Cellar Club configuration for admin.
// After PR-003f, rates live in loyalty_programme; env LOYALTY_* is seed/fallback.
type ProgrammeResponse struct {
	ConfigSource   string          `json:"config_source"` // "db" when served from loyalty_programme
	Editable       bool            `json:"editable"`
	Enabled        bool            `json:"enabled"`
	EarnDivisor    float64         `json:"earn_divisor"`
	RedeemValue    float64         `json:"redeem_value"`
	SignupBonus    int             `json:"signup_bonus"`
	ReviewBonus    int             `json:"review_bonus"`
	BirthdayBonus  int             `json:"birthday_bonus"`
	BirthdayTZ     string          `json:"birthday_tz"`
	ReferralReward int             `json:"referral_reward"`
	Tiers          []ProgrammeTier `json:"tiers"`
	// Runbook is a short operator note (Persian-safe ASCII/Persian).
	Runbook string `json:"runbook"`
}

// UpdateProgrammeRequest is PUT /admin/loyalty/programme (PR-003f).
// Enabled is a pointer so omitted JSON fails validation instead of disabling.
type UpdateProgrammeRequest struct {
	EarnDivisor    float64         `json:"earn_divisor" validate:"gt=0"`
	RedeemValue    float64         `json:"redeem_value" validate:"gt=0"`
	SignupBonus    int             `json:"signup_bonus" validate:"gte=0"`
	ReviewBonus    int             `json:"review_bonus" validate:"gte=0"`
	BirthdayBonus  int             `json:"birthday_bonus" validate:"gte=0"`
	BirthdayTZ     string          `json:"birthday_tz"`
	ReferralReward int             `json:"referral_reward" validate:"gte=0"`
	Enabled        *bool           `json:"enabled" validate:"required"`
	Tiers          []ProgrammeTier `json:"tiers" validate:"required,min=4"`
}

// programmeRow is the singleton loyalty_programme record (id = 1).
type programmeRow struct {
	ID             int       `db:"id"`
	Enabled        bool      `db:"enabled"`
	EarnDivisor    float64   `db:"earn_divisor"`
	RedeemValue    float64   `db:"redeem_value"`
	SignupBonus    int       `db:"signup_bonus"`
	ReviewBonus    int       `db:"review_bonus"`
	BirthdayBonus  int       `db:"birthday_bonus"`
	BirthdayTZ     string    `db:"birthday_tz"`
	ReferralReward int       `db:"referral_reward"`
	UpdatedAt      time.Time `db:"updated_at"`
}

type programmeConfig struct {
	Enabled        bool
	EarnDivisor    float64
	RedeemValue    float64
	SignupBonus    int
	ReviewBonus    int
	BirthdayBonus  int
	BirthdayTZ     string
	ReferralReward int
	Tiers          []ProgrammeTier
	BirthdayLoc    *time.Location
	FromDB         bool
}

func (c programmeConfig) thresholds() TierThresholds {
	return ThresholdsFromTiers(c.Tiers)
}

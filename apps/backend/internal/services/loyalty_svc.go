package services

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
)

// LoyaltyService runs the points programme: earning (idempotent), tier tracking,
// and redemption into the customer's wallet.
type LoyaltyService struct {
	repo        repositories.LoyaltyRepository
	wallet      *WalletService
	earnDivisor float64 // Toman per point earned
	redeemValue float64 // Toman of wallet credit per point redeemed
	signupBonus int
}

func NewLoyaltyService(
	repo repositories.LoyaltyRepository,
	wallet *WalletService,
	earnDivisor, redeemValue float64,
	signupBonus int,
) *LoyaltyService {
	if earnDivisor <= 0 {
		earnDivisor = 10000
	}
	if redeemValue <= 0 {
		redeemValue = 1000
	}
	return &LoyaltyService{
		repo:        repo,
		wallet:      wallet,
		earnDivisor: earnDivisor,
		redeemValue: redeemValue,
		signupBonus: signupBonus,
	}
}

// Get returns the customer's loyalty standing, defaulting to an empty bronze
// account when they've never earned a point.
func (s *LoyaltyService) Get(ctx context.Context, userID int64) (*models.LoyaltyResponse, error) {
	acc, err := s.repo.GetAccount(ctx, userID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return buildLoyaltyResponse(&models.LoyaltyAccount{Tier: models.TierBronze}), nil
		}
		return nil, apperr.ErrInternal
	}
	return buildLoyaltyResponse(acc), nil
}

// AwardForOrder grants points for a paid order. Idempotent per order id, so a
// retried payment confirmation never double-awards. Best-effort by design — the
// caller should not fail the payment if this errors.
func (s *LoyaltyService) AwardForOrder(ctx context.Context, userID, orderID int64, amount float64) error {
	delta := int(amount / s.earnDivisor)
	if delta <= 0 {
		return nil
	}
	_, err := s.repo.Award(ctx, userID, delta, "order_paid", "order", strconv.FormatInt(orderID, 10))
	return err
}

// Award grants points for any reason, idempotent per (reason, refType, refID).
// Used by other services (e.g. referrals) to credit points.
func (s *LoyaltyService) Award(ctx context.Context, userID int64, delta int, reason, refType, refID string) error {
	if delta == 0 {
		return nil
	}
	_, err := s.repo.Award(ctx, userID, delta, reason, refType, refID)
	return err
}

// AwardSignup grants the one-time welcome bonus. Idempotent per user.
func (s *LoyaltyService) AwardSignup(ctx context.Context, userID int64) error {
	if s.signupBonus <= 0 {
		return nil
	}
	_, err := s.repo.Award(ctx, userID, s.signupBonus, "signup", "user", strconv.FormatInt(userID, 10))
	return err
}

// Redeem converts points into wallet credit. Points are spent first; if the
// wallet deposit then fails, the points are restored (compensating award).
func (s *LoyaltyService) Redeem(ctx context.Context, userID int64, points int) (*models.LoyaltyResponse, error) {
	if points <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	refID := strconv.FormatInt(userID, 10) + "-" + strconv.FormatInt(time.Now().UnixNano(), 10)

	if err := s.repo.Spend(ctx, userID, int64(points), refID); err != nil {
		if errors.Is(err, models.ErrInsufficientFunds) {
			return nil, apperr.ErrInsufficientFunds
		}
		return nil, apperr.ErrInternal
	}

	credit := float64(points) * s.redeemValue
	desc := fmt.Sprintf("بازخرید %d امتیاز باشگاه مشتریان", points)
	if _, err := s.wallet.Deposit(ctx, userID, credit, nil, &desc); err != nil {
		// Compensate: give the points back so they're never lost.
		_, _ = s.repo.Award(ctx, userID, points, "redeem_reversal", "redeem", refID)
		return nil, apperr.ErrInternal
	}

	return s.Get(ctx, userID)
}

func (s *LoyaltyService) ListTransactions(ctx context.Context, userID int64) ([]models.LoyaltyTransactionResponse, error) {
	txs, err := s.repo.ListTransactions(ctx, userID, 50)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	out := make([]models.LoyaltyTransactionResponse, len(txs))
	for i, t := range txs {
		out[i] = models.LoyaltyTransactionResponse{Delta: t.Delta, Reason: t.Reason, CreatedAt: t.CreatedAt}
	}
	return out, nil
}

func buildLoyaltyResponse(acc *models.LoyaltyAccount) *models.LoyaltyResponse {
	tier := acc.Tier
	if tier == "" {
		tier = models.TierBronze
	}
	resp := &models.LoyaltyResponse{
		PointsBalance:  acc.PointsBalance,
		LifetimePoints: acc.LifetimePoints,
		Tier:           tier,
	}
	// Progress toward the next tier.
	switch {
	case acc.LifetimePoints < 1000:
		resp.NextTier, resp.PointsToNext = models.TierSilver, 1000-acc.LifetimePoints
	case acc.LifetimePoints < 5000:
		resp.NextTier, resp.PointsToNext = models.TierGold, 5000-acc.LifetimePoints
	case acc.LifetimePoints < 20000:
		resp.NextTier, resp.PointsToNext = models.TierCellar, 20000-acc.LifetimePoints
	default:
		resp.NextTier, resp.PointsToNext = "", 0
	}
	return resp
}

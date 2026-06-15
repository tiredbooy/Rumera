package services

import (
	"context"
	"crypto/rand"
	"errors"
	"strconv"
	"strings"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
)

// ReferralService manages referral codes and completion (awarding both sides
// when a referee's first order is paid).
type ReferralService struct {
	repo    repositories.ReferralRepository
	loyalty *LoyaltyService
	reward  int
}

func NewReferralService(repo repositories.ReferralRepository, loyalty *LoyaltyService, reward int) *ReferralService {
	return &ReferralService{repo: repo, loyalty: loyalty, reward: reward}
}

// Get returns the customer's referral code (creating one on first request) and
// their pending/completed counts.
func (s *ReferralService) Get(ctx context.Context, userID int64) (*models.ReferralResponse, error) {
	code, err := s.getOrCreateCode(ctx, userID)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	pending, completed, err := s.repo.Counts(ctx, userID)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	return &models.ReferralResponse{Code: code, Pending: pending, Completed: completed, Reward: s.reward}, nil
}

// Claim links the (authenticated) referee to the owner of `code`. Invalid codes,
// self-referral, and already-referred customers are silent no-ops, so the caller
// can fire-and-forget without surfacing errors to a new shopper.
func (s *ReferralService) Claim(ctx context.Context, refereeID int64, code string) error {
	code = strings.ToUpper(strings.TrimSpace(code))
	if code == "" {
		return nil
	}

	ownerID, err := s.repo.GetUserByCode(ctx, code)
	if err != nil {
		return nil // unknown code → ignore
	}
	if ownerID == refereeID {
		return nil // can't refer yourself
	}

	has, err := s.repo.HasReferral(ctx, refereeID)
	if err != nil {
		return apperr.ErrInternal
	}
	if has {
		return nil // already referred by someone
	}

	if err := s.repo.CreateReferral(ctx, ownerID, refereeID, s.reward); err != nil {
		return apperr.ErrInternal
	}
	return nil
}

// OnPaidOrder completes a pending referral for the referee (if any) and awards
// points to both sides. Idempotent: once completed there's no pending row left.
func (s *ReferralService) OnPaidOrder(ctx context.Context, refereeID int64) error {
	ref, err := s.repo.FindPendingByReferee(ctx, refereeID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil
		}
		return err
	}

	if err := s.repo.Complete(ctx, ref.ID); err != nil {
		return err
	}

	refKey := strconv.FormatInt(ref.ID, 10)
	if s.loyalty != nil && ref.RewardPoints > 0 {
		_ = s.loyalty.Award(ctx, ref.ReferrerUserID, ref.RewardPoints, "referral", "referral", refKey)
		_ = s.loyalty.Award(ctx, ref.RefereeUserID, ref.RewardPoints, "referral_welcome", "referral", refKey)
	}
	return nil
}

func (s *ReferralService) getOrCreateCode(ctx context.Context, userID int64) (string, error) {
	code, err := s.repo.GetCode(ctx, userID)
	if err == nil {
		return code, nil
	}
	if !errors.Is(err, models.ErrNotFound) {
		return "", err
	}

	for i := 0; i < 6; i++ {
		cand := genReferralCode()
		err := s.repo.CreateCode(ctx, userID, cand)
		if err == nil {
			return cand, nil
		}
		if errors.Is(err, models.ErrConflict) {
			// Either the user already has a code (race) or the code collided.
			if existing, e := s.repo.GetCode(ctx, userID); e == nil {
				return existing, nil
			}
			continue
		}
		return "", err
	}
	return "", apperr.ErrInternal
}

// genReferralCode returns an 8-char code over an unambiguous alphabet.
func genReferralCode() string {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no I,O,0,1
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	for i := range b {
		b[i] = alphabet[int(b[i])%len(alphabet)]
	}
	return string(b)
}

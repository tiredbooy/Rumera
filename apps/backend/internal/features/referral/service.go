package referral

import (
	"context"
	"crypto/rand"
	"errors"
	"strconv"
	"strings"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

// PointAwarder is implemented by loyalty.Service. Award is idempotent per
// (reason, ref_type, ref_id) so a failed Complete can safely replay.
type PointAwarder interface {
	Award(ctx context.Context, userID int64, delta int, reason, refType, refID string) error
}

// Service manages referral codes and completion (awarding both sides
// when a referee's first order is paid).
type Service struct {
	repo    Repository
	loyalty PointAwarder
	reward  int
}

func NewService(repo Repository, loyalty PointAwarder, reward int) *Service {
	return &Service{repo: repo, loyalty: loyalty, reward: reward}
}

// Get returns the customer's referral code (creating one on first request) and
// their pending/completed counts.
func (s *Service) Get(ctx context.Context, userID int64) (*ReferralResponse, error) {
	code, err := s.getOrCreateCode(ctx, userID)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	pending, completed, err := s.repo.Counts(ctx, userID)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	return &ReferralResponse{Code: code, Pending: pending, Completed: completed, Reward: s.reward}, nil
}

// Claim links the (authenticated) referee to the owner of `code`.
// Success means a new pending row exists. Unknown, self, and already-claimed
// codes are 400 INVALID_REQUEST — never a silent success.
func (s *Service) Claim(ctx context.Context, refereeID int64, code string) error {
	code = strings.ToUpper(strings.TrimSpace(code))
	if code == "" {
		return apperr.ErrInvalidRequest
	}

	ownerID, err := s.repo.GetUserByCode(ctx, code)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrInvalidRequest
		}
		return apperr.ErrInternal
	}
	if ownerID == refereeID {
		return apperr.ErrInvalidRequest
	}

	has, err := s.repo.HasReferral(ctx, refereeID)
	if err != nil {
		return apperr.ErrInternal
	}
	if has {
		return apperr.ErrInvalidRequest
	}

	if err := s.repo.CreateReferral(ctx, ownerID, refereeID, s.reward); err != nil {
		if errors.Is(err, models.ErrConflict) {
			return apperr.ErrInvalidRequest
		}
		return apperr.ErrInternal
	}
	return nil
}

// OnPaidOrder awards both sides then completes the pending referral.
// Award is idempotent per referral id. If either Award errors the pending
// row is left so a retry can replay Award then Complete. Callers (payments
// Confirm) may treat the error as non-fatal to the payment.
func (s *Service) OnPaidOrder(ctx context.Context, refereeID int64) error {
	ref, err := s.repo.FindPendingByReferee(ctx, refereeID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil
		}
		return err
	}

	refKey := strconv.FormatInt(ref.ID, 10)
	if s.loyalty != nil && ref.RewardPoints > 0 {
		if err := s.loyalty.Award(ctx, ref.ReferrerUserID, ref.RewardPoints, "referral", "referral", refKey); err != nil {
			return err
		}
		if err := s.loyalty.Award(ctx, ref.RefereeUserID, ref.RewardPoints, "referral_welcome", "referral", refKey); err != nil {
			return err
		}
	}

	return s.repo.Complete(ctx, ref.ID)
}

func (s *Service) getOrCreateCode(ctx context.Context, userID int64) (string, error) {
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

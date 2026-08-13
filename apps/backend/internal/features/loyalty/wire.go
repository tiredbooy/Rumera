package loyalty

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/features/wallet"
	"github.com/tiredbooy/pkg/validator"
)

// New wires repository → service → HTTP handler.
// Service is returned for payment awards, referral rewards, auth signup,
// review earn, and birthday cron (PH-040b).
func New(
	db *pgxpool.Pool,
	walletSvc *wallet.Service,
	earnDivisor, redeemValue float64,
	signupBonus, reviewBonus, birthdayBonus, referralReward int,
	birthdayTZ string,
	v *validator.Validator,
) (h *Handler, svc *Service) {
	svc = NewService(
		NewRepository(db), walletSvc,
		earnDivisor, redeemValue,
		signupBonus, reviewBonus, birthdayBonus, referralReward,
		birthdayTZ,
	)
	h = NewHandler(svc, v)
	return h, svc
}

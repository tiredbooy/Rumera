package giftcard

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/features/wallet"
	"github.com/tiredbooy/pkg/validator"
)

// New wires repository → service → HTTP handler for gift cards.
// Service is returned so payments.Confirm can fulfill paid purchases (PH-042a).
// After New, bootstrap may chain WithMailer / WithDispatcher /
// WithPurchaserEmailLookup so a successful paid issue emails the code (PR-005b).
// Unset mailer/dispatcher skips email and does not fail fulfill.
func New(db *pgxpool.Pool, walletSvc *wallet.Service, v *validator.Validator) (h *Handler, svc *Service) {
	svc = NewService(NewRepository(db), walletSvc)
	h = NewHandler(svc, v)
	return h, svc
}

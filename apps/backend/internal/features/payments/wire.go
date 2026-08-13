package payments

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/features/inventory"
	"github.com/tiredbooy/internal/features/loyalty"
	"github.com/tiredbooy/internal/features/referral"
	"github.com/tiredbooy/pkg/validator"
)

// NewServiceFromDB constructs the payments service (needed before orders.Service
// because orders create pending payments). wallet/giftCards settle orderless payments.
func NewServiceFromDB(
	db *pgxpool.Pool,
	orderRepo OrderMarkPaid,
	inv inventory.Service,
	loyaltySvc *loyalty.Service,
	referralSvc *referral.Service,
	wallet WalletTopUpCreditor,
	giftCards GiftCardPurchaseFulfiller,
) *Service {
	return NewService(NewRepository(db), orderRepo, inv, loyaltySvc, referralSvc, wallet, giftCards)
}

// NewHTTP constructs the payments HTTP handler after order service exists.
func NewHTTP(
	svc *Service,
	orders OrderItemsLookup,
	inv StockReleaser,
	webhookSecret string,
	v *validator.Validator,
) *Handler {
	return NewHandler(svc, orders, inv, webhookSecret, v)
}

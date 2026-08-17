package orders

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/features/cart"
	"github.com/tiredbooy/internal/features/coupons"
	"github.com/tiredbooy/internal/features/inventory"
	"github.com/tiredbooy/internal/features/payments"
	"github.com/tiredbooy/internal/features/users"
	"github.com/tiredbooy/internal/notifications"
	"github.com/tiredbooy/pkg/notify"
	"github.com/tiredbooy/pkg/validator"
)

// Deps are cross-feature collaborators required to assemble orders.
type Deps struct {
	Cart          cart.Repository
	Coupons       coupons.Repository
	CouponUsage   coupons.UsageRepository
	Shipping      shippingAuthorizer
	Addresses     addressLookup
	Inventory     inventory.Service
	Payment       *payments.Service
	GiftConfig    giftConfigLookup
	Clawback      orderEarnClawback
	Users         *users.Service
	Notifications *notifications.Dispatcher
	Mail          notify.Mailer
	Validator     *validator.Validator
	Wallet        WalletPurchaser // *wallet.Service — PurchaseTx + Refund via WalletRefunder
	// Events emits order.paid.v1 on the wallet-settle transaction. Nil keeps
	// the legacy in-request receipt path.
	Events OrderPaidEmitter
}

// NewRepos constructs the order repositories used by payments before the
// full orders service graph exists (OrderMarkPaid).
func NewRepos(db *pgxpool.Pool) (Repository, ItemRepository) {
	return NewRepository(db), NewItemRepository(db)
}

// New wires repositories → service → HTTP handler for orders.
func New(db *pgxpool.Pool, d Deps) (h *Handler, svc Service) {
	repo, items := NewRepos(db)
	svc = NewService(
		repo, items, d.Cart, d.Coupons, d.CouponUsage,
		d.Shipping, d.Addresses, d.Inventory, d.Payment, d.GiftConfig,
		d.Clawback, d.Wallet,
	)
	if d.Events != nil {
		AttachEventPublisher(svc, d.Events)
	}
	receipt := NewReceiptSender(svc, d.Notifications, d.Mail)
	if d.Payment != nil {
		d.Payment.WithPaidOrderReceipt(receipt)
	}
	h = NewHandler(svc, receipt, d.Validator)
	return h, svc
}

// NewWithRepos is like New but reuses repositories already created for payments.
func NewWithRepos(repo Repository, items ItemRepository, d Deps) (h *Handler, svc Service) {
	svc = NewService(
		repo, items, d.Cart, d.Coupons, d.CouponUsage,
		d.Shipping, d.Addresses, d.Inventory, d.Payment, d.GiftConfig,
		d.Clawback, d.Wallet,
	)
	if d.Events != nil {
		AttachEventPublisher(svc, d.Events)
	}
	receipt := NewReceiptSender(svc, d.Notifications, d.Mail)
	if d.Payment != nil {
		d.Payment.WithPaidOrderReceipt(receipt)
	}
	h = NewHandler(svc, receipt, d.Validator)
	return h, svc
}

package auth

import (
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/features/users"
	"github.com/tiredbooy/internal/notifications"
	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/notify"
	"github.com/tiredbooy/pkg/sms"
	"github.com/tiredbooy/pkg/token"
	"github.com/tiredbooy/pkg/validator"
	"go.uber.org/zap"
)

// Deps are the collaborators required to assemble the auth feature.
type Deps struct {
	DB            *pgxpool.Pool
	Users         *users.Service
	UserRepo      users.Repository // optional; when nil, password-reset uses Users-only path via PasswordResetRepo only
	Validator     *validator.Validator
	JWT           token.Manager
	Log           *zap.Logger
	Cache         cache.Store
	Mail          notify.Mailer
	SMS           sms.Sender
	Notifications *notifications.Dispatcher
	OTPTTL        time.Duration
	RefreshTTL    time.Duration
	Loyalty       LoyaltyAwarder
}

// Wire assembles password-reset + auth HTTP handler and links session kill
// after password reset to the same handler instance.
func Wire(d Deps) *Handler {
	passwordReset := NewPasswordResetService(
		NewPasswordResetRepo(d.DB),
		// Password reset needs user repo; recover from Users service graph.
		// The service constructor takes users.Repository — callers pass it.
		mustUserRepo(d),
		d.Mail,
	).WithNotifier(d.Notifications)

	h := New(Handler{
		Validator:     d.Validator,
		JWT:           d.JWT,
		Log:           d.Log,
		Cache:         d.Cache,
		Notify:        d.Mail,
		SMS:           d.SMS,
		Notifications: d.Notifications,
		OTPTTL:        d.OTPTTL,
		RefreshTTL:    d.RefreshTTL,
		Users:         d.Users,
		PasswordReset: passwordReset,
		Loyalty:       d.Loyalty,
	})
	passwordReset.WithSessionKiller(h)
	return h
}

func mustUserRepo(d Deps) users.Repository {
	if d.UserRepo != nil {
		return d.UserRepo
	}
	// Fallback: construct from DB so Wire stays usable with only *users.Service.
	return users.NewRepository(d.DB)
}

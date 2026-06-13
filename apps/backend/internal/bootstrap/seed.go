package bootstrap

import (
	"context"

	config "github.com/tiredbooy/configs"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/crypto"
	"github.com/tiredbooy/pkg/database"
	"go.uber.org/zap"
)

// seedAdmin provisions an initial admin account from ADMIN_EMAIL / ADMIN_PASSWORD
// when one does not already exist. This solves the chicken-and-egg problem of
// the very first admin (self-registration always yields a customer). It is a
// no-op when the variables are unset or an account with that email already
// exists, so it is safe to run on every boot.
func seedAdmin(ctx context.Context, cfg *config.Config, dbs *database.Connections, log *zap.Logger) error {
	if cfg.AdminEmail == "" || cfg.AdminPassword == "" {
		return nil
	}

	userRepo := repositories.NewUserRepository(dbs.DB)

	exists, err := userRepo.ExistsByEmail(ctx, cfg.AdminEmail)
	if err != nil {
		return err
	}
	if exists {
		return nil
	}

	hash, err := crypto.HashPassword(cfg.AdminPassword)
	if err != nil {
		return err
	}

	if _, err := userRepo.Create(ctx, models.CreateUserReq{
		Email: cfg.AdminEmail,
		Role:  "admin",
	}, hash); err != nil {
		return err
	}

	log.Info("seeded initial admin account", zap.String("email", cfg.AdminEmail))
	return nil
}

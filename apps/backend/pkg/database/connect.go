package database

import (
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	config "github.com/tiredbooy/configs"
	"github.com/tiredbooy/migrations"
	"go.uber.org/zap"
)

type Connections struct {
	DB          *pgxpool.Pool
	AnalyticsDB *pgxpool.Pool
}

func (c *Connections) Close() {
	c.AnalyticsDB.Close()
	c.DB.Close()
}

func Connect(cfg *config.Config, log *zap.Logger) (*Connections, error) {
	// ── Main database ─────────────────────────────────────────────────────────
	db, err := NewDB(cfg, log)
	if err != nil {
		return nil, fmt.Errorf("main db: %w", err)
	}

	if err := migrate(db, migrations.Main, "main", log); err != nil {
		db.Close()
		return nil, fmt.Errorf("main migrations: %w", err)
	}

	log.Info("main db migrations applied")

	// ── Analytics database ────────────────────────────────────────────────────
	analyticsDB, err := NewAnalytics(cfg, log)
	if err != nil {
		db.Close()
		return nil, fmt.Errorf("analytics db: %w", err)
	}

	if err := migrate(analyticsDB, migrations.Analytics, "analytics", log); err != nil {
		analyticsDB.Close()
		db.Close()
		return nil, fmt.Errorf("analytics migrations: %w", err)
	}

	log.Info("analytics db migrations applied")

	return &Connections{
		DB:          db,
		AnalyticsDB: analyticsDB,
	}, nil
}

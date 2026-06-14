package database

import (
	"fmt"
	"time"

	"github.com/exaring/otelpgx"
	"github.com/jackc/pgx/v5/pgxpool"
	config "github.com/tiredbooy/configs"
	"go.uber.org/zap"
)

func NewDB(cfg *config.Config, log *zap.Logger) (*pgxpool.Pool, error) {
	pc := mainPoolConfig()
	if cfg.OTELEnabled {
		pc.tracer = otelpgx.NewTracer()
	}
	pool, err := newPool(cfg.DSN(), pc)
	if err != nil {
		return nil, fmt.Errorf("postgres: %w", err)
	}

	log.Info("postgres connected", zap.String("db", cfg.DBName))
	return pool, nil
}

func mainPoolConfig() poolConfig {
	return poolConfig{
		maxConns:          25,
		minConns:          5,
		maxConnLifetime:   30 * time.Minute,
		maxConnIdleTime:   5 * time.Minute,
		healthCheckPeriod: 1 * time.Minute,
	}
}

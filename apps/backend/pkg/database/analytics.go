package database

import (
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	config "github.com/tiredbooy/configs"
	"go.uber.org/zap"
)

func NewAnalytics(cfg *config.Config, log *zap.Logger) (*pgxpool.Pool, error) {
	pool, err := newPool(cfg.AnalyticsDSN(), analyticsPoolConfig())
	if err != nil {
		return nil, fmt.Errorf("analytics db: %w", err)
	}

	log.Info("analytics db connected", zap.String("db", cfg.AnalyticsDBName))
	return pool, nil
}

func analyticsPoolConfig() poolConfig {
	return poolConfig{
		maxConns:          10,
		minConns:          2,
		maxConnLifetime:   30 * time.Minute,
		maxConnIdleTime:   10 * time.Minute,
		healthCheckPeriod: 1 * time.Minute,
	}
}

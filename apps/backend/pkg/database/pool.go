package database

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type poolConfig struct {
	maxConns          int32
	minConns          int32
	maxConnLifetime   time.Duration
	maxConnIdleTime   time.Duration
	healthCheckPeriod time.Duration
}

func newPool(dsn string, cfg poolConfig) (*pgxpool.Pool, error) {
	poolCfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("parse dsn: %w", err)
	}

	poolCfg.MaxConns = cfg.maxConns
	poolCfg.MinConns = cfg.minConns
	poolCfg.MaxConnLifetime = cfg.maxConnLifetime
	poolCfg.MaxConnIdleTime = cfg.maxConnIdleTime
	poolCfg.HealthCheckPeriod = cfg.healthCheckPeriod

	poolCfg.ConnConfig.RuntimeParams["statement_timeout"] = "30000" // 30s in ms
	poolCfg.ConnConfig.RuntimeParams["lock_timeout"] = "10000"      // 10s in ms
	poolCfg.ConnConfig.RuntimeParams["application_name"] = "rumera"
	poolCfg.ConnConfig.RuntimeParams["timezone"] = "UTC"

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return nil, fmt.Errorf("Create pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping: %w", err)
	}

	return pool, nil
}

package cache

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	config "github.com/tiredbooy/configs"
	"go.uber.org/zap"
)


func NewRedis(cfg *config.Config, log *zap.Logger) (Store, error) {
	client := redis.NewClient(&redis.Options{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
		DB:       cfg.RedisDB,

		// Connection pool — tune for your expected concurrency
		PoolSize:        10,
		MinIdleConns:    3,
		ConnMaxIdleTime: 5 * time.Minute,
		ConnMaxLifetime: 30 * time.Minute,

		// Timeouts — never let a hung Redis block your request
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis ping: %w", err)
	}

	log.Info("redis connected", zap.String("addr", cfg.RedisAddr))
	return &redisStore{client: client}, nil
}

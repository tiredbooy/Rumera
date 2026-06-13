package cache

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

var ErrNotFound = errors.New("cache: key not found")

type redisStore struct {
	client *redis.Client
}

func (s *redisStore) Set(ctx context.Context, key, value string, ttl time.Duration) error {
	if err := s.client.Set(ctx, key, value, ttl).Err(); err != nil {
		return fmt.Errorf("cache set %q: %w", key, err)
	}
	return nil
}

func (s *redisStore) Get(ctx context.Context, key string) (string, error) {
	val, err := s.client.Get(ctx, key).Result()
	if errors.Is(err, redis.Nil) {
		return "", ErrNotFound
	}
	if err != nil {
		return "", fmt.Errorf("cache get %q: %w", key, err)
	}
	return val, nil
}

func (s *redisStore) Incr(ctx context.Context, key string, ttl time.Duration) (int64, error) {
	n, err := s.client.Incr(ctx, key).Result()
	if err != nil {
		return 0, fmt.Errorf("cache incr %q: %w", key, err)
	}
	// Apply the TTL only on the first increment so the window is fixed from the
	// first hit rather than sliding on every request.
	if n == 1 && ttl > 0 {
		if err := s.client.Expire(ctx, key, ttl).Err(); err != nil {
			return n, fmt.Errorf("cache incr expire %q: %w", key, err)
		}
	}
	return n, nil
}

func (s *redisStore) Delete(ctx context.Context, keys ...string) error {
	if err := s.client.Del(ctx, keys...).Err(); err != nil {
		return fmt.Errorf("cache delete: %w", err)
	}
	return nil
}

func (s *redisStore) Exists(ctx context.Context, key string) (bool, error) {
	n, err := s.client.Exists(ctx, key).Result()
	if err != nil {
		return false, fmt.Errorf("cache exists %q: %w", key, err)
	}
	return n > 0, nil
}

func (s *redisStore) TTL(ctx context.Context, key string) (time.Duration, error) {
	ttl, err := s.client.TTL(ctx, key).Result()
	if err != nil {
		return 0, fmt.Errorf("cache ttl %q: %w", key, err)
	}
	return ttl, nil
}

func (s *redisStore) Ping(ctx context.Context) error {
	if err := s.client.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("cache ping: %w", err)
	}
	return nil
}

func (s *redisStore) Close() error {
	return s.client.Close()
}

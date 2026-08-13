package product

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/metrics"
)

func (h *Handler) cachedJSON(ctx context.Context, key string, ttl time.Duration, build func() (any, error)) (json.RawMessage, error) {
	if h.Cache != nil {
		cached, err := h.Cache.Get(ctx, key)
		switch {
		case err == nil:
			metrics.IncCache(metrics.CacheHit)
			return json.RawMessage(cached), nil
		case errors.Is(err, cache.ErrNotFound):
			metrics.IncCache(metrics.CacheMiss)
		default:
			metrics.IncCache(metrics.CacheError)
			h.logCacheWarn("get", key, err)
		}
	}

	raw, err, _ := h.cacheGroup.Do(key, func() (any, error) {
		if h.Cache != nil {
			if cached, err := h.Cache.Get(ctx, key); err == nil {
				return json.RawMessage(cached), nil
			}
		}
		value, err := build()
		if err != nil {
			return nil, err
		}
		marshalled, err := json.Marshal(value)
		if err != nil {
			return nil, err
		}
		if h.Cache != nil {
			if err := h.Cache.Set(ctx, key, string(marshalled), ttl); err != nil {
				h.logCacheWarn("set", key, err)
			}
		}
		return json.RawMessage(marshalled), nil
	})
	if err != nil {
		return nil, err
	}
	return raw.(json.RawMessage), nil
}

func (h *Handler) invalidate(ctx context.Context, keys ...string) {
	if h.Cache == nil || len(keys) == 0 {
		return
	}
	if err := h.Cache.Delete(ctx, keys...); err != nil {
		h.logCacheWarn("delete", keys[0], err)
	}
}

func (h *Handler) logCacheWarn(op, key string, err error) {
	if h.Log != nil {
		h.Log.Warn("cache " + op + " failed: " + key + ": " + err.Error())
	}
}

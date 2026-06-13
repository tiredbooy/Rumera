package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/metrics"
)

// cachedJSON is a read-through cache helper for expensive, read-heavy GETs. On a
// hit it returns the stored JSON verbatim; on a miss it calls build(), stores
// the marshalled result under key for ttl, and returns it.
//
// The result is returned as json.RawMessage so it can be handed straight to
// response.OK — which wraps it in the standard {"data": …} envelope without a
// re-encode. build() errors (including domain errors) propagate to the caller
// for normal error mapping and are never cached.
//
// Stampede protection: on a miss, concurrent requests for the same key are
// collapsed by singleflight so only one of them runs build()/hits the database;
// the rest wait and share the result. This protects the database when a hot key
// (a featured recipe, the category tree) expires under load — the classic
// thundering-herd / cache-stampede failure mode.
//
// When no cache is configured it degrades to a direct build() with a marshal,
// so behaviour is identical with or without Redis.
func (h *Handler) cachedJSON(ctx context.Context, key string, ttl time.Duration, build func() (any, error)) (json.RawMessage, error) {
	// Fast path: serve straight from cache without entering singleflight.
	if h.Cache != nil {
		cached, err := h.Cache.Get(ctx, key)
		switch {
		case err == nil:
			metrics.IncCache(metrics.CacheHit)
			return json.RawMessage(cached), nil
		case errors.Is(err, cache.ErrNotFound):
			metrics.IncCache(metrics.CacheMiss)
		default:
			// On a transient cache error, fall through and build — availability
			// over cache correctness.
			metrics.IncCache(metrics.CacheError)
			h.logCacheWarn("get", key, err)
		}
	}

	// Slow path: one build per key at a time across concurrent callers.
	raw, err, _ := h.cacheGroup.Do(key, func() (any, error) {
		// Re-check the cache: a previous in-flight build for this key may have
		// just populated it while we were queued behind the singleflight lock.
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

// invalidate best-effort deletes cache keys after a write. Never fails the
// request.
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

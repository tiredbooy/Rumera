package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/tiredbooy/pkg/cache"
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
// When no cache is configured it degrades to a direct build() with a marshal,
// so behaviour is identical with or without Redis.
func (h *Handler) cachedJSON(ctx context.Context, key string, ttl time.Duration, build func() (any, error)) (json.RawMessage, error) {
	if h.Cache != nil {
		if cached, err := h.Cache.Get(ctx, key); err == nil {
			return json.RawMessage(cached), nil
		} else if !errors.Is(err, cache.ErrNotFound) {
			// On a transient cache error, fall through and build — availability
			// over cache correctness.
			h.logCacheWarn("get", key, err)
		}
	}

	value, err := build()
	if err != nil {
		return nil, err
	}

	raw, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}

	if h.Cache != nil {
		if err := h.Cache.Set(ctx, key, string(raw), ttl); err != nil {
			h.logCacheWarn("set", key, err)
		}
	}
	return raw, nil
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

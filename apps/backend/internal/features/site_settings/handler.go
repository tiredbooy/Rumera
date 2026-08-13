package site_settings

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/platform/httpx"
	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/metrics"
	"github.com/tiredbooy/pkg/response"
	"github.com/tiredbooy/pkg/validator"
	"go.uber.org/zap"
	"golang.org/x/sync/singleflight"
)

// siteSettingsCacheTTL bounds staleness of the cached public settings document.
const siteSettingsCacheTTL = 300 * time.Second

// Handler is the HTTP surface for storefront and admin site settings.
type Handler struct {
	Service   Service
	Validator *validator.Validator
	Cache     cache.Store
	Log       *zap.Logger

	cacheGroup singleflight.Group
}

// NewHandler constructs the site settings HTTP handler.
func NewHandler(svc Service, v *validator.Validator, store cache.Store, log *zap.Logger) *Handler {
	return &Handler{Service: svc, Validator: v, Cache: store, Log: log}
}

// GetPublic — GET /settings (storefront-safe, read-through cached).
func (h *Handler) GetPublic(c *gin.Context) {
	ctx := c.Request.Context()
	data, err := h.cachedJSON(ctx, cache.KeySiteSettings(), siteSettingsCacheTTL, func() (any, error) {
		settings, err := h.Service.Get(ctx)
		if err != nil {
			return nil, err
		}
		return ToPublic(settings), nil
	})
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, data)
}

// GetAdmin — GET /admin/settings (full document, bypasses public cache).
func (h *Handler) GetAdmin(c *gin.Context) {
	settings, err := h.Service.Get(c.Request.Context())
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, ToResponse(settings))
}

// Update — PUT /admin/settings (partial update; invalidates public cache).
func (h *Handler) Update(c *gin.Context) {
	var req UpdateSiteSettingsReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	settings, err := h.Service.Update(c.Request.Context(), req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	h.invalidate(c.Request.Context(), cache.KeySiteSettings())
	response.OK(c, ToResponse(settings))
}

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

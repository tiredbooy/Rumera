package handlers

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/mappers"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/response"
)

// siteSettingsCacheTTL bounds staleness of the cached public settings document.
// Admin writes invalidate eagerly, so this only caps drift if an invalidation is
// ever missed.
const siteSettingsCacheTTL = 300 * time.Second

// ── Public ────────────────────────────────────────────────────────────────────

// GetSiteSettings — GET /settings. Returns the storefront-safe settings subset,
// read-through cached. Hot read on nearly every storefront page (header/footer,
// SEO defaults, maintenance flag), so it is cached like the catalogue reads.
func (h *Handler) GetSiteSettings(c *gin.Context) {
	ctx := c.Request.Context()

	data, err := h.cachedJSON(ctx, cache.KeySiteSettings(), siteSettingsCacheTTL, func() (any, error) {
		settings, err := h.SiteSettings.Get(ctx)
		if err != nil {
			return nil, err
		}
		return mappers.ToPublicSiteSettings(settings), nil
	})
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, data)
}

// ── Admin ─────────────────────────────────────────────────────────────────────

// GetSiteSettingsAdmin — GET /admin/settings. Returns the full settings document
// (every group), bypassing the public cache so the editor always sees fresh data.
func (h *Handler) GetSiteSettingsAdmin(c *gin.Context) {
	settings, err := h.SiteSettings.Get(c.Request.Context())
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, mappers.ToSiteSettingsResponse(settings))
}

// UpdateSiteSettings — PUT /admin/settings. Partial update: only the groups
// present in the body are replaced; omitted groups are preserved. Invalidates
// the public settings cache on success.
func (h *Handler) UpdateSiteSettings(c *gin.Context) {
	var req models.UpdateSiteSettingsReq
	if !h.bindJSON(c, &req) {
		return
	}

	settings, err := h.SiteSettings.Update(c.Request.Context(), req)
	if err != nil {
		h.handleError(c, err)
		return
	}

	h.invalidate(c.Request.Context(), cache.KeySiteSettings())
	response.OK(c, mappers.ToSiteSettingsResponse(settings))
}

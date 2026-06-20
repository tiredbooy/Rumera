# Site settings

The storefront's single, global configuration document — store identity, contact
details, social handles, shipping copy, SEO defaults, and the maintenance toggle.
There is exactly one settings document (a singleton row, `id = 1`); these routes
read and partially update it.

See [Authentication](../authentication.md) for trust tiers, and [Conventions](../conventions.md) for the response/error envelope.

Legend: 🌐 public · 🔒 customer · 🛡️ admin

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| GET | `/settings` | 🌐 public | Storefront-safe settings subset (read-through cached) |
| GET | `/admin/settings` | 🛡️ admin | Full settings document (cache-bypassing) |
| PUT | `/admin/settings` | 🛡️ admin | Partial update — replace only the groups you send |

---

## Shape

The document is a set of **typed groups** stored as one JSONB blob, so the shape
can grow without a schema migration. Each group is a flat object:

| Group | Fields |
|-------|--------|
| `store` | `name`, `tagline`, `logoUrl`, `description` |
| `contact` | `supportEmail`, `supportPhone`, `address`, `workingHours` |
| `social` | `instagram`, `telegram`, `whatsapp`, `twitter`, `youtube`, `linkedin` |
| `shipping` | `freeThreshold` (int64, minor currency unit), `note` |
| `seo` | `defaultTitle`, `defaultDescription`, `ogImage`, `keywords` |
| `maintenance` | `enabled` (bool), `message` |

> JSON keys are **camelCase** here (e.g. `logoUrl`, `supportEmail`,
> `freeThreshold`) — unlike most other resources in this API, which are
> snake_case. The settings document mirrors the admin editor's field names.

The admin `GET` also returns a top-level `updatedAt` (the row's `updated_at`
timestamp, not part of the JSONB body). The public projection (`PublicSiteSettings`)
exposes every group today but is a distinct type, so the public contract stays
stable as admin-only groups are added later.

```
┌──────────────── SiteSettings (admin) ────────────────┐
│ store · contact · social · shipping · seo · maintenance │  + updatedAt
└──────────────────────────────────────────────────────┘
                  │  .Public()  (drops updatedAt; today exposes the same groups)
                  ▼
┌──────────── PublicSiteSettings (GET /settings) ──────┐
│ store · contact · social · shipping · seo · maintenance │
└──────────────────────────────────────────────────────┘
```

---

## Get public settings

```
GET /settings
```

Returns the storefront-safe subset. This is a hot read on nearly every storefront
page (header/footer, SEO defaults, maintenance flag), so it is **read-through
cached** (TTL 300s). Admin writes invalidate the cache eagerly, so the TTL only
caps drift if an invalidation is ever missed.

**Response** `200 OK` — `PublicSiteSettings` wrapped in `data`:

```json
{
  "data": {
    "store": {
      "name": "Rumera",
      "tagline": "Rare cellars, delivered.",
      "logoUrl": "https://cdn.example.com/logo.svg",
      "description": "Luxury wine & spirits."
    },
    "contact": {
      "supportEmail": "support@rumera.example",
      "supportPhone": "+98…",
      "address": "Tehran, Iran",
      "workingHours": "Sat–Wed 9–18"
    },
    "social": {
      "instagram": "rumera",
      "telegram": "rumera",
      "whatsapp": "",
      "twitter": "",
      "youtube": "",
      "linkedin": ""
    },
    "shipping": {
      "freeThreshold": 5000000,
      "note": "Free shipping over ₮5,000,000."
    },
    "seo": {
      "defaultTitle": "Rumera | Wine & Spirits",
      "defaultDescription": "Buy rare wine and spirits online.",
      "ogImage": "https://cdn.example.com/og.jpg",
      "keywords": "wine, whisky, spirits"
    },
    "maintenance": {
      "enabled": false,
      "message": ""
    }
  }
}
```

---

## Get full settings (admin)

```
GET /admin/settings
Authorization: Bearer <access_token>
```

Returns the full document including `updatedAt`. This route **bypasses the public
cache** so the editor always sees fresh data.

**Response** `200 OK` — `SiteSettings` wrapped in `data` (same groups as above,
plus `updatedAt`):

```json
{
  "data": {
    "store": { "name": "Rumera", "tagline": "…", "logoUrl": "…", "description": "…" },
    "contact": { "supportEmail": "…", "supportPhone": "…", "address": "…", "workingHours": "…" },
    "social": { "instagram": "…", "telegram": "…", "whatsapp": "", "twitter": "", "youtube": "", "linkedin": "" },
    "shipping": { "freeThreshold": 5000000, "note": "…" },
    "seo": { "defaultTitle": "…", "defaultDescription": "…", "ogImage": "…", "keywords": "…" },
    "maintenance": { "enabled": false, "message": "" },
    "updatedAt": "2026-06-20T08:00:00Z"
  }
}
```

**Errors:** `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`.

---

## Update settings (admin)

```
PUT /admin/settings
Authorization: Bearer <access_token>
```

**Partial update.** Every group is optional. A group that is **present** replaces
the stored group **wholesale** (all of that group's fields are written from the
body). A group that is **omitted** (or `null`) is left untouched. There is no
per-field merge — to change one field of a group you must send the whole group.

On success the public settings cache is invalidated.

**Request body** — `UpdateSiteSettingsReq`. Validation per group:

| Group / field | Required | Validation |
|---------------|----------|------------|
| `store.name` | ✓ (if `store` sent) | max 255 |
| `store.tagline` | | max 255 |
| `store.logoUrl` | | max 2048 |
| `store.description` | | max 2000 |
| `contact.supportEmail` | | email, max 255 |
| `contact.supportPhone` | | max 40 |
| `contact.address` | | max 500 |
| `contact.workingHours` | | max 255 |
| `social.*` | | max 255 each |
| `shipping.freeThreshold` | | min 0 |
| `shipping.note` | | max 1000 |
| `seo.defaultTitle` | | max 255 |
| `seo.defaultDescription` | | max 500 |
| `seo.ogImage` | | max 2048 |
| `seo.keywords` | | max 500 |
| `maintenance.enabled` | | bool |
| `maintenance.message` | | max 500 |

Example — toggle maintenance mode and update the shipping note, leaving every
other group untouched:

```json
{
  "maintenance": { "enabled": true, "message": "Back at noon." },
  "shipping": { "freeThreshold": 6000000, "note": "Free shipping over ₮6,000,000." }
}
```

**Response** `200 OK` — the full updated `SiteSettings` (same shape as the admin
GET, wrapped in `data`).

**Errors:** `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `400 INVALID_JSON`, `422 VALIDATION_ERROR`.

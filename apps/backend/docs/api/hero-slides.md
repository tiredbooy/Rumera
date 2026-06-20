# Hero slides

Editorial slides for the storefront home carousel. Slides are admin-managed; the
public route serves only **active** rows (ordered for display), while admins see
and manage every slide.

See [Authentication](../authentication.md) for trust tiers, and [Conventions](../conventions.md) for the response/error envelope.

Legend: 🌐 public · 🔒 customer · 🛡️ admin

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| GET | `/hero-slides` | 🌐 public | List **active** slides (home carousel) |
| GET | `/admin/hero-slides` | 🛡️ admin | List **all** slides |
| GET | `/admin/hero-slides/:id` | 🛡️ admin | Get one slide |
| POST | `/admin/hero-slides` | 🛡️ admin | Create a slide |
| PATCH | `/admin/hero-slides/:id` | 🛡️ admin | Update a slide |
| DELETE | `/admin/hero-slides/:id` | 🛡️ admin | Delete a slide |

---

## The `HeroSlide` object

Most copy/media fields are nullable. `theme` is `light` or `dark`. `sort_order`
controls display order; the public list is ordered by it. `starts_at` / `ends_at`
form an optional scheduling window — the public list serves only active slides
within their window.

| Field | Type | Notes |
|-------|------|-------|
| `id` | int64 | |
| `eyebrow` | string \| null | small label above the title |
| `title` | string | required |
| `subtitle` | string \| null | |
| `badge` | string \| null | |
| `image_url` | string | required; desktop image |
| `mobile_image_url` | string \| null | mobile-specific image |
| `image_alt` | string \| null | alt text |
| `cta_label` | string \| null | primary call-to-action label |
| `cta_href` | string \| null | primary CTA link |
| `secondary_cta_label` | string \| null | |
| `secondary_cta_href` | string \| null | |
| `theme` | string | `light` or `dark` |
| `sort_order` | int | display order |
| `is_active` | bool | |
| `starts_at` | string (date-time) \| null | schedule window start |
| `ends_at` | string (date-time) \| null | schedule window end |
| `created_at` | string (date-time) | |
| `updated_at` | string (date-time) | |

```
GET /hero-slides            →  active rows only, within [starts_at, ends_at], ordered by sort_order
GET /admin/hero-slides      →  every row (drafts, inactive, expired, scheduled)
```

---

## List active slides (public)

```
GET /hero-slides
```

**Response** `200 OK` — array of `HeroSlideResponse` wrapped in `data`:

```json
{
  "data": [
    {
      "id": 1,
      "eyebrow": "New arrival",
      "title": "Highland Single Malt",
      "subtitle": "Peated, full-bodied, limited.",
      "badge": "Limited",
      "image_url": "https://cdn.example.com/hero/1.jpg",
      "mobile_image_url": "https://cdn.example.com/hero/1-m.jpg",
      "image_alt": "Bottle on a dark shelf",
      "cta_label": "Shop now",
      "cta_href": "/products/highland-single-malt",
      "secondary_cta_label": null,
      "secondary_cta_href": null,
      "theme": "dark",
      "sort_order": 0,
      "is_active": true,
      "starts_at": null,
      "ends_at": null,
      "created_at": "2026-06-01T08:00:00Z",
      "updated_at": "2026-06-01T08:00:00Z"
    }
  ]
}
```

---

## List all slides (admin)

```
GET /admin/hero-slides
Authorization: Bearer <access_token>
```

Same shape as the public list, but returns every slide regardless of `is_active`
or scheduling window.

**Errors:** `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`.

---

## Get a slide (admin)

```
GET /admin/hero-slides/:id
Authorization: Bearer <access_token>
```

**Response** `200 OK` — a single `HeroSlideResponse` inside `data`.

**Errors:** `400 INVALID_PARAMS`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`.

---

## Create a slide

```
POST /admin/hero-slides
Authorization: Bearer <access_token>
```

**Request body** — `HeroSlideReq`:

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | string | ✓ | max 255 |
| `image_url` | string | ✓ | max 2048 |
| `eyebrow` | string | | max 120 |
| `subtitle` | string | | |
| `badge` | string | | max 120 |
| `mobile_image_url` | string | | max 2048 |
| `image_alt` | string | | max 255 |
| `cta_label` | string | | max 120 |
| `cta_href` | string | | max 255 |
| `secondary_cta_label` | string | | max 120 |
| `secondary_cta_href` | string | | max 255 |
| `theme` | string | | one of `light` `dark` |
| `sort_order` | int | | |
| `is_active` | bool | | |
| `starts_at` | string (date-time) | | |
| `ends_at` | string (date-time) | | |

```json
{
  "title": "Highland Single Malt",
  "image_url": "https://cdn.example.com/hero/1.jpg",
  "eyebrow": "New arrival",
  "cta_label": "Shop now",
  "cta_href": "/products/highland-single-malt",
  "theme": "dark",
  "sort_order": 0,
  "is_active": true
}
```

**Response** `201 Created` — the created `HeroSlideResponse` inside `data`.

**Errors:** `400 INVALID_JSON`, `422 VALIDATION_ERROR`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`.

---

## Update a slide

```
PATCH /admin/hero-slides/:id
Authorization: Bearer <access_token>
```

All fields optional (`HeroSlideUpdateReq`); only supplied fields are updated. Same
field set and validation as create, except `title` and `image_url` are **optional**
here (`title` max 255, `image_url` max 2048).

**Response** `200 OK` — the updated `HeroSlideResponse` inside `data`.

**Errors:** `400 INVALID_PARAMS` / `INVALID_JSON`, `422 VALIDATION_ERROR`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`.

---

## Delete a slide

```
DELETE /admin/hero-slides/:id
Authorization: Bearer <access_token>
```

**Response** `204 No Content`.

**Errors:** `400 INVALID_PARAMS`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`.

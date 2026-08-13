# Hero slides

**Implementation (feature slice):** `internal/features/hero/`  
Composed from `internal/routes/routes.go`. API contracts unchanged.


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
| PUT | `/admin/hero-slides/order` | 🛡️ admin | Atomically replace display order |
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
| `image_url` | string \| null | desktop image; required while active |
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

The public projection omits `is_active`, schedule, and audit fields. Its
`image_url` is always a string because inactive media-less drafts are excluded.
Admin responses include every field in the table above.

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
      "sort_order": 0
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

Returns the full admin shape, including publication, schedule, and audit fields,
for every slide regardless of `is_active` or scheduling window.

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
| `image_url` | string \| null | when active | max 2048 |
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

Optional strings are trimmed and blank values are stored as `null`. Each CTA is
complete-or-empty: its label and href must either both be non-blank or both be
`null`. An href must be one of:

- A root-relative path beginning with exactly one slash, with no backslashes or
  control characters, for example `/products?sort=discount`.
- An absolute `https://` URL with a host and no username/password credentials.

Protocol-relative, relative, `http:`, `javascript:`, `data:`, and other unsafe
forms are rejected. If both schedule bounds are supplied, `ends_at` must be
strictly after `starts_at`. `is_active` defaults to `true`, so a media-less draft
must explicitly set `is_active` to `false`.

---

## Update a slide

```
PATCH /admin/hero-slides/:id
Authorization: Bearer <access_token>
```

All fields are optional (`HeroSlideUpdateReq`); omitted fields remain unchanged.
The same normalized, merged-state validation as create applies. JSON `null`
explicitly clears these nullable fields:

`eyebrow`, `subtitle`, `badge`, `image_url`, `mobile_image_url`, `image_alt`,
both CTA label/href pairs, `starts_at`, and `ends_at`.

Clearing only one member of a CTA pair is rejected unless the other member is
also cleared in the same request or was already empty. Clearing `image_url` while
the slide remains active is rejected; clearing it and setting `is_active` to
`false` in the same PATCH is valid. Server-owned `/media/...` URLs retain their
optimistic media expectation checks, and stale media updates return `409 CONFLICT`
rather than overwriting a newer attachment.

```json
{
  "eyebrow": null,
  "cta_label": null,
  "cta_href": null,
  "starts_at": null,
  "ends_at": null
}
```

**Response** `200 OK` — the updated `HeroSlideResponse` inside `data`.

**Errors:** `400 INVALID_PARAMS` / `INVALID_JSON`, `409 CONFLICT`, `422 VALIDATION_ERROR`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`.

---

## Reorder slides

```
PUT /admin/hero-slides/order
Authorization: Bearer <access_token>
```

The `ids` array must contain every current hero-slide ID exactly once. IDs must
be positive and unique. The operation locks and validates the complete set in a
single transaction, then assigns contiguous zero-based `sort_order` values from
the array positions.

```json
{
  "ids": [12, 4, 9]
}
```

**Response** `204 No Content`.

**Errors:** `400 INVALID_JSON`, `422 VALIDATION_ERROR`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`.

---

## Delete a slide

```
DELETE /admin/hero-slides/:id
Authorization: Bearer <access_token>
```

**Response** `204 No Content`.

**Errors:** `400 INVALID_PARAMS`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`.

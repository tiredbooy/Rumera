# Blog

Blog posts and blog categories — public reads by slug/id, admin-only writes.

See [Authentication](../authentication.md) for the token model and trust tiers, and [Conventions](../conventions.md) for the response/error envelope.

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| GET | `/blogs` | 🌐 public | List all blogs |
| GET | `/blogs/:slug` | 🌐 public | Fetch one blog by slug (records a read) |
| GET | `/blog-categories` | 🌐 public | List all blog categories |
| GET | `/blog-categories/:id` | 🌐 public | Fetch one blog category |
| POST | `/admin/blogs` | 🛡️ admin | Create a blog |
| GET | `/admin/blogs/:id` | 🛡️ admin | Fetch one blog by numeric id |
| PATCH | `/admin/blogs/:id` | 🛡️ admin | Update a blog |
| DELETE | `/admin/blogs/:id` | 🛡️ admin | Delete a blog |
| POST | `/admin/blog-categories` | 🛡️ admin | Create a blog category |
| PATCH | `/admin/blog-categories/:id` | 🛡️ admin | Update a blog category |
| DELETE | `/admin/blog-categories/:id` | 🛡️ admin | Delete a blog category |

Legend: 🌐 public · 🔒 customer · 🛡️ admin.

The `Blog` object:

| Field | Type | Notes |
|-------|------|-------|
| `id` | int64 | |
| `author_id` | int64 | The authoring admin's user id |
| `title` | string | |
| `slug` | string | URL-safe identifier |
| `content` | string | |
| `excerpt` | string \| null | |
| `time_to_read` | int | minutes |
| `total_reads` | int64 | read counter |
| `meta_title` | string \| null | SEO |
| `meta_description` | string \| null | SEO |
| `published_at` | string (date-time) \| null | |
| `created_at` | string (date-time) | |
| `updated_at` | string (date-time) | |

The `BlogCategory` object:

| Field | Type | Notes |
|-------|------|-------|
| `id` | int64 | |
| `name` | string | |
| `description` | string \| null | |
| `slug` | string \| null | |
| `parent_id` | int64 \| null | parent category for nesting |
| `created_at` | string (date-time) | |
| `updated_at` | string (date-time) | |

---

## List blogs

```
GET /blogs
```

**Response** `200 OK` — a `data` array of `Blog` objects:

```json
{
  "data": [
    {
      "id": 1,
      "author_id": 42,
      "title": "Tasting Notes 101",
      "slug": "tasting-notes-101",
      "content": "…",
      "excerpt": "A primer on tasting.",
      "time_to_read": 6,
      "total_reads": 1280,
      "meta_title": null,
      "meta_description": null,
      "published_at": "2026-05-01T09:00:00Z",
      "created_at": "2026-04-28T12:00:00Z",
      "updated_at": "2026-05-01T09:00:00Z"
    }
  ]
}
```

---

## Get blog by slug

```
GET /blogs/:slug
```

Fetches a single published blog by its `slug`. Each successful fetch **records a read asynchronously** — the read counter is incremented in a background goroutine that is detached from the request, so it never blocks or delays the response.

**Response** `200 OK` — a single `BlogDetail` object inside `data`. It extends `Blog` with its category list and related id arrays:

```json
{
  "data": {
    "id": 1,
    "author_id": 42,
    "title": "Tasting Notes 101",
    "slug": "tasting-notes-101",
    "content": "…",
    "excerpt": "A primer on tasting.",
    "time_to_read": 6,
    "total_reads": 1280,
    "meta_title": null,
    "meta_description": null,
    "published_at": "2026-05-01T09:00:00Z",
    "created_at": "2026-04-28T12:00:00Z",
    "updated_at": "2026-05-01T09:00:00Z",
    "categories": [
      { "id": 3, "name": "Guides", "description": null, "slug": "guides", "parent_id": null, "created_at": "…", "updated_at": "…" }
    ],
    "product_ids": [10, 11],
    "tag_ids": [5]
  }
}
```

**Errors:** `400 INVALID_PARAMS` (empty slug), `404 NOT_FOUND`.

---

## List blog categories

```
GET /blog-categories
```

**Response** `200 OK` — a `data` array of `BlogCategory` objects.

---

## Get blog category

```
GET /blog-categories/:id
```

`:id` is a numeric blog-category id.

**Response** `200 OK` — a single `BlogCategory` object inside `data`.

**Errors:** `400 INVALID_PARAMS`, `404 NOT_FOUND`.

---

## Get blog (admin)

```
GET /admin/blogs/:id
Authorization: Bearer <access_token>
```

Admin-only lookup **by numeric id** (the public route looks up by slug). `:id` is a numeric blog id.

**Response** `200 OK` — a single `BlogDetail` object inside `data` (same shape as the by-slug response). This route does **not** record a read.

**Errors:** `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `400 INVALID_PARAMS`, `404 NOT_FOUND`.

---

## Create blog

```
POST /admin/blogs
Authorization: Bearer <access_token>
```

**Request body** (`BlogReq`)

| Field | Type | Notes |
|-------|------|-------|
| `title` | string | |
| `slug` | string | URL-safe identifier |
| `content` | string | |
| `excerpt` | string \| null | |
| `time_to_read` | int | minutes |
| `meta_title` | string \| null | SEO |
| `meta_description` | string \| null | SEO |
| `published_at` | string (date-time) \| null | omit/leave null to keep as a draft |
| `category_ids` | int64[] | blog categories to assign |
| `product_ids` | int64[] | related products to link |
| `tag_ids` | int64[] | tags to link |

> `author_id` is set **server-side** from the authenticated admin's user id. Clients do not supply it; any value sent in the body is overwritten.

```json
{
  "title": "Tasting Notes 101",
  "slug": "tasting-notes-101",
  "content": "…",
  "excerpt": "A primer on tasting.",
  "time_to_read": 6,
  "published_at": "2026-05-01T09:00:00Z",
  "category_ids": [3],
  "product_ids": [10, 11],
  "tag_ids": [5]
}
```

**Response** `201 Created` — the created `BlogDetail` inside `data`.

**Errors:** `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `400 INVALID_JSON`, `422 VALIDATION_ERROR`, `409 CONFLICT` (duplicate slug).

---

## Update blog

```
PATCH /admin/blogs/:id
Authorization: Bearer <access_token>
```

All fields optional; only supplied fields are updated (`BlogUpdateReq`).

| Field | Type | Notes |
|-------|------|-------|
| `title` | string | |
| `slug` | string | |
| `content` | string | |
| `excerpt` | string \| null | |
| `time_to_read` | int | minutes |
| `meta_title` | string \| null | |
| `meta_description` | string \| null | |
| `published_at` | string (date-time) \| null | |
| `category_ids` | int64[] | replaces the assigned categories |
| `product_ids` | int64[] | replaces the linked products |
| `tag_ids` | int64[] | replaces the linked tags |

**Response** `200 OK` — the updated `BlogDetail` inside `data`.

**Errors:** `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `400 INVALID_PARAMS` / `INVALID_JSON`, `422 VALIDATION_ERROR`, `404 NOT_FOUND`.

---

## Delete blog

```
DELETE /admin/blogs/:id
Authorization: Bearer <access_token>
```

**Response** `204 No Content`.

**Errors:** `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `400 INVALID_PARAMS`, `404 NOT_FOUND`.

---

## Create blog category

```
POST /admin/blog-categories
Authorization: Bearer <access_token>
```

**Request body** (`BlogCategoryReq`)

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | |
| `description` | string \| null | |
| `slug` | string \| null | |
| `parent_id` | int64 \| null | parent category for nesting |

```json
{ "name": "Guides", "slug": "guides", "parent_id": null }
```

**Response** `201 Created` — the created `BlogCategory` inside `data`.

**Errors:** `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `400 INVALID_JSON`, `422 VALIDATION_ERROR`.

---

## Update blog category

```
PATCH /admin/blog-categories/:id
Authorization: Bearer <access_token>
```

Same `BlogCategoryReq` body as create.

**Response** `200 OK` — the updated `BlogCategory` inside `data`.

**Errors:** `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `400 INVALID_PARAMS` / `INVALID_JSON`, `422 VALIDATION_ERROR`, `404 NOT_FOUND`.

---

## Delete blog category

```
DELETE /admin/blog-categories/:id
Authorization: Bearer <access_token>
```

**Response** `204 No Content`.

**Errors:** `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `400 INVALID_PARAMS`, `404 NOT_FOUND`.

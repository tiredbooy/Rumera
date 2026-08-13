# Blog

**Implementation (feature slice):** `internal/features/blog/`  
Composed from `internal/routes/routes.go`. Posts + categories. API contracts unchanged.


Blog posts and blog categories — public storefront reads plus admin-only management.

See [Authentication](../authentication.md) for the token model and trust tiers, and [Conventions](../conventions.md) for the response/error envelope.

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| GET | `/blogs` | 🌐 public | List all blogs |
| GET | `/blogs/:slug` | 🌐 public | Fetch one blog by slug (records a read) |
| GET | `/blog-categories` | 🌐 public | List all blog categories |
| GET | `/blog-categories/:id` | 🌐 public | Fetch one blog category |
| GET | `/admin/blogs` | 🛡️ admin | List blogs across all publication statuses |
| POST | `/admin/blogs` | 🛡️ admin | Create a blog |
| GET | `/admin/blogs/:id` | 🛡️ admin | Fetch one blog by numeric id |
| PATCH | `/admin/blogs/:id` | 🛡️ admin | Update a blog |
| DELETE | `/admin/blogs/:id` | 🛡️ admin | Delete a blog |
| GET | `/admin/blog-categories` | 🛡️ admin | List all blog categories |
| POST | `/admin/blog-categories` | 🛡️ admin | Create a blog category |
| GET | `/admin/blog-categories/:id` | 🛡️ admin | Fetch one blog category |
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
| `image_url` | string \| null | cover image |
| `image_alt` | string \| null | cover-image alternative text |
| `time_to_read` | int | minutes |
| `total_reads` | int64 | read counter |
| `status` | string | `draft` · `published` · `archived` |
| `is_featured` | bool | surface on featured shelves |
| `meta_title` | string \| null | SEO |
| `meta_description` | string \| null | SEO |
| `published_at` | string (date-time) \| null | stamped automatically the first time a post goes live |
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

The public listing is **always published-only** — the handler forces
`status=published`, so drafts and archived posts are never exposed on the
storefront. Results are **paginated** and return the lightweight `BlogListItem`
card (no full `content` body).

**Query parameters** (plus standard pagination/sorting — `page`, `limit`, `sortBy`,
`orderBy` — see [Conventions](../conventions.md)). Default sort is `published_at`.

| Param | Type | Description |
|-------|------|-------------|
| `is_featured` | bool | Only featured posts |
| `category_id` | int64 | Only posts assigned to this blog category |
| `exclude_id` | int64 | Exclude one separately rendered editorial lead from stable pagination |
| `search` | string | Literal title/excerpt search (`%`, `_`, and `\` are not wildcards) |

> `status` is accepted on the filter but is **overridden to `published`** on this
> public route — you cannot list drafts here. Admin status filtering is done via
> the dedicated admin reads.

**Response** `200 OK` — paginated `BlogListItem[]`:

```json
{
  "results": [
    {
      "id": 1,
      "author_id": 42,
      "title": "Tasting Notes 101",
      "slug": "tasting-notes-101",
      "excerpt": "A primer on tasting.",
      "image_url": "https://cdn.example.com/blog/1.jpg",
      "image_alt": "Tasting setup on a table",
      "time_to_read": 6,
      "total_reads": 1280,
      "status": "published",
      "is_featured": true,
      "published_at": "2026-05-01T09:00:00Z",
      "created_at": "2026-04-28T12:00:00Z",
      "updated_at": "2026-05-01T09:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total_items": 1,
    "total_pages": 1,
    "has_next": false,
    "has_prev": false
  }
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
    "image_url": "https://cdn.example.com/blog/1.jpg",
    "image_alt": "Tasting setup on a table",
    "time_to_read": 6,
    "total_reads": 1280,
    "status": "published",
    "is_featured": true,
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

## List blogs (admin)

```
GET /admin/blogs
Authorization: Bearer <access_token>
```

Returns the same paginated `BlogListItem[]` shape as `GET /blogs`, but does not
force `status=published`. Omit `status` to include every publication state, or
send `status=draft`, `status=published`, or `status=archived` to filter it. The
other list query parameters (`page`, `limit`, `sortBy`, `orderBy`, `search`,
`is_featured`, `category_id`, and `exclude_id`) have the same semantics as the
public list.

**Errors:** `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `400 INVALID_PARAMS`.

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
| `title` | string | required, max 255 |
| `slug` | string | optional, max 255 — derived (uniquely) from `title` when omitted |
| `content` | string | required |
| `excerpt` | string \| null | |
| `image_url` | string \| null | cover image |
| `image_alt` | string \| null | cover-image alternative text, max 255 |
| `time_to_read` | int | minutes; defaults to `1` when ≤ 0 |
| `status` | string | one of `draft` `published` `archived`; defaults to `draft` |
| `is_featured` | bool | |
| `meta_title` | string \| null | SEO, max 255 |
| `meta_description` | string \| null | SEO |
| `published_at` | string (date-time) \| null | see auto-stamp note below |
| `category_ids` | int64[] | blog categories to assign |
| `product_ids` | int64[] | related products to link |
| `tag_ids` | int64[] | tags to link |

> `author_id` is set **server-side** from the authenticated admin's user id. Clients do not supply it; any value sent in the body is overwritten.
>
> **Status & publishing.** Omitting `status` creates a **draft**. If a post is
> created with `status=published` and no `published_at`, the server stamps
> `published_at` to now. Slug collisions never fail creation — when `slug` is
> omitted a unique one is derived from the title (with a numeric suffix if needed).
> Slugs remain reserved after soft deletion so public links are never silently
> reassigned to different content.

```json
{
  "title": "Tasting Notes 101",
  "slug": "tasting-notes-101",
  "content": "…",
  "excerpt": "A primer on tasting.",
  "image_url": "https://cdn.example.com/blog/1.jpg",
  "time_to_read": 6,
  "status": "published",
  "is_featured": true,
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
| `title` | string | max 255 |
| `slug` | string | max 255; normalised, must stay unique |
| `content` | string | |
| `excerpt` | string \| null | |
| `image_url` | string \| null | cover image |
| `time_to_read` | int | minutes (min 1) |
| `status` | string | one of `draft` `published` `archived` |
| `is_featured` | bool | |
| `meta_title` | string \| null | max 255 |
| `meta_description` | string \| null | |
| `published_at` | string (date-time) \| null | see auto-stamp note below |
| `category_ids` | int64[] | replaces the assigned categories |
| `product_ids` | int64[] | replaces the linked products |
| `tag_ids` | int64[] | replaces the linked tags |

> **Auto-stamp.** Setting `status=published` on a post that has never been
> published (no existing `published_at`) and not sending `published_at` causes the
> server to stamp `published_at` to now.
>
> **Nullable fields.** For `excerpt`, `image_url`, `image_alt`, `meta_title`,
> `meta_description`, and `published_at`: omit the field to leave it unchanged,
> send `null` to clear it, or send a value to replace it. A published post cannot
> remain without a publication timestamp, so clearing `published_at` while its
> resulting status is `published` restores the original first-published time or
> stamps the current time if none exists.
>
> **Relation semantics.** For `category_ids` / `product_ids` / `tag_ids`: **omit**
> the field to leave that relation untouched, send `[]` to clear it, or send a list
> to replace it.

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

## List blog categories (admin)

```
GET /admin/blog-categories
Authorization: Bearer <access_token>
```

**Response** `200 OK` — a `data` array of `BlogCategory` objects, matching the
public category list but protected by the admin authorization boundary.

**Errors:** `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`.

---

## Get blog category (admin)

```
GET /admin/blog-categories/:id
Authorization: Bearer <access_token>
```

**Response** `200 OK` — a single `BlogCategory` object inside `data`.

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
| `name` | string | required, max 255 |
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

All fields are optional; only supplied fields are updated (`BlogCategoryUpdateReq`).

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | max 255; cannot be empty |
| `description` | string \| null | `null` clears the value |
| `slug` | string \| null | normalised when supplied; `null` clears the value |
| `parent_id` | int64 \| null | `null` makes the category top-level; cannot reference itself |

Omitting a nullable field leaves its current value unchanged.

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

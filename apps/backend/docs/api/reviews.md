# Reviews

Product reviews: public browsing, customer write/react/images, and admin moderation.

See [Authentication](../authentication.md) for the token model and trust tiers, and [Conventions](../conventions.md) for the response/error envelope.

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| GET | `/products/:id/reviews` | 🌐 public | List a product's approved reviews |
| GET | `/products/:id/reviews/summary` | 🌐 public | Rating summary for a product |
| GET | `/reviews/:id` | 🌐 public | Fetch a single review |
| GET | `/reviews/mine` | 🔒 customer | List the caller's reviews with product details |
| GET | `/reviews/pending` | 🔒 customer | List delivered products not yet reviewed |
| POST | `/reviews` | 🔒 customer | Create a review |
| PATCH | `/reviews/:id` | 🔒 customer | Update own review |
| DELETE | `/reviews/:id` | 🔒 customer | Delete own review |
| POST | `/reviews/:id/react` | 🔒 customer | Like / dislike a review |
| GET | `/reviews/:id/images` | 🔒 customer | List a review's images |
| POST | `/reviews/:id/images` | 🔒 customer | Add an image to a review |
| GET | `/admin/reviews` | 🛡️ admin | List all reviews (any status) |
| PATCH | `/admin/reviews/:id/status` | 🛡️ admin | Moderate a review's status |

A review's `status` is one of `pending`, `approved`, `rejected`.

---

## List product reviews

```
GET /products/:id/reviews
```

Lists reviews for product `:id`. **Only `approved` reviews are returned** — the status filter is forced server-side. Accepts the standard pagination/filter query params (see [Conventions](../conventions.md)), plus `rating` (1–5) and `verified`.

**Response** `200 OK` — paginated `ReviewResponse[]`:

```json
{
  "results": [
    {
      "id": 12,
      "title": "Excellent",
      "content": "Smooth and smoky.",
      "rating": 5,
      "user_id": 42,
      "user_full_name": "Sara Ahmadi",
      "product_id": 7,
      "like_count": 3,
      "images": [],
      "dislike_count": 0,
      "verified_purchase": true,
      "status": "approved",
      "created_at": "2026-06-11T10:00:00Z"
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

**Errors:** `400 INVALID_PARAMS`.

---

## Product rating summary

```
GET /products/:id/reviews/summary
```

**Response** `200 OK` — `ProductRatingSummary`:

```json
{
  "data": {
    "product_id": 7,
    "average_rating": 4.6,
    "total_reviews": 88,
    "distribution": { "1": 3, "2": 5, "3": 10, "4": 20, "5": 50 }
  }
}
```

`distribution` maps each star rating (1–5) to its review count.

**Errors:** `400 INVALID_PARAMS`.

---

## Get a review

```
GET /reviews/:id
```

**Response** `200 OK` — approved `ReviewResponse` (see shape above, wrapped in `data`). Pending and rejected reviews are not publicly readable.

**Errors:** `400 INVALID_PARAMS`, `404 NOT_FOUND`.

---

## Create a review

```
POST /reviews
Authorization: Bearer <access_token>
```

The author is taken from the access token. The caller must have a delivered order containing the product; `verified_purchase` is determined server-side. New reviews start in `pending` status.

**Request body** — `CreateReviewReq`:

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | string | ✓ | max 255 |
| `content` | string | ✓ | |
| `rating` | int | ✓ | 1–5 |
| `product_id` | int | ✓ | ≥ 1 |

```json
{
  "title": "Excellent",
  "content": "Smooth and smoky.",
  "rating": 5,
  "product_id": 7
}
```

**Response** `201 Created` — `ReviewResponse`.

**Errors:** `401 UNAUTHORIZED`, `403 ACCESS_DENIED` (no delivered purchase), `409 CONFLICT` (already reviewed), `422 VALIDATION_ERROR`.

---

## List my reviews

```
GET /reviews/mine
Authorization: Bearer <access_token>
```

Returns `{ "data": [...] }` with the caller's non-deleted reviews and the related `product_id`, `product_slug`, `product_title`, optional `image_url`, `rating`, `content`, `status`, and `created_at`.

## List products pending review

```
GET /reviews/pending
Authorization: Bearer <access_token>
```

Returns `{ "data": [...] }` with products from delivered orders for which the caller has no non-deleted review. Each item includes product details, `order_id`, and optional `delivered_at`.

---

## Update a review

```
PATCH /reviews/:id
Authorization: Bearer <access_token>
```

Customers may only update their own review. All fields optional; only supplied fields are updated.

**Request body** — `UpdateReviewReq`:

| Field | Type | Validation |
|-------|------|------------|
| `title` | string | max 255 |
| `content` | string | |
| `rating` | int | 1–5 |

**Response** `200 OK` — updated `ReviewResponse`.

**Errors:** `401 UNAUTHORIZED`, `400 INVALID_PARAMS`, `422 VALIDATION_ERROR`, `404 NOT_FOUND`.

---

## Delete a review

```
DELETE /reviews/:id
Authorization: Bearer <access_token>
```

Customers may only delete their own review.

**Response** `204 No Content`.

**Errors:** `401 UNAUTHORIZED`, `400 INVALID_PARAMS`, `404 NOT_FOUND`.

---

## React to a review

```
POST /reviews/:id/react
Authorization: Bearer <access_token>
```

Registers or changes the caller's like/dislike vote against an approved review.
Repeated identical votes are idempotent.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `like` | bool | ✓ | `true` = like, `false` = dislike |

```json
{ "like": true }
```

**Response** `204 No Content`.

**Errors:** `401 UNAUTHORIZED`, `400 INVALID_PARAMS`, `404 NOT_FOUND`.

---

## List review images

```
GET /reviews/:id/images
Authorization: Bearer <access_token>
```

**Response** `200 OK` — `ReviewImage[]`:

```json
{
  "data": [
    {
      "id": 1,
      "review_id": 12,
      "image_url": "https://cdn/img.jpg",
      "alt_text": "bottle",
      "sort_order": 0,
      "created_at": "2026-06-11T10:00:00Z",
      "updated_at": "2026-06-11T10:00:00Z"
    }
  ]
}
```

**Errors:** `401 UNAUTHORIZED`, `400 INVALID_PARAMS`, `404 NOT_FOUND`.

---

## Add a review image

```
POST /reviews/:id/images
Authorization: Bearer <access_token>
```

`review_id` is taken from the path; any value in the body is overridden.

**Request body** — `ReviewImageReq`:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `image_url` | string | ✓ | Image URL |
| `alt_text` | string \| null | | Alt text, max 255 characters |
| `sort_order` | int | | Display order |

**Response** `201 Created` — `ReviewImage`.

**Errors:** `401 UNAUTHORIZED`, `400 INVALID_PARAMS`, `404 NOT_FOUND`.

---

## List reviews (admin)

```
GET /admin/reviews
Authorization: Bearer <access_token>
```

Lists reviews of **any** status. Accepts the standard pagination/filter params plus `product_id`, `user_id`, `status`, `rating` (1–5), `verified`.

**Response** `200 OK` — paginated `ReviewAdminResponse[]` (all `ReviewResponse` fields plus `updated_at` and an optional `deleted_at`):

```json
{
  "results": [
    {
      "id": 12,
      "title": "Excellent",
      "content": "Smooth and smoky.",
      "rating": 5,
      "user_id": 42,
      "user_full_name": "",
      "product_id": 7,
      "like_count": 3,
      "images": [],
      "dislike_count": 0,
      "verified_purchase": false,
      "status": "pending",
      "created_at": "2026-06-11T10:00:00Z",
      "updated_at": "2026-06-11T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total_items": 1, "total_pages": 1, "has_next": false, "has_prev": false }
}
```

**Errors:** `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`.

---

## Update review status (admin)

```
PATCH /admin/reviews/:id/status
Authorization: Bearer <access_token>
```

Moderates a review by setting its status.

**Request body** — `UpdateReviewStatusReq`:

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `status` | string | ✓ | one of `pending` `approved` `rejected` |

```json
{ "status": "approved" }
```

**Response** `200 OK` — `ReviewAdminResponse`.

**Errors:** `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `400 INVALID_PARAMS`, `422 VALIDATION_ERROR`, `404 NOT_FOUND`.

# Media


**Implementation (feature slice):** `internal/features/media/`
Rumera stores uploaded image originals behind stable storage keys and serves
them through canonical, environment-independent `/media/...` paths. Admin upload
routes use the versioned API base; public media delivery is mounted directly on
the backend origin, outside `/api/v1`.

See [Authentication](../authentication.md) for trust tiers and
[Conventions](../conventions.md) for response envelopes and errors.

## Routes

| Method | Path                                       | Tier   | Status             | Description                                  |
| ------ | ------------------------------------------ | ------ | ------------------ | -------------------------------------------- |
| GET    | `/media/*key`                              | Public | Available          | Serve an original or transformed local image |
| POST   | `/admin/products/:id/images`               | Admin  | Available | Upload and attach a product image            |
| POST   | `/admin/products/:id/images/url`           | Admin  | Available | Attach a product image URL                   |
| POST   | `/admin/uploads`                           | Admin  | Legacy    | Upload without durable owner attachment      |
| POST   | `/admin/uploads/release`                   | Admin  | Available | Release a cancelled standalone upload        |
| POST   | `/admin/uploads/:ownerType/:ownerID/:role` | Admin  | Available | Upload and attach owner media                |

The admin paths above are relative to `/api/v1`. For example, a local
owner-aware request will use
`http://localhost:8080/api/v1/admin/uploads/recipes/19/cover`.

## Public Delivery

```http
GET /media/recipes/19/cover-550e8400-e29b-41d4-a716-446655440000.webp
```

`*key` is the complete storage key and may contain forward-slash-separated
segments. The route supports derived image parameters without changing the
persisted canonical URL:

| Query parameter | Values                              | Behavior                                          |
| --------------- | ----------------------------------- | ------------------------------------------------- |
| `f`             | `avif`, `webp`, `jpeg`/`jpg`, `png` | Select an enabled output format                   |
| `q`             | `1` through `100`                   | Set output quality                                |
| `w`             | Positive integer                    | Set target width, capped by server configuration  |
| `h`             | Positive integer                    | Set target height, capped by server configuration |
| `fit`           | `inside`, `cover`, `contain`        | Select resize behavior                            |

When `f` is omitted, the server negotiates AVIF or WebP from `Accept` when that
format is enabled, then falls back to JPEG. Successful responses are public and
immutable because generated storage keys use immutable UUID leaves.

## Product Upload

```http
POST /api/v1/admin/products/:id/images
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

| Form field   | Required | Description                   |
| ------------ | -------- | ----------------------------- |
| `file`       | Yes      | Source image                  |
| `alt_text`   | No       | Accessible alternative text   |
| `is_primary` | No       | Boolean primary-image request |

The working product route validates the image, stores an original, creates a
`product_images` row, and returns its canonical URL, storage key, dimensions,
ordering, and primary state in the standard `201 Created` envelope.

The backend trusts decoded bytes, not the multipart filename or declared MIME
type. JPEG, PNG, WebP, and AVIF require their real container signatures and the
decoder must agree with that signature. By default, compressed files are limited
to 15 MiB, either source axis to 12,000 pixels, and total source pixels to 40
million. Multipart framing has a separate bounded allowance and does not reduce
the configured file-byte limit.

```json
{
  "data": {
    "id": 88,
    "image_url": "/media/products/12-highland-single-malt/gallery-550e8400-e29b-41d4-a716-446655440000.webp",
    "storage_key": "products/12-highland-single-malt/gallery-550e8400-e29b-41d4-a716-446655440000.webp",
    "alt_text": "Bottle front",
    "sort_order": 0,
    "is_primary": true,
    "width": 1600,
    "height": 2000
  }
}
```

New product uploads use the owner-aware
`products/<stable-product-id>-<sanitized-slug>/gallery-<uuid>.<ext>` namespace.
Existing `products/<uuid>.<ext>` keys remain valid and are not renamed by the
migration.

An externally hosted or static product image uses the same ordering, alt-text,
and primary-image behavior without claiming local blob ownership:

```http
POST /api/v1/admin/products/:id/images/url
Content-Type: application/json

{
  "image_url": "https://images.example/bottle.webp",
  "alt_text": "Bottle front",
  "is_primary": false
}
```

Absolute HTTPS URLs and root-relative static paths are supported. Canonical
`/media/...` values are rejected on this route because a local path without its
storage key would not have durable ownership.

## Legacy Standalone Upload

```http
POST /api/v1/admin/uploads
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

The legacy route accepts required `file` and optional `folder` fields. Its
folder allowlist is limited to `categories` and `uploads`; missing or unsupported
values fall back to `uploads`. It returns `url`, `key`, `width`, and `height` in
a `201 Created` envelope.

This route stores a blob but does not attach it to an owner row. It remains for
category compatibility; hero-slide, recipe, and journal forms use the
owner-aware contract.

An explicitly cancelled standalone upload is released with:

```http
POST /api/v1/admin/uploads/release
Content-Type: application/json

{"key":"categories/550e8400-e29b-41d4-a716-446655440000.webp"}
```

Only `categories/` and `uploads/` keys are accepted. The operation is idempotent
and checks all live database references immediately before deletion; an already
attached key is retained. Browser crashes and abandoned forms that cannot issue
this request are handled by age-gated reconciliation.

Product aggregate creates use the `uploads/` namespace as retry-safe staging.
The browser uploads each local file once, includes its `storage_key` in the
aggregate product snapshot, and retains both that immutable operation body and
its prepared blobs until the result is known, including across a page reload.
Attachment and standalone release share a per-key PostgreSQL
advisory lock, so a release either deletes the still-ownerless object before the
aggregate validates it or observes the committed reference and keeps it; it can
never delete a blob underneath a committed image row. A completed aggregate
operation can be replayed after the staged object is later detached and cleaned.
Lock holders are bounded relative to the database pool, reserving capacity for
the transaction/reference queries needed to complete and release those locks.

## Owner-Aware Upload Contract

```http
POST /api/v1/admin/uploads/:ownerType/:ownerID/:role
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

The route accepts a required `file` part and optional `alt_text` metadata for
cover/hero roles. `ownerID` is the positive database ID of an existing owner.
Only these owner and role combinations are supported:

| `ownerType`   | `role`    | Owner table   | URL column         | Storage-key column         |
| ------------- | --------- | ------------- | ------------------ | -------------------------- |
| `hero-slides` | `desktop` | `hero_slides` | `image_url`        | `image_storage_key`        |
| `hero-slides` | `mobile`  | `hero_slides` | `mobile_image_url` | `mobile_image_storage_key` |
| `recipes`     | `cover`   | `recipes`     | `image_url`        | `image_storage_key`        |
| `recipes`     | `og`      | `recipes`     | `og_image_url`     | `og_image_storage_key`     |
| `journal`     | `cover`   | `blogs`       | `image_url`        | `image_storage_key`        |

All other combinations must be rejected. A successful implementation stores the
blob under the owner's stable namespace and persists the URL/key pair on that
owner. Its response uses the same `url`, `key`, `width`, and `height` fields as
the legacy standalone upload.

URL, key, and supplied alt text are written to the owner in one database
transaction. A missing or soft-deleted owner returns `404`; unsupported owner/role
pairs return `400`.
Replacing a slot detaches the old key atomically, then best-effort removes its
original and every rendered derivative after confirming no live row still
references it. A cleanup failure never rolls back the successful owner write;
reconciliation retries it later.

## Reconciliation

`media-reconcile` inventories the authoritative originals against explicit key
columns and canonical `/media/...` URL references. It reports old orphan
candidates, referenced files missing from disk, sizes, timestamps, actions, and
a unique run ID as JSON. Dry run is the default:

```bash
./media-reconcile --min-age=24h
./media-reconcile --apply --cutoff=2026-07-25T12:00:00Z
```

Apply mode acquires a PostgreSQL advisory lock so only one replica runs, observes
the reviewed dry-run cutoff, and rechecks each candidate immediately before
deletion. Copy the `cutoff` value from the retained dry-run report into
`--cutoff`; without that flag the command derives a new cutoff from `--min-age`.
In Docker use `make dev-media-reconcile` or
`make prod-media-reconcile`; pass flags through `ARGS`.

Rendered files use a source-addressable `render-v2/<source-hash>/...` namespace,
so deleting an original purges all of its variants. The previous irreversible
`render/` namespace is discarded at backend startup. The original is always
verified before a cached derivative can be served.

### Hero Drafts

New hero files need the slide's stable numeric ID before their final key can be
generated. An inactive hero may therefore be created temporarily with a null
desktop image, then receive its owner-aware upload. Database and service
invariants reject activation until a non-blank desktop image is attached. Public
hero queries also exclude media-less rows defensively.

## Canonical Path And Key Invariants

- A storage key is a relative key without the `/media/` prefix.
- A non-null storage key is paired with a URL exactly equal to `/media/` plus
  that key. Schemes, hosts, and environment-specific API origins are never
  persisted in canonical local-media URLs.
- Keys are 1 through 512 bytes and use lowercase ASCII letters, digits, `.`,
  `_`, and `-` inside forward-slash-separated segments. Each segment starts with
  a letter or digit and is at most 255 bytes. URL delimiters, Windows device
  names, leading or trailing slashes, `//`, dot segments, backslashes, spaces,
  uppercase aliases, trailing dots, and control characters are invalid.
- Locally owned media persists both the key and URL. External URLs and static
  `/images/...` paths keep a null storage key.
- Uniqueness is enforced independently for each non-null storage-key column.
- Transform query strings are derived at render time and are never persisted as
  canonical URLs.

Owner namespaces use stable numeric IDs. A product slug may make a namespace
readable, but the stable product ID is its identity and an old namespace is not
renamed when the slug changes. The final filename is an immutable UUID plus the
probed image extension. Replacing media creates a new UUID leaf instead of
overwriting an existing key, which keeps immutable cache semantics valid.

## Migration And Rollback Policy

Migration `20260720110000_owner_aware_media.sql` applies these rules:

- It adds nullable storage-key columns for hero desktop/mobile images, recipe
  cover/Open Graph images, and journal covers.
- It backfills only canonical `/media/<safe-key>` values. External URLs,
  `/images/...` paths, and unsafe media paths retain null keys.
- It normalizes every safe, non-null `product_images.storage_key` to an
  `image_url` of `/media/<key>`. Unsafe product keys are set to null without
  changing their existing URL.
- If historical rows reuse one local key anywhere, every row keeps its renderable
  URL but receives a null key because no single row can safely own deletion.
- It adds concurrent per-column partial unique indexes and `NOT VALID` URL/key
  checks. New and updated rows are enforced immediately without a startup-time
  table validation scan.
- It does not move, rename, copy, or delete blobs. Existing flat UUID keys and
  earlier folder-based keys remain servable at their current paths.

Rollback removes the new indexes, constraints, and owner storage-key columns.
It does not remove the older `product_images.storage_key` column, move files, or
attempt to reconstruct old product image URLs. A previous absolute product URL
may have contained an environment-specific origin that cannot be recovered
safely, so normalized `/media/<key>` values remain after rollback. Unsafe or
shared product keys detached during Up also remain null because their prior
ownership cannot be reconstructed safely.

The migration is non-transactional and creates indexes concurrently to avoid
holding table locks across the full backfill. It does not use temporary tables
or session-scoped settings, so partial runs are safe to retry even when Goose
changes pooled connections between statements. Deploy it after draining older
backend instances: pre-057a writers do not clear a stored key when replacing a
content URL and may still persist an environment-specific product URL. Operators
that require a bounded lock wait should set `lock_timeout` on the dedicated
migration connection.

## Task Boundaries

- Task 057a owns storage-key schema, safe metadata backfill/normalization,
  canonical path invariants, write-once local storage, the owner/role key grammar,
  and owner-aware product paths. It does not change frontend uploader behavior.
- Task 057b implements and registers the owner-aware route, product URL images,
  inactive hero drafts, and shared staged URL/file inputs across products and
  content owners with explicit ownership attachment.
- Task 057c owns replacement/deletion cleanup, rendered-variant cleanup, orphan
  reconciliation, cache invalidation, and local storage operations guidance.
- Task 061d owns frontend/backend origin resolution. Persisted values stay
  origin-free (`/media/{key}`); the storefront resolves them via
  `lib/media/resolve-media-url.ts` against `NEXT_PUBLIC_MEDIA_BASE_URL` →
  `NEXT_PUBLIC_API_URL` → same-origin. Local development may use `http://`
  API origins; production configured origins must be `https://`.

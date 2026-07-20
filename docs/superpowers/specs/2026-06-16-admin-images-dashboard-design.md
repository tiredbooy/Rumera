# Design — Admin image pipeline + dashboard/product enhancements

**Date:** 2026-06-16
**Branch:** `dev`
**Status:** Approved (brainstorm) → coordination doc: [`/AGENT-TASKS.md`](../../../AGENT-TASKS.md)

## Goal

Three outcomes:

1. **Dynamic image optimization in Go** — upload an original once, serve it
   resized/recompressed in any format (AVIF / WebP / JPEG / PNG) at any quality,
   on the fly, using **bimg** (libvips). Format/quality/size are request-time
   parameters, not baked in at upload.
2. **Better admin product creation** — replace the mock-data scaffold with a form
   wired to the real backend, including a real multi-image uploader.
3. **Dashboard polish** — bring the admin dashboard up to the `ui-ux-pro-max`
   bar (premium dark+gold, RTL, a11y, responsive, motion-safe).

Plus housekeeping: move root docs into `docs/`, and run the work as two
coordinated agents tracked in `AGENT-TASKS.md`.

## Non-goals (YAGNI guardrails)

- No object storage yet (MinIO/S3) — **local disk only**, behind a `Storage`
  interface so it can be swapped later.
- No pre-generated variant sets — **on-the-fly transform only**, with a disk cache.
- No CDN, no background workers, no async job queue — transforms are synchronous
  + cached on first request.
- No new frontend dependencies beyond what the repo already ships.

## Architecture

### Backend (Go) — `apps/backend`

```
                    upload (admin)                     serve (public)
  multipart  ──►  POST /api/v1/admin/                GET /media/{key}?f&q&w&h&fit
                  products/{id}/images                        │
                         │                                    ▼
                         ▼                            ┌──────────────────┐
                 ┌──────────────┐  store original     │ transform (bimg) │
                 │ media.Service│ ───────────────────►│  + disk cache    │
                 └──────────────┘   product_images     └──────────────────┘
                         │             row (storage_key)         │
                         ▼                                       ▼
                 Storage interface  ◄── LocalStorage ──►  MEDIA_ROOT volume
```

- **`pkg/storage`** — `Storage` interface (`Put`, `Get`, `Open`, `Delete`,
  `Exists`) + `LocalStorage` writing under `MEDIA_ROOT`. Keys look like
  `products/{uuid}.{ext}`.
- **`internal/services` (media)** — orchestrates upload (validate MIME / size /
  dimensions → store original → DB row) and transform (resolve key → cache hit?
  → else bimg decode/resize/encode → write cache → return bytes + content-type).
- **`internal/handlers` (media)** — `POST .../images`, `GET/PUT/DELETE` image
  management, and the public `GET /media/{key}`.
- **bimg/libvips** — `github.com/h2non/bimg`. Needs `libvips` in the Docker image
  (cgo). Supported out formats: avif, webp, jpeg, png.
- **Cache** — rendered bytes cached on disk in `MEDIA_CACHE_DIR`, filename =
  hash of `key + normalized params`. Response sets
  `Cache-Control: public, max-age=31536000, immutable` + `Vary: Accept`.
- **DB** — goose migration adds `storage_key TEXT` to `product_images`
  (keep `image_url` for backward-compat / external URLs; new uploads populate
  `storage_key`). Image rows expose both to the API.

#### Config (env, `internal/config`)

| Var | Default | Meaning |
|-----|---------|---------|
| `MEDIA_ROOT` | `/data/media` | originals root |
| `MEDIA_CACHE_DIR` | `/data/media-cache` | rendered cache |
| Persisted media URL | `/media/<key>` | canonical, environment-independent path |
| `MEDIA_MAX_UPLOAD_MB` | `15` | reject larger uploads |
| `MEDIA_ALLOWED_FORMATS` | `avif,webp,jpeg,png` | allowed `f` values |
| `MEDIA_DEFAULT_QUALITY` | `80` | when `q` omitted |
| `MEDIA_MAX_DIMENSION` | `4000` | clamp `w`/`h` |

### Frontend (Next.js) — `apps/frontend`

- **`components/admin/product-form.tsx`** — rewritten against the real backend
  `Product`/`ProductImage` shape and `lib/api/admin-hooks.ts`. Sections: general
  info, pricing/inventory (variants), specs, SEO/meta, and a **multi-image
  uploader** (drag-drop, reorder, set primary, alt text, progress, remove).
- **`components/admin/optimized-image.tsx`** — `<OptimizedImage>` builds
  `/media/{key}?f=&q=&w=` URLs with `srcset` + lazy loading; used in tables/forms.
- **Dashboard** — `app/admin/page.tsx` + cards/charts/tables refined to the
  `ui-ux-pro-max` bar: skeletons, focus states, 44px targets, RTL, responsive
  375/768/1024/1440, `prefers-reduced-motion`.

> ⚠️ Frontend note: `apps/frontend/AGENTS.md` warns this Next.js has breaking
> changes — read `node_modules/next/dist/docs/` before writing frontend code.

## API contract (frozen — both agents build to this)

**Upload** — `POST /api/v1/admin/products/{id}/images` (admin auth, multipart;
field `file`, optional `alt_text`, `is_primary`):

```json
{ "data": { "id": 12, "key": "products/9f8c….webp", "url": "/media/products/9f8c….webp",
            "alt_text": null, "sort_order": 0, "is_primary": true,
            "width": 1000, "height": 1250 } }
```

**List** — `GET /api/v1/admin/products/{id}/images` → `{ "data": [ …image… ] }`
**Reorder** — `PUT /api/v1/admin/products/{id}/images/order` body `{ "ids": [12,9,4] }`
**Set primary** — `PUT /api/v1/admin/products/{id}/images/{imageId}/primary`
**Update alt** — `PATCH /api/v1/admin/products/{id}/images/{imageId}` body `{ "alt_text": "…" }`
**Delete** — `DELETE /api/v1/admin/products/{id}/images/{imageId}`

**Transform** — `GET /media/{key}` (public):

| Param | Values | Notes |
|-------|--------|-------|
| `f` | `avif`\|`webp`\|`jpeg`\|`png` | omit → negotiate from `Accept` (avif > webp > jpeg) |
| `q` | `1`–`100` | omit → `MEDIA_DEFAULT_QUALITY` |
| `w`,`h` | px | clamp to `MEDIA_MAX_DIMENSION`; aspect kept unless both given |
| `fit` | `cover`\|`contain`\|`inside` | default `inside` |

Errors use the existing `{ "error": { "code", "message" } }` envelope.

## Error handling

- Upload: reject unsupported MIME, oversize (`MEDIA_MAX_UPLOAD_MB`), or undecodable
  files with `422`/`413` + clear messages; never write a DB row if storage fails.
- Transform: invalid `f`/`q`/`w` → `400`; missing key → `404`; bimg failure →
  `500` logged, original served as fallback when possible.
- Frontend: per-file upload errors shown inline next to the thumbnail; the form is
  still submittable with already-uploaded images.

## Testing / verification

- **Backend:** `go build ./...` + `go vet ./...`; unit test for the param parser
  and the cache-key hasher; a handler smoke test for upload→transform round-trip
  (skips if libvips absent). `gofmt` clean.
- **Frontend:** `pnpm/npm run lint` + `build` (or `tsc --noEmit`) green.
- **Integration:** upload an image in admin, confirm `/media/{key}?f=avif&q=70&w=600`
  returns AVIF bytes and a second request is a cache hit.

## Execution model

Two specialized agents, run **sequentially** (A then B) to keep `dev` clean —
never two concurrent pushers on one branch. Split strictly by directory:

- **Agent A** → `apps/backend`, `infra/`, Docker, `docs/` move.
- **Agent B** → `apps/frontend` only.

Both build to the frozen contract above, so B never blocks on A at design time.
Full task breakdown, rules, and the per-task commit/push protocol live in
[`/AGENT-TASKS.md`](../../../AGENT-TASKS.md).

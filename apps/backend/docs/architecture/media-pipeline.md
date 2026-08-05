# Media pipeline

**Who this is for:** anyone implementing uploads, transforms, product images, or
cleanup jobs.

**Frontend companion:**
[`apps/frontend/docs/features/media-and-cache.md`](../../../frontend/docs/features/media-and-cache.md)  
**API reference:** [`docs/api/media.md`](../api/media.md)

---

## Goals

1. **Durable ownership** — every stored object knows which product/content owns
   it (or is explicitly standalone with release semantics).
2. **Origin-independent URLs** — DB stores `/media/{key}` or external `https://…`,
   never a hardcoded dev host.
3. **On-the-fly transforms** — clients request format/size; originals stay
   untouched.
4. **Safe failure** — ambiguous DB failures must not delete the only blob copy;
   definitive rejections may compensate by deleting orphan uploads.

---

## High-level flow

```
Admin multipart upload
        │
        ▼
handler Media.Upload / UploadOwnerImage / UploadImage
        │
        ▼
service validates size/type, writes blob via pkg/storage
        │
        ▼
DB row (product_images / content media attachment) with canonical path
        │
        ▼
Public or admin clients request GET /media/{key}?f=webp&w=800
        │
        ▼
Transform (pkg/imaging) → cache → bytes + Content-Type
```

External image URLs can be attached without storage ownership (admin “add URL”)
subject to safety checks (scheme/host rules in service tests).

---

## Key endpoints (conceptual)

| Endpoint | Purpose |
|----------|---------|
| `POST /admin/products/:id/images` | Multipart product image |
| `POST /admin/uploads` | Standalone upload |
| `POST /admin/uploads/release` | Drop unattached standalone blob |
| `POST /admin/uploads/:ownerType/:ownerID/:role` | Owner-scoped content upload |
| Product image CRUD | reorder, primary, patch, delete |
| `GET /media/*` | Public transform + serve |

Exact paths and payloads: [media.md](../api/media.md).

---

## Storage keys and URLs

- Keys look like `products/{uuid}.webp` or content-owner paths.
- Canonical public path: `/media/{key}`.
- Transform query params (handled in handler):
  - `f` — avif | webp | jpeg | png (may negotiate from Accept)
  - `q` — quality
  - `w` / `h` — dimensions (clamped by config)
  - `fit` — cover | contain | inside

Config knobs (`configs/config.go`):

- `MEDIA_MAX_UPLOAD_MB`
- `MEDIA_DEFAULT_QUALITY`
- `MEDIA_MAX_DIMENSION`
- `MEDIA_MAX_SOURCE_DIMENSION`
- `MEDIA_MAX_SOURCE_PIXELS` (decompression bomb guard)

---

## Ownership and lifecycle

- **Product images** are tied to product id; delete product/image removes or
  schedules cleanup of owned blobs per service rules.
- **Owner uploads** attach to typed owners (recipe, category, hero, …).
- **Standalone uploads** must be released or attached — the
  `media-reconcile` command finds orphans.

### Reconcile job

```bash
go run ./cmd/media-reconcile           # dry-run report
go run ./cmd/media-reconcile --apply   # delete confirmed orphans
# optional: --min-age, --cutoff (RFC3339)
```

Always review a dry-run before `--apply` in production.

---

## Frontend contract

Store origin-independent paths. Frontend joins:

1. `NEXT_PUBLIC_MEDIA_BASE_URL`, else
2. `NEXT_PUBLIC_API_URL`, else
3. same-origin empty string

Production configured origins must be HTTPS. See frontend media doc.

---

## Testing

Extensive unit coverage lives in:

- `internal/services/media_upload_test.go`
- `internal/services/media_validation_test.go`
- `internal/services/media_lifecycle_test.go`
- `pkg/imaging/*_test.go`
- `pkg/storage/*_test.go`

Prefer extending those tests when changing ownership or compensation rules.

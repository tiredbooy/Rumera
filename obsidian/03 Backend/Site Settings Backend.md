---
tags: [backend, settings, content]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Site Settings Backend

Singleton storefront configuration document (store identity, contact, social, shipping copy, SEO defaults, maintenance). Admin PUT is last-write-wins-safe: `expected_updated_at` must match the row or the write is `409`.

## Package (feature slice)

```text
apps/backend/internal/features/site_settings/
  doc.go → routes.go → handler.go → service.go → repository.go → model.go → mapper.go
```

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/v1/settings` | Public; Redis read-through + singleflight |
| GET | `/api/v1/admin/settings` | Admin full document |
| PUT | `/api/v1/admin/settings` | Partial group replace; requires `expected_updated_at` (admin GET `updatedAt`); stale revision → `409 CONFLICT`; invalidates cache |

## Related

[[Site Settings]] · [[ADR Backend feature packages]] · [[Backend package map]] · [[Hero and Home]]

API: `apps/backend/docs/api/site-settings.md`

#backend #settings

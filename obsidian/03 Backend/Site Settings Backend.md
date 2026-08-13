---
tags: [backend, settings, content]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Site Settings Backend

Singleton storefront configuration document (store identity, contact, social, shipping copy, SEO defaults, maintenance).

## Package (feature slice)

```text
apps/backend/internal/features/site_settings/
  doc.go → routes.go → handler.go → service.go → repository.go → model.go → mapper.go
```

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/v1/settings` | Public; Redis read-through + singleflight |
| GET | `/api/v1/admin/settings` | Admin full document |
| PUT | `/api/v1/admin/settings` | Partial group replace; invalidates cache |

## Related

[[Site Settings]] · [[ADR Backend feature packages]] · [[Backend package map]] · [[Hero and Home]]

API: `apps/backend/docs/api/site-settings.md`

#backend #settings

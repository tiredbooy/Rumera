---
tags: [backend, account, alerts]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Product Alerts Backend

Restock / price-drop alerts + cron

## Package (feature slice)

```text
apps/backend/internal/features/alerts/
  doc.go → routes.go → handler.go → service.go → repository.go → model.go
```

Mounted via `RegisterCustomer` / `RegisterAdmin` from `internal/routes/routes.go`.

## Related

[[Account Domain]] · [[ADR Backend feature packages]] · [[Backend package map]] · [[Loyalty Wallet Gift Cards]]

#backend #alerts

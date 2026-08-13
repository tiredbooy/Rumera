---
tags: [backend, account, referral]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Referral Backend

Referral codes; awards via loyalty

## Package (feature slice)

```text
apps/backend/internal/features/referral/
  doc.go → routes.go → handler.go → service.go → repository.go → model.go
```

Mounted via `RegisterCustomer` / `RegisterAdmin` from `internal/routes/routes.go`.

## Related

[[Account Domain]] · [[ADR Backend feature packages]] · [[Backend package map]] · [[Loyalty Wallet Gift Cards]]

#backend #referral

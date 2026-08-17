---
tags: [backend, account, referral]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Referral Backend

Referral codes; awards via loyalty. `POST /referrals/claim` returns `{claimed: true}` or `400` (PR-054a) — invalid / already-claimed is not a silent 204. `OnPaidOrder` Awards both sides **before** Complete so a failed grant can be retried (PR-003h). Payment Confirm still does not fail if this errors after commit.

## Package (feature slice)

```text
apps/backend/internal/features/referral/
  doc.go → routes.go → handler.go → service.go → repository.go → model.go
```

Mounted via `RegisterCustomer` / `RegisterAdmin` from `internal/routes/routes.go`.

## Related

[[Account Domain]] · [[ADR Backend feature packages]] · [[Backend package map]] · [[Loyalty Wallet Gift Cards]] · [[Payments Backend]] · [[Journey Referral complete on paid order]]

#backend #referral

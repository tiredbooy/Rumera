---
tags:
  - backend
  - notifications
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Notifications

Dispatcher modes: `inline` | `async` (outbox).

Async: domain TX + outbox row → worker relay → Kafka → consumer → SMS/email + delivery ledger.

Producers: OTP, password reset, **paid** order receipt (`DispatchOrderConfirmed` after `payments.Confirm` or wallet-paid create — PR-020o; not unpaid `POST /orders`), gift-card purchase code (`DispatchGiftPurchased`, PR-005b), product alert (`DispatchAlert`, PR-055a), cellar-box renewal (`DispatchSubscriptionRenewal`, PR-055a).

Related: [[Auth and Sessions]] · [[Orders]] · [[Processes and Jobs]] · [[Data Stores]]

Bridge: `apps/backend/docs/architecture/notifications-kafka.md`

#backend #notifications

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

Producers: OTP, password reset, order confirmation.

Related: [[Auth and Sessions]] · [[Orders]] · [[Processes and Jobs]] · [[Data Stores]]

Bridge: `apps/backend/docs/architecture/notifications-kafka.md`

#backend #notifications

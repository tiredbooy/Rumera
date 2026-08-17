---
tags: [journey, notifications]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 09 Journeys]]


# Journey: Notification async

1. Handler or cron (alert / box renewal) calls Dispatcher with `NOTIFICATIONS_MODE=async`
2. Outbox row (same TX when possible) → [[Term outbox]]
3. `notification-worker` relay → Kafka
4. Consume → SMS/email · delivery ledger idempotency
5. Failures → DLQ / metrics

Related: [[Notifications]] · [[Processes and Jobs]] · [[ADR Outbox Kafka notifications]]

#journey

---
tags: [decision]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 11 Decisions]]


# ADR: Outbox + Kafka notifications

**Status:** accepted (async path); default often inline for local

**Decision:** Dual-write forbidden. Async notifications use outbox then Kafka; worker delivers with idempotency ledger. Cron producers (PR-055a): product alerts (`notification.alert.v1`) and cellar-box renewal (`notification.subscription_renewal.v1`) go through the same Dispatcher when wired.

**Consequences:** Need worker process in async prod · [[Term inline vs async notifications]] · docs in notifications-kafka.

Related: [[Notifications]] · [[Journey Notification async]] · [[Processes and Jobs]]

---
tags: [decision]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 11 Decisions]]


# ADR: Outbox + Kafka notifications

**Status:** accepted (async path); default often inline for local

**Decision:** Dual-write forbidden. Async notifications use outbox then Kafka; worker delivers with idempotency ledger.

**Consequences:** Need worker process in async prod · [[Term inline vs async notifications]] · docs in notifications-kafka.

Related: [[Notifications]] · [[Journey Notification async]] · [[Processes and Jobs]]

---
tags: [glossary, notifications, events]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 08 Glossary]]


# Term: outbox

A row written **inside the same database transaction as the domain data**, then
relayed onward by a separate worker. That is what makes the side effect and the
business write agree: they commit together or not at all.

Rumera has **two** outboxes, deliberately not merged.

| | `domain_events` | `notification_outbox` |
| --- | --- | --- |
| Content | A **fact** — "order 42 was paid" | A **command** — "send this email" |
| Written by | A domain service, inside its money/catalog transaction | The notification `Dispatcher` |
| Consumers | N independent, each with its own ledger row, retry budget and dead-letter state | One delivery handler |
| One consumer failing | Does not affect the others | Is the whole delivery |
| Key | `order:42:paid` | `order:42:confirm`, `otp:0912:login:123456` |

A consumer of a fact may *issue* a command — the `order.paid` receipt consumer
does exactly that. The reverse never happens.

**Not** the same thing as `idempotency_keys` (HTTP request replay, PH-011) or
`payment_loyalty_awards` (a domain-specific earn intent that predates the bus).

See [[ADR Domain event outbox]] · [[ADR Outbox Kafka notifications]] ·
[[Term envelope]] · [[Term inline vs async notifications]] · [[Notifications]]

# Event-driven + capacity — charter

**Workstream:** `event-driven-capacity-20260816`  
**Mode:** Plan first. Implement only lettered tasks the founder claims.

## What “event-driven” means here

The **customer API stays HTTP + JSON**. Browsers and Next.js do **not** become
Kafka clients. After a **committed** business transaction, the API writes a
**domain event to an outbox in the same Postgres TX**. A relay publishes;
**idempotent consumers** do side work (email, search index, analytics, loyalty
retry, recs, cache bust).

This is **not**:
- Event sourcing the catalogue
- CQRS for every read
- Microservices
- Replacing checkout with a saga choreography that can lose money
- WebSocket-everything

Money paths (reserve, pay, refund, wallet debit) stay **explicit transactions**.
Events notify; they do not become the ledger.

## Already built (do not reinvent)

- `notification_outbox` + `NOTIFICATIONS_MODE=async` + Kafka worker
- Analytics in-process queue → Timescale
- Cron in `internal/corn`
- Idempotency platform (PH-011)
- Loyalty award intent retry (PR-003h)
- k6 smoke / mixed / capacity / frontend-capacity / cart-write (gaps: auth
  checkout, multi-user cart, search, admin, runbook)

## Claim IDs

- **ED-000+** platform (outbox, envelope, relay)
- **ED-010+** money/stock consumers
- **ED-020+** catalog/search/cache
- **ED-030+** engagement (loyalty, recs, analytics)
- **ED-040+** FE stays HTTP; optional live admin later
- **K6-000+** load suite (runnable scripts)

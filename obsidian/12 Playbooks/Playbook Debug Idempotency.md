---
tags: [playbook, money, reliability]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 12 Playbooks]]


# Playbook: Debug Idempotency

## Symptoms / when to use

- Double order after slow checkout or double-tap
- Double wallet credit / gift redeem / loyalty spend
- Payment webhook storms / order paid twice (or never settles)
- Client gets **409** “in progress” or “different payload”
- Admin credit “did nothing” on retry (expected replay)

## FE / BFF first checks

1. Does the client send **`Idempotency-Key`** on money POSTs?
   - `POST /orders`, `/gift-cards/redeem`, `/loyalty/redeem`, admin wallet credit
2. Is the key **stable for one user intent** (UUID once per click) and resent on retry?
3. Did the body change under the same key? → **409 body mismatch** — new key required.
4. Does the BFF **forward** the header unchanged to Go?

Admin credit also needs body `idempotency_key` (required by service). Prefer same value in header + body.

## Inspect Postgres (`idempotency_keys`)

```sql
-- recent
SELECT key, request_hash, response_code,
       length(response_body) AS body_len, created_at
FROM idempotency_keys
ORDER BY created_at DESC
LIMIT 50;

-- in-flight (stuck claims)
SELECT key, created_at, now() - created_at AS age
FROM idempotency_keys
WHERE response_code = 0
ORDER BY created_at;

-- by user + route fragment
SELECT * FROM idempotency_keys
WHERE key LIKE 'cust:42:POST:%'
ORDER BY created_at DESC;
```

Scoped key shape: `{tier}:{principal}:{METHOD}:{routeTemplate}:{clientKey}`

## Stuck in-flight

- Auto reclaim after **2 minutes** (`DefaultIdempotencyStaleAfter`).
- Manual delete only for dead pending rows you understand:

```sql
DELETE FROM idempotency_keys
WHERE key = $1 AND response_code = 0;
```

Do **not** casually delete completed 2xx rows (clients may still replay).

## Retention

- Cron `idempotency_cleanup` (default `0 30 3 * * *` UTC)
- Env `IDEMPOTENCY_KEY_RETENTION` default **720h (30d)**
- After prune, old keys no longer replay

## Metrics (local)

Scrape `GET /metrics`:

- `idempotency_claim_total`, `idempotency_replay_total`
- `idempotency_conflict_total{reason=body|inflight}`
- `idempotency_missing_key_total{route=…}` — FE adoption gap

## Webhook-specific

1. HMAC + secret first (`CRYPTO_WEBHOOK_KEY`)
2. Auto body-hash key if no header
3. **UNIQUE** `payment_transactions.transaction_id`
4. Terminal Confirm/Fail → **200** `{received, replayed:true}`

Also: [[Playbook Debug Webhook]]

## Layering (HTTP is not enough)

| Flow | HTTP store | Domain truth |
|------|------------|--------------|
| Order create | money middleware | atomic order TX |
| Admin credit | money middleware | ledger `idem=<key>` |
| Gift redeem | money middleware | card status one-shot |
| Loyalty redeem | money middleware | spend event key residual (PH-040) |
| Webhook settle | auto-key | UNIQUE tx id + pending-only |

## Verify

- Local: `go test ./pkg/middleware/ ./internal/routes/ -count=1` (money double-POST suite)
- Operator SQL above shows completed `response_code` and matching `request_hash`

## Depth (project)

- `apps/backend/docs/architecture/idempotency.md`
- `apps/backend/docs/architecture/idempotency-runbook.md`
- API: orders · wallet · gift-cards · loyalty · webhooks

## Related

[[Playbooks MOC]] · [[ADR Idempotency platform]] · [[Journey Idempotent retry checkout webhook]] ·  
[[Money and stock rules]] · [[Payments Backend]] · [[Wallet Backend]] · [[Orders Backend]] ·  
[[Gift Card Backend]] · [[Loyalty Backend]] · [[Observability]]

#playbook #money

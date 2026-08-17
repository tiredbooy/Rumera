# Idempotency operator runbook

**Audience:** engineers debugging double charges, stuck retries, webhook storms.  
**Depth:** this page. Design: [idempotency.md](./idempotency.md).  
**Program:** PH-011e.

---

## 1. FE / client rules (send a key)

| Route | Header | Required today? | Generate once per… |
| --- | --- | --- | --- |
| `POST /api/v1/orders` | `Idempotency-Key` | **Recommended** (optional; without it no HTTP replay cache) | Checkout click / place intent |
| `POST /api/v1/gift-cards/redeem` | same | Recommended | Redeem button press |
| `POST /api/v1/loyalty/redeem` | same | **Required** (header or body `idempotency_key`) | Redeem action |
| `POST /api/v1/admin/users/:userID/wallet/credit` | same | Recommended; **also** service stores `idem=` in ledger | Admin confirm credit |
| `POST /api/v1/admin/users/:userID/loyalty/adjust` | same | Required at service (8–128); HTTP cache when header present | Admin grant / clawback |
| `POST /api/v1/webhooks/payment` | optional | Auto from body hash if omitted | Gateway redelivery of **same** body |

**How to generate**

```text
crypto.randomUUID()   // or ULID
// Persist for this intent (React state / sessionStorage) and resend on retry.
// New user intent → new key. Never reuse a key for a different body.
```

**Constraints:** printable ASCII, length **8–128**, no whitespace, no `|`.

**On 409**

| Message (typical) | Meaning | Client action |
| --- | --- | --- |
| key reused with different payload | Same key, different body | New key + new request |
| request already in progress | In-flight claim &lt; ~2m | Wait/retry same key+body |
| (conflict from domain) | Business rule | Surface domain error |

**On timeout:** retry with **same** key + **same** body. Expect 2xx replay with original response body.

---

## 2. Inspect keys (Postgres)

```sql
-- recent claims
SELECT key, request_hash, response_code,
       length(response_body) AS body_len, created_at
FROM idempotency_keys
ORDER BY created_at DESC
LIMIT 50;

-- in-flight (response_code = 0)
SELECT key, created_at, now() - created_at AS age
FROM idempotency_keys
WHERE response_code = 0
ORDER BY created_at;

-- by principal / route fragment (scoped PK)
SELECT * FROM idempotency_keys
WHERE key LIKE 'cust:42:POST:%'
ORDER BY created_at DESC;
```

Scoped key shape:

```text
{tier}:{principal}:{METHOD}:{routeTemplate}:{clientKey}
-- e.g. cust:42:POST:/api/v1/orders:550e8400-e29b-41d4-a716-446655440000
```

---

## 3. Stuck in-flight keys

If a process died after Claim and before Complete/Release:

- **Automatic:** after **2 minutes** (`DefaultIdempotencyStaleAfter`), next Claim with same scoped key **reclaims** the row.
- **Manual (ops only, rare):**

```sql
-- only if you understand the request is dead and age > stale lease
DELETE FROM idempotency_keys
WHERE key = $1 AND response_code = 0;
```

Prefer waiting for stale reclaim. Do **not** delete completed 2xx rows casually (clients may still replay).

---

## 4. Retention cron

| Env | Default | Job |
| --- | --- | --- |
| `IDEMPOTENCY_KEY_RETENTION` | `720h` (30d) | `idempotency_cleanup` in `internal/corn` |
| schedule | `CRON_IDEMPOTENCY_CLEANUP_SCHEDULE` | default `0 30 3 * * *` |

Prunes rows with `created_at` older than retention. Completed responses older than retention will no longer replay — clients should not retry days later with the same key expecting a free replay.

---

## 5. Metrics (local Prometheus)

Scrape `/metrics` (if enabled). Useful series:

- `idempotency_claim_total{result=…}`
- `idempotency_replay_total`
- `idempotency_conflict_total{reason=body|inflight}`
- `idempotency_missing_key_total{route=…}` — FE adoption gap

High `missing_key` on `/orders` → storefront not sending headers yet.

---

## 6. Webhook-specific

1. HMAC must pass before idempotency matters.
2. Same body redelivery → HTTP auto-key replay **or** domain terminal ACK `{replayed:true}` with 200.
3. Gateway `transaction_id` is **UNIQUE** — cannot insert two pending rows for one gateway id.
4. Playbook: Obsidian `Playbook Debug Webhook` + this page.

---

## 7. Admin wallet credit (two layers)

1. **HTTP** money middleware (scoped key).  
2. **Service** ledger description `idem=<key>` — second POST with same key returns existing credit without double deposit.

Prefer always sending `Idempotency-Key` from admin UI.

---

## 8. When to escalate

| Symptom | Check |
| --- | --- |
| Double order | FE key missing? order rows created_at; idempotency_keys for cust uid |
| Double stock deduct | payment_transactions unique + webhook logs; Confirm only pending |
| 409 inflight forever | stuck claim age; reclaim after 2m; process panics |
| Replay returns wrong user data | scoped key bug — key must include principal |

---

## Related

- [idempotency.md](./idempotency.md)  
- [money-and-stock-sagas.md](./money-and-stock-sagas.md)  
- [payments-and-webhooks.md](./payments-and-webhooks.md)  
- API: [orders](../api/orders.md) · [wallet](../api/wallet.md) · [webhooks](../api/webhooks.md) · [gift-cards](../api/gift-cards.md) · [loyalty](../api/loyalty.md)  
- Ops: [operations.md](../operations.md) · [observability.md](../observability.md) (metrics table)  


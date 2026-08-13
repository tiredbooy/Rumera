# Webhooks


**Implementation (feature slice):** `internal/features/payments/`
Inbound callbacks from the payment gateway. These endpoints are **public** (the gateway carries no JWT) but every request is verified by an HMAC signature over the raw body — they are not part of the JWT-guarded route groups.

See [Authentication](../authentication.md) for the token model and trust tiers, and [Conventions](../conventions.md) for the response/error envelope.

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| POST | `/webhooks/payment` | 🌐 public (signed) | Receive an async payment result |

---

## Signature scheme

Every request must carry an `X-Webhook-Signature` header whose value is the lowercase hex-encoded HMAC-SHA256 of the **raw request body**, keyed with the shared secret `CRYPTO_WEBHOOK_KEY`:

```
X-Webhook-Signature: hex(hmac_sha256(rawBody, CRYPTO_WEBHOOK_KEY))
```

The signature is computed over the exact bytes sent, so the body must be signed and transmitted unmodified (no re-serialization). The server recomputes the HMAC over the bytes it receives and compares in constant time. A missing, malformed, or mismatched signature is rejected before the body is parsed.

If the server has no webhook secret configured, the endpoint is disabled and returns `503`.

---

## Payment result

```
POST /webhooks/payment
X-Webhook-Signature: <hex hmac_sha256 of the raw body>
Idempotency-Key: <optional>   # if omitted, auto-derived from body hash
```

Delivers the final result of a payment transaction.

- On `"succeeded"`: the payment is confirmed (the order is marked paid) and the reserved stock is **deducted**.
- On `"failed"`: the failure is recorded and the reserved stock is **released** back to sale.

**Idempotency / replay (PH-011):**

1. HTTP middleware stores successful responses (auto-key from body when header absent).
2. `payment_transactions.transaction_id` is **UNIQUE** — cannot insert two rows for one gateway id.
3. Confirm/Fail only move **pending** rows; if the row is already terminal, the handler returns
   **`200`** with `{ "received": true, "replayed": true }` so gateways stop redelivery without double deduct.

See [idempotency.md](../architecture/idempotency.md) · [payments-and-webhooks.md](../architecture/payments-and-webhooks.md).

Duplicate or late callbacks for an already-settled transaction are acknowledged rather than retried.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `transaction_id` | string | ✓ | Gateway transaction reference |
| `status` | string | ✓ | `succeeded` or `failed` |
| `error_message` | string | | Human-readable failure reason (used on `failed`) |

```json
{
  "transaction_id": "txn_9f8a7b6c",
  "status": "succeeded",
  "error_message": ""
}
```

**Response** `200 OK`

```json
{ "received": true }
```

When the payment was already terminal (prior success/fail) and this delivery is a
gateway redelivery, the body may include `"replayed": true`:

```json
{ "received": true, "replayed": true }
```

**Errors:**

| HTTP | Meaning |
|------|---------|
| `503` | Webhook secret not configured (endpoint disabled) |
| `401` | Missing or invalid signature |
| `400` | Unreadable/invalid JSON body, empty `transaction_id`, or unknown `status` |
| `409` | HTTP idempotency in-flight / body mismatch (rare on auto-key) |

---

## Computing the signature

Sign the raw body bytes with the shared secret, then send that same body unchanged. Using `openssl` to compute the HMAC:

```bash
SECRET="$CRYPTO_WEBHOOK_KEY"
BODY='{"transaction_id":"txn_9f8a7b6c","status":"succeeded","error_message":""}'

SIG=$(printf '%s' "$BODY" \
  | openssl dgst -sha256 -hmac "$SECRET" -hex \
  | sed 's/^.*= //')

curl -X POST http://localhost:8080/api/v1/webhooks/payment \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $SIG" \
  -d "$BODY"
```

`printf '%s'` (not `echo`) is used so no trailing newline is added to the signed bytes, and the exact same `$BODY` is sent as the request payload.

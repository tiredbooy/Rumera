# Integration test suite

Tag-gated tests that exercise money/stock-critical paths against a **real
Postgres**, kept out of the default `go test ./...` run by the `integration`
build tag so unit runs stay fast.

## Why not testcontainers

The original plan used [testcontainers-go]. Its Docker SDK pulls
`github.com/klauspost/compress`, which the build sandbox's module proxy **403s**,
so testcontainers can't compile here. Instead the harness connects to a Postgres
the operator/CI provides via `TEST_DATABASE_URL` — no extra Go dependency, works
identically locally and in CI (where a `postgres` service is trivial to add).
When `TEST_DATABASE_URL` is unset the whole suite **skips cleanly**.

## Running it

```bash
cd apps/backend

# 1. throwaway Postgres
docker run -d --name pg -e POSTGRES_PASSWORD=test -e POSTGRES_USER=test \
    -e POSTGRES_DB=rumera_test -p 55432:5432 postgres:17-alpine
docker run -d --name redis-test -p 56379:6379 redis:8-alpine

# 2. point the suite at it and run (make target already exists)
export TEST_DATABASE_URL='postgres://test:test@localhost:55432/rumera_test?sslmode=disable'
export TEST_REDIS_ADDR='localhost:56379'
make test-integration         # go test -tags=integration -count=1 ./tests/integration/...

# 3. cleanup
docker rm -f pg redis-test
```

## How it works

`harness_test.go`:

- `TestMain` connects the pool, runs `migrations/main` from disk via **goose**
  (the same migrations the app embeds — no embed needed here), then runs the
  suite. Skips with exit 0 if `TEST_DATABASE_URL` is unset.
- `requireDB(t)` skips an individual test when there's no database.
- `resetTables(t, ...)` truncates (RESTART IDENTITY CASCADE) so each test starts
  clean without re-migrating.
- `seed_test.go` holds minimal row factories (user, product, variant, inventory,
  order, order item, payment txn, coupon) so tests read as assertions, not setup.

Tests build real feature repositories and services under
`internal/features/...` over the pool — they exercise production wiring, not a
re-implementation.
- Redis-backed tests are optional and skip when `TEST_REDIS_ADDR` is unset. They
  exercise the production Lua script used for atomic refresh-token replacement.

## What it covers

| File | Proves |
|------|--------|
| `harness_test.go` → `TestMigrationsApply` | the full `migrations/main` schema applies cleanly to an empty DB |
| `payment_test.go` → `TestPaymentConfirm_DeductsStockAtomically` | `PaymentService.Confirm` marks payment succeeded + order paid **and** drains committed stock in one transaction; a replayed callback neither re-confirms nor double-deducts |
| `coupon_test.go` → `TestCouponUsageLimit_HoldsUnderConcurrency` | two concurrent redemptions of a `max_uses=1` coupon record **exactly one** usage (the `LockByID` + `CountUsagesTx` row-lock re-check closes the TOCTOU race) |
| `user_admin_test.go` | the single-role schema, inactive-aware admin reads, server-hashed creation, duplicate identity conflicts, self-lockout guards, transactional actor revalidation, and redacted newest-first audit history |

## Notes

- A clean run of this suite also surfaced (and we fixed) a latent schema bug:
  `order_items.product_variant_id` was referenced by `BulkCreate`/`GetItems` but
  never created by a migration, so checkout failed at runtime. Added in
  `migrations/main/20260616131000_order_items_variant.sql`.
- Next candidates: idempotency-replay of the payment webhook over the real
  `idempotency_keys` store, and a full cart→order→confirm flow end-to-end.

[testcontainers-go]: https://github.com/testcontainers/testcontainers-go

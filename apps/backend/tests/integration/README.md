# Integration test suite (D3)

Tag-gated integration tests that exercise the full checkout flow against **real**
Postgres + Redis containers via [testcontainers-go]. Kept out of the default
`go test ./...` run by the build tag, so unit runs stay fast.

> **Status:** harness designed; implementation pending the dependency fetch.
> The container `go get` is currently blocked in the dev sandbox by a module
> proxy that 403s `github.com/klauspost/compress@v1.18.5` (a testcontainers
> transitive dep). It resolves normally on an open network / in CI — see
> *Enabling* below. The `make test-integration` target already exists.

## Enabling

```bash
cd apps/backend
go get github.com/testcontainers/testcontainers-go@latest \
       github.com/testcontainers/testcontainers-go/modules/postgres@latest \
       github.com/testcontainers/testcontainers-go/modules/redis@latest
go mod tidy
make test-integration   # go test -tags=integration -count=1 ./tests/integration/...
```

Requires a running Docker daemon (testcontainers talks to it).

## What the suite covers

Every test file starts with:

```go
//go:build integration

package integration
```

so it compiles only under `-tags=integration`.

Planned cases (one container set per package, shared via `TestMain`):

1. **Bring-up** — start `timescale/timescaledb:latest-pg17` (main + analytics)
   and `redis:8-alpine` containers; run `migrations/main` and
   `migrations/analytics` with the same goose embed used in `pkg/database`.
2. **Full checkout flow** — seed a user, product, variant, inventory row,
   shipping zone+method; then:
   - add-to-cart → validate coupon → `OrderService.CreateOrder`
   - assert order is `pending` and stock moved available→committed (Reserve)
   - `PaymentService.Confirm` (or the webhook path) → assert order `paid`
   - `InventoryService.DeductForOrder` → **assert stock_on_hand deducted**.
3. **B4 idempotency replay** — POST the payment webhook twice with the same
   body through the real `pkg/middleware.Idempotency` over the Postgres
   `idempotency_keys` store; assert the second call returns the stored response
   and the order is paid/stock deducted **exactly once**.
4. **B2 degradation (optional)** — stop the Redis container mid-run; assert the
   read-through cache falls back to the DB and readiness reports `degraded`
   while staying `200`.

## Notes

- Reuse `pkg/database` for pool construction + migrations and the real services
  from `internal/services` so the test exercises production wiring, not a
  re-implementation.
- Keep fixtures in a `seed.go` helper (also `//go:build integration`) so each
  test reads as flow assertions, not setup noise.

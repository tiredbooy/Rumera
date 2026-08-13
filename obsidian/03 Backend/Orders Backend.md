---
tags: [backend, orders, commerce]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Orders Backend

Checkout order creation and lifecycle (customer list/cancel, admin status).

## Package (feature slice)

```text
apps/backend/internal/features/orders/
  doc.go → routes.go → handler.go → service.go
  → repository.go → item_repository.go → model.go → mapper.go
```

| Surface | Paths |
|---------|--------|
| Customer | `POST/GET /orders`, `GET /orders/:id`, `POST /orders/:id/cancel` |
| Admin | `GET /admin/orders`, status patch |

**Idempotency (PH-011):** `POST /orders` mounts money middleware. Send
`Idempotency-Key` once per checkout intent for replay-safe retries (optional until
FE RequireKey flip). See [[ADR Idempotency platform]] · [[Playbook Debug Idempotency]].

## Gift add-ons (PH-060)

- CreateOrder accepts `is_gift` + `gift_option_ids[]` (server-priced against [[Site Settings]] `gift` group)
- Snapshot: `gift_addons` JSONB + `gift_addons_fee`; included in generated `total_amount`
- Legacy `gift_wrap=true` maps to option id `gift_wrap` when present
- Errors: `GIFT_DISABLED`, `INVALID_GIFT_OPTION`
- Migration: `20260812180000_order_gift_addons.sql`

Downward deps: cart, coupons, shipping, addresses, inventory, payments, site_settings (gift config).

Payments avoid importing this package (cycle): they call `Repository.MarkAsPaid` +
`GetStockLines` via a small interface. Inventory uses `inventory.StockLine`.

`models.PaymentMethod` stays shared in `models/payment_method.go`.

## Related

[[Orders]] · [[Cart and Checkout]] · [[Payments Backend]] · [[Inventory Backend]] · [[ADR Backend feature packages]]

#backend #orders

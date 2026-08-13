# Gift checkout add-ons (PH-060)

**API:** [site-settings.md](../api/site-settings.md) · [orders.md](../api/orders.md)

Modular “buy as gift” packaging and extras are **admin-configured** in the
`site_settings` document (`gift` group) and **server-priced** at order create.

## Data flow

```
Admin PUT /admin/settings { gift: { enabled, options[] } }
        │
        ▼
  site_settings JSONB (singleton)
        │
        ├─ Public GET /settings → storefront checkout options + prices
        │
        └─ orders.CreateOrder(is_gift, gift_option_ids)
               → resolveGiftAddons(cfg, ids)
               → snapshot gift_addons + gift_addons_fee
               → total_amount generated column includes fee
```

## Money rules

- Client never sets fee; only option **ids**.
- Unknown or disabled id → `INVALID_GIFT_OPTION`.
- Gift while `gift.enabled=false` → `GIFT_DISABLED`.
- Historical invoices keep the snapshot (label/price at purchase time).

## Compatibility

- Legacy `gift_wrap: true` without ids selects option id `gift_wrap` when enabled.
- Column `gift_wrap` remains a denormalized flag for packing UIs.

## Code

| Layer | Path |
|-------|------|
| Settings model / defaults | `features/site_settings/gift.go`, `model.go` |
| Public projection | `features/site_settings/mapper.go` `ToPublic` |
| Order resolve | `features/orders/gift_options.go` |
| Migration | `migrations/main/20260812180000_order_gift_addons.sql` |

## FE

- Admin: settings tab «هدیه» (`GiftSection`)
- Checkout: modular multi-select + summary fee (`checkout-payment-step`, `checkout-flow`)
- Public settings BFF allowlist: `GET /api/public/settings`

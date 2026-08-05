---
tags: [backend]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Product Alerts Backend

## API surface (customer)

Typical routes (see API docs if present): create / list / delete product alerts for the JWT user.

## Service behavior

`AlertService`:

- Validates alert type: restock | price_drop
- Loads variant; 404 if missing
- Restock: conflict if currently available
- Persists alert with reference price

## Cron

`AlertCheckJob`:

- `FindPending` batch
- Build email subject/body
- `mailer.Send` when configured
- `MarkNotified` for sent IDs

**Note:** delivery is direct mailer from cron, parallel to [[Notifications]] Dispatcher used by OTP/order email. Unifying later would be a product decision — not done yet.

## Related

[[Product Alerts]] · [[Processes and Jobs]] · [[Inventory Backend]] · [[Catalogue]]

#backend

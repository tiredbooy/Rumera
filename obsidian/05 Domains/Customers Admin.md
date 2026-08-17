---
tags: [domain, admin]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 05 Domains]]


# Customers Admin

Staff CRM for users: list, detail, edit, lockout rules.

- FE: `features/customers` · admin customers
- BE: [[Users Backend]] · redaction · audit
- Permissions via [[RBAC]]
- **List orders count (PR-064c):** `GET /admin/users` already sends
  `total_orders`. The board prints it. Jump to `/admin/orders?user_id=`
  only when `user_id` is a positive **internal** id. Live list `user_id`
  is the public UUID — not a valid orders filter. See [[Orders]] ·
  [[Admin Console]].
- **Ban / unban (PR-040e / PR-064b):** `POST /admin/users/:userID/ban` · `/unban` (`customers:ban`, not write). FE: `UserAccountActions` confirm on customer detail. Hidden without the cap; self-ban hidden. PATCH cannot toggle `is_banned`.

- Loyalty members: `GET /admin/loyalty/members` uses the same public UUID as
  `/admin/customers/:id`. Adjust is `POST /admin/users/:userID/loyalty/adjust`
  (`customers:write`, same as wallet credit). Operator UI:
  `/admin/loyalty` + `/admin/loyalty/[userID]` (PR-003b)
  ([[Loyalty Backend]] · [[Loyalty FE]] · [[Journey Admin loyalty member lookup]])

Related: [[Admin Console]] · [[Auth and Sessions]] · [[Account Domain]] · [[Loyalty Wallet Gift Cards]]

#domain #admin

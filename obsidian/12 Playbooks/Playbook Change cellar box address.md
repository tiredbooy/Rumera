---
tags: [playbook, subscription]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 12 Playbooks]]


# Playbook: Change cellar box address

## Symptoms / when to use

- Active box shows amber «آدرسی به این باکس وصل نیست» and the customer already has addresses.
- Customer wants a different ship-to without pause / cancel / recreate.
- PATCH `/subscriptions/:id` with only `{ "action" }` — missing `address_id` (pre-PR-005c / pre-PR-035b).

## Steps

1. Confirm BE accepts address-only PATCH (`apps/backend/docs/api/subscriptions.md`, PR-005c).
2. Open `/account/subscriptions`. Address book is the same `useAddresses()` list used on create.
3. On **active** or **paused** cards, pick «تغییر آدرس ارسال» / «انتخاب آدرس ارسال».
4. FE sends `PATCH /subscriptions/:id` `{ "address_id": n }` — no lifecycle `action`.
5. Success toast «آدرس ارسال به‌روز شد». API errors go through `apiErrorToast`; do not toast success on failure.
6. Cancelled cards stay read-only. JSON `null` does **not** clear ship-to — picker never sends a clear.
7. Not PH-043c: no auto-charge, no payment side-effect.
8. **Ownership:** create (`POST /subscriptions`) and PATCH both call
   `addresses.GetByID(id, userID)`. Another customer's address (or a missing
   id) → `NOT_FOUND`. Picker only lists the caller's book, so a foreign id is
   a client/API bug, not a valid change.

## Verify

- Changing house → office updates the card after invalidate.
- Failed PATCH shows the API error only.
- Cancelled card has no picker.

## Related

[[Journey Manage cellar box]] · [[Subscriptions]] · [[Account FE]] · [[Addresses Backend]] · [[Playbooks MOC]]

#playbook

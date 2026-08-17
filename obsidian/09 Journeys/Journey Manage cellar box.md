---
tags: [journey]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 09 Journeys]]


# Journey: Manage cellar box (customer)

## Product framing

Customer manages a **recurring physical box** — pause, skip a period, cancel,
or reactivate. Account copy is box/shipment oriented, **not** “watch / stream / seats.”
(PH-043b UX polish)

## Actor

Signed-in customer

## Happy paths

### Subscribe

1. Open `/account/subscriptions`
2. Choose cadence monthly or quarterly
3. Optional ship-to from address book (default preferred)
4. `POST /subscriptions` → active `cellar-box`, `next_renewal_at` = now + cadence
5. Toast: box active; **no payment** taken
6. Already have an **active** box → `409 CONFLICT` (PR-057b). Pause or cancel
   first, or manage the existing card. Resume is also `409` if another row
   is already active.

### Pause / skip / cancel / resume

1. Card shows plan, cadence, **ارسال باکس بعدی** + honesty hint, optional ship-to
2. Pause / skip / cancel open confirm dialogs with effect copy
3. Actions map to `PATCH /subscriptions/:id` `{ "action": "…" }`
4. Backend enforces [[Subscriptions]] lifecycle matrix (`AllowedAction`)
5. Ship-to change (PR-005c + PR-035b): card picker on **active / paused**
   PATCHes `{ "address_id": n }` only — no pause/resume required.
   Cancelled cards stay read-only. See [[Account FE]] · [[Playbook Change cellar box address]]

| UI intent | Action | Effect |
|-----------|--------|--------|
| توقف موقت | pause | stop due emails / box windows |
| رد کردن این دوره | skip | next date + one cadence |
| لغو اشتراک | cancel | no more boxes until resume |
| از سر گرفتن / فعال‌سازی مجدد | resume | → active (`409` if another box is already active) |

## Failure branches

- Invalid transition → `INVALID_REQUEST` (surfaced via `apiErrorToast`)
- Second active create / resume → `CONFLICT` (409)
- Not owned → `NOT_FOUND`
- `address_id < 1` → `VALIDATION_ERROR`; unknown FK → `INVALID_REQUEST`
- Missing address on active/paused card → amber «آدرسی به این باکس وصل نیست»
  plus picker when the address book has rows (PR-035b).
- Address PATCH failure → `apiErrorToast` (no success toast).

## Domains touched

[[Subscriptions]] · [[Account Domain]] · [[Addresses Backend]] (select + display)

## Related

[[Journeys MOC]] · [[Subscriptions Backend]] · [[Journey Subscription renewal email]] ·
[[Account FE]] · [[Playbook Change cellar box address]] · [[Known gaps]] ·
project `apps/frontend/docs/features/subscriptions.md`

#journey

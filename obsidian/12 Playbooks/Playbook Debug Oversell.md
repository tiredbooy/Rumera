---
tags: [playbook]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 12 Playbooks]]


# Playbook: Debug oversell

## Symptoms

Two customers bought more than available · negative available · high committed with no pending orders.

## Checks

1. Deploy includes reserve **in** CreateOrder TX? ([[Inventory Backend]])
2. Stuck pending orders holding commit? List unpaid orders · release/cancel
3. Deduct running on Confirm? ([[Payments Backend]])
3b. Wallet checkout: debit + mark paid + deduct in the **create TX** (PR-020a)? Short wallet must roll reserve back (`INSUFFICIENT_FUNDS`) — [[Money and stock rules]] · [[Orders]]
4. Admin adjust wrong sign?
5. Concurrent checkout **40P01**? Lines must lock in VariantID order — `GetStockLines` sorts ascending (PR-020k; [[Money and stock rules]] · [[Orders Backend]])
6. Integration tests: `tests/integration/inventory_test.go`
7. Failed webhook then late `succeeded`? Order must be `payment_failed` (not still `pending`). Deduct without an **active** `inventory_reservations` row for that order is a steal — PR-020b. Re-release must not decrement another order’s committed pool.

## Related

[[Money and stock rules]] · [[Playbook Debug Webhook]] · [[Inventory]] · [[Testing]]

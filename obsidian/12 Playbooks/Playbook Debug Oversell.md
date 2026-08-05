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
4. Admin adjust wrong sign?
5. Integration tests: `tests/integration/inventory_test.go`

## Related

[[Money and stock rules]] · [[Playbook Debug Webhook]] · [[Inventory]] · [[Testing]]

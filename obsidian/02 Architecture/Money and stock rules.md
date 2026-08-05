---
tags: [architecture, commerce]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 02 Architecture]]


# Money and stock rules

Non-negotiable invariants.

## Money

1. Server is authority for totals, discounts, shipping quotes.
2. Prefer decimal **strings** on the wire; don’t round-trip money through JS float for storage.
3. Display: `formatPrice` / `faNum` · currency often IRT / [[Term Toman]].
4. Loyalty earn only after **paid** order ([[Payments Backend]]).

## Stock

1. Sellable = [[Term available_stock]], never on-hand alone.
2. Place order **reserves** in same TX as order ([[Inventory Backend]]).
3. Payment success **deducts** in same TX as mark paid.
4. Payment fail / cancel **releases** commitment.
5. Admin adjust cannot use reservation/release types (system-owned).

## Related journeys

[[Journey First purchase]] · [[Journey Payment webhook settle]] · [[Playbook Debug Oversell]]

Related: [[Inventory]] · [[Payments]] · [[Orders]] · [[Cart and Checkout]] · [[ADR Stock available not on-hand]] · [[ADR Order reserve and pay deduct atomic]]

#architecture #commerce

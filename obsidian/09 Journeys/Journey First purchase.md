---
tags: [journey, commerce]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 09 Journeys]]


# Journey: First purchase

## Steps

1. Land [[Hero and Home]] / [[Catalogue]] / [[Search]]
2. Open PDP → pick [[Term variant]] → add cart
3. [[Cart and Checkout]] address + shipping + coupon + payment method
4. Place order → [[Orders]] created · [[Inventory]] **reserve**
5. Pending [[Payments]] · confirmation page
6. Webhook success → paid · **deduct** · loyalty ([[Loyalty Wallet Gift Cards]])
7. Optional: order email [[Notifications]]
8. View under [[Account FE]] orders

## Failure branches

- Insufficient stock at place → whole order rolls back
- Pay fail → release stock
- Session missing → [[Journey OTP login]] / login

Related: [[Money and stock rules]] · [[Journey Payment webhook settle]] · [[Surface Storefront]]

#journey

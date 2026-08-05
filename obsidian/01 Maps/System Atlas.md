---
tags: [map, architecture, hub, brain]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 01 Maps]]


# System Atlas

One-page living map. **Graph neighbors** of this note are the core of Rumera.

## Topology

```text
Browser
   │
   ▼
 nginx
   ├─ /*  → [[Frontend App]]
   │          ├─ RSC public → [[Backend API]]
   │          └─ [[BFF Proxies]] → [[Backend API]]
   └─ /api/v1 → [[Backend API]]
                   │
     ┌─────────────┼──────────────┬────────────────┐
     ▼             ▼              ▼                ▼
 [[Data Stores]] [[Media Pipeline]] [[Notifications]] [[Processes and Jobs]]
```

## Money path (critical)

[[Cart and Checkout]] → [[Orders]] → reserve [[Inventory]] → pending [[Payments]]  
→ webhook → confirm + deduct · loyalty [[Loyalty Wallet Gift Cards]]

Rules: [[Money and stock rules]] · Debug: [[Playbook Debug Oversell]] · [[Playbook Debug Webhook]]

## Trust

[[Auth and Sessions]] · [[RBAC]] · [[Wire contracts]] · [[Error model]]

## Product surfaces

[[Surface Storefront]] · [[Surface Auth]] · [[Surface Account]] · [[Surface Admin]] · [[Surface Machine SEO]]

## Discovery & content

[[Catalogue]] · [[Search]] · [[Recipes and Journal]] · [[Hero and Home]] · [[Recommendations]]

## Ops

[[Docker and Local Dev]] · [[Testing]] · [[Observability]] · [[Seed and Demo Data]] · [[Env and config]] · [[Migrations]]

## Navigate

[[Map of Content]] · [[Business Domains MOC]] · [[Journeys MOC]] · [[Code Maps MOC]] · [[Decisions MOC]] · [[Playbooks MOC]] · [[Glossary]] · [[Documentation Bridge]] · [[00 Home]]

#map #brain

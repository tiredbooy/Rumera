---
tags: [code, frontend]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 10 Code Maps]]


# Frontend feature map

```text
apps/frontend/
├── app/
│   ├── (storefront)/     # [[Surface Storefront]]
│   ├── (auth)/           # [[Surface Auth]]
│   ├── (account)/account # [[Surface Account]]
│   ├── admin/            # [[Surface Admin]]
│   └── api/{public,store,admin,auth}/  # [[BFF Proxies]]
├── features/             # domains
├── lib/                  # [[Platform Layer]]
├── components/           # ui + brand primitives
└── docs/                 # [[Docs Bridge Frontend]]
```

## features/* → note

| Folder | Note |
|--------|------|
| catalog/* | [[Catalogue]] |
| cart, checkout | [[Cart and Checkout]] |
| inventory, admin/inventory | [[Inventory FE]] |
| account/*, wallet, loyalty, … | [[Account FE]] · [[Account Domain]] |
| recipes, journal, hero-slides | [[Recipes and Journal]] · [[Hero and Home]] |
| storefront/search | [[Search FE]] |
| admin/* | [[Admin Console]] |
| compliance | [[Compliance Age Gate]] |
| auth | [[Auth and Sessions]] |
| dashboard | admin chrome |

Related: [[Frontend Domain Map]] · [[Code Maps MOC]] · [[ADR Thin routes and domain features]]

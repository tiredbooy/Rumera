# Frontend documentation

Customer storefront **and** staff admin for Rumera (Persian / RTL luxury
wine & spirits). **Next.js 16** App Router, React 19, Tailwind 4, shadcn/ui,
TanStack Query, next-auth v5.

> **Next.js 16 differs from older tutorials.** Read
> [`../AGENTS.md`](../AGENTS.md) first (`params` / `searchParams` are async;
> route groups add no URL segment; Turbopack).

---

## Folder layout (how to find things)

```
apps/frontend/docs/
├── README.md                 ← you are here (index)
├── platform/                 ← how the app is built (framework, auth, data)
│   ├── architecture.md
│   ├── bff-and-auth.md
│   ├── rbac.md
│   ├── api-layer.md
│   ├── data-fetching.md
│   └── design-system.md
└── features/                 ← product journeys & domains
    ├── domain-map.md         ← start here to locate code
    ├── media-and-cache.md
    ├── storefront-commerce.md
    ├── search.md
    ├── account-tour.md
    ├── content-and-seo.md
    ├── recipe-commerce.md
    ├── admin-console.md
    ├── inventory.md
    ├── brand-system.md
    ├── pwa.md
    └── api-monitoring.md
```

| Need… | Open… |
|-------|--------|
| “Where does X live in the repo?” | [features/domain-map.md](./features/domain-map.md) |
| Routes, RSC vs client, providers | [platform/architecture.md](./platform/architecture.md) |
| Login, session, BFF proxies | [platform/bff-and-auth.md](./platform/bff-and-auth.md) |
| Admin who-sees-what | [platform/rbac.md](./platform/rbac.md) |
| Fetch clients & React Query | [platform/api-layer.md](./platform/api-layer.md) + [data-fetching](./platform/data-fetching.md) |
| RTL / tokens / typography | [platform/design-system.md](./platform/design-system.md) |
| Catalogue, cart, checkout | [features/storefront-commerce.md](./features/storefront-commerce.md) |
| Stock admin UI | [features/inventory.md](./features/inventory.md) |
| `/account/*` | [features/account-tour.md](./features/account-tour.md) |
| Images + cache tags | [features/media-and-cache.md](./features/media-and-cache.md) |

---

## Platform guides

| Guide | What it covers |
|-------|----------------|
| [Architecture](./platform/architecture.md) | App Router groups, server/client split, request flow, `lib/` map |
| [BFF & auth](./platform/bff-and-auth.md) | `/api/{public,store,admin}`, Auth.js, refresh, guards |
| [RBAC](./platform/rbac.md) | Permissions, `can()`, nav filtering, backend mapping |
| [API layer](./platform/api-layer.md) | `publicRequest`, `apiFetch`, `storeRequest`, query keys, errors |
| [Data fetching](./platform/data-fetching.md) | RSC vs React Query, cache, empty vs error |
| [Design system](./platform/design-system.md) | Tokens, themes, RTL logical props, `faNum` / `formatPrice` |

---

## Feature & journey guides

| Guide | What it covers |
|-------|----------------|
| [Domain map](./features/domain-map.md) | Every `features/*` domain and ownership rules |
| [Media & cache](./features/media-and-cache.md) | Media URLs, tags, admin revalidation |
| [Storefront commerce](./features/storefront-commerce.md) | Catalogue, cards, cart, checkout |
| [Search](./features/search.md) | Header + `/search` (engine details on backend) |
| [Account tour](./features/account-tour.md) | Wallet, loyalty, gift cards, orders, taste, … |
| [Content & SEO](./features/content-and-seo.md) | Home, journal, recipes, sitemap, JSON-LD, OG |
| [Recipe commerce](./features/recipe-commerce.md) | Ingredient → shoppable product |
| [Admin console](./features/admin-console.md) | `/admin` shell and modules |
| [Inventory](./features/inventory.md) | Admin stock list, adjust, reorder, movements |
| [Brand system](./features/brand-system.md) | Logo assets |
| [PWA](./features/pwa.md) | Manifest, SW, install, offline |
| [API monitoring](./features/api-monitoring.md) | Prometheus admin board |

---

## Cross-repo entry points

| Doc | Role |
|-----|------|
| [System overview](../../../docs/SYSTEM-OVERVIEW.md) | Full monorepo architecture |
| [Documentation map](../../../docs/DOCUMENTATION-MAP.md) | Inventory of all docs + gaps |
| [Testing](../../../docs/TESTING.md) | Vitest, Go tests, Playwright status |
| [Backend docs](../../backend/docs/README.md) | Go API, inventory, payments, search |
| [Storefront README](../README.md) | Scripts, local run |
| [AGENTS.md](../AGENTS.md) | Next.js 16 rules |

---

## 30-second mental model

```
Browser
  ├─ Public RSC  → features/<domain>/api → publicRequest → Go /api/v1
  └─ Auth client → storeRequest → /api/store|admin BFF → Bearer → Go
```

Thin routes under `app/`; business code under `features/`; infrastructure under
`lib/`. Never put catalogue types back into a catch-all `lib/catalog`.

Primary public surfaces soft-fail when the API is offline during `next build`.
Money paths (cart, checkout, payments, inventory adjustments) must not soft-fail
business errors.

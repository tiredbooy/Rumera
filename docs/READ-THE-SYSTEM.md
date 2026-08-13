# Read the system in one hour (founder outline)

**Audience:** founder / product owner who needs a working mental model of Rumera  
**Time budget:** ~60 minutes of focused reading (not skimming every API field)  
**Program:** PH-050b · dual-track with Obsidian [[Project Brain]]

Open the **Obsidian vault** (`Rumera/obsidian`) in parallel for Graph links; long depth stays in these repo paths.

---

## Clock

| Min | Focus | Project doc (depth) | Obsidian (map) |
|----:|-------|---------------------|----------------|
| **0–8** | What runs where | [SYSTEM-OVERVIEW.md](./SYSTEM-OVERVIEW.md) | [[System Atlas]] · [[Data Stores]] |
| **8–18** | How the backend is organized | [architecture.md](../apps/backend/docs/architecture.md) · [domain-map.md](../apps/backend/docs/architecture/domain-map.md) | [[Layered Backend]] · [[Backend Domain Map]] · [[ADR Backend feature packages]] |
| **18–32** | Money & stock (the hard path) | [money-and-stock-sagas.md](../apps/backend/docs/architecture/money-and-stock-sagas.md) · skim [idempotency.md](../apps/backend/docs/architecture/idempotency.md) intro | [[Money and stock rules]] · [[Journey Payment webhook settle]] · [[Journey Idempotent retry checkout webhook]] |
| **32–40** | Orders + payments (ops truth) | [payments-and-webhooks.md](../apps/backend/docs/architecture/payments-and-webhooks.md) · [inventory.md](../apps/backend/docs/architecture/inventory.md) (reserve/deduct) | [[Orders]] · [[Payments]] · [[Inventory]] · [[Journey First purchase]] |
| **40–48** | Loyalty (growth lever) | [loyalty.md](../apps/backend/docs/architecture/loyalty.md) | [[Loyalty Wallet Gift Cards]] · [[Loyalty Backend]] · [[Journey Loyalty first purchase points]] |
| **48–55** | Search / discovery | [search.md](../apps/backend/docs/architecture/search.md) | [[Search]] · [[Search Backend]] · [[Journey Search to PDP]] · [[ADR Search ILIKE until Meili]] |
| **55–60** | Where to go next | This page’s “After the hour” · [FEATURE-ROADMAP.md](./FEATURE-ROADMAP.md) residuals | [[Known gaps]] · [[Journeys MOC]] |

---

## Minute-by-minute intent (what to absorb)

### 0–8 — System Overview

You should be able to answer:

- What processes exist (API server, optional notification worker, cron-in-process)?
- Browser → Next BFF → Go API → which databases?
- What is **out of scope** right now (no CI, single currency, no multi-warehouse)?

### 8–18 — Architecture shape

- Business code lives in **`internal/features/<domain>`** (not a giant handlers package).
- Trust tiers: public / customer / admin.
- One domain note in the vault = one ownership story; deep tables stay in `apps/backend/docs`.

### 18–32 — Money & stock sagas

- Checkout **reserves** stock; paid webhook **deducts**; failure paths do not free-money.
- **Idempotency** is a platform (keys on money POSTs + unique payment `transaction_id`) — not a one-off middleware joke.
- Skim the money-route catalogue in idempotency.md; do not memorize every column.

### 32–40 — Orders / payments / inventory

- Payment confirmation is the pivot that marks the order paid and settles stock.
- Available stock ≠ on-hand; oversell rules live in inventory docs.
- Journey “first purchase” ties cart → order → pay → loyalty award.

### 40–48 — Loyalty (Cellar Club)

- Earn triggers (purchase, review, birthday, …) and redeem-to-wallet honesty.
- Admin rates are **env-backed / read-only UI** today — not a free-grant console.
- Pair with wallet top-up / gift cards only if you have extra minutes (account growth loop).

### 48–55 — Search

- Storefront today: **Persian-aware ILIKE** (+ title trigram quality).
- Meili is **ready to operate** but **not** forced as the storefront path yet (cutover is a decision).

### 55–60 — After the hour

Pick **one** residual from [FEATURE-ROADMAP.md](./FEATURE-ROADMAP.md) or [[Known gaps]] if you want a next build; do not invent CI or Netflix-style subs.

---

## Optional +15 minutes (if curious)

| Topic | Project | Vault |
|-------|---------|-------|
| Wallet gateway top-up | [wallet-topup.md](../apps/backend/docs/architecture/wallet-topup.md) | [[Journey Account wallet top-up]] |
| Gift card purchase | [gift-card-purchase.md](../apps/backend/docs/architecture/gift-card-purchase.md) | [[Journey Gift card purchase]] |
| Cellar box (not Netflix) | [box-subscriptions.md](../apps/backend/docs/architecture/box-subscriptions.md) | [[Subscriptions]] · [[Journey Manage cellar box]] |
| Dual-doc rules | [DOCUMENTATION-DUAL-TRACK.md](./DOCUMENTATION-DUAL-TRACK.md) | [[Playbook Document a change]] |
| Program closure map | [PH-DUAL-DOC-MATRIX.md](./PH-DUAL-DOC-MATRIX.md) | — |

---

## Do **not** spend the hour on

- Full OpenAPI field lists (use `apps/backend/docs/api/` when implementing)
- `refactor-workstreams/*` task archaeology (done program history)
- CI/workflows, multi-currency, multi-warehouse, crypto, streaming subscriptions

---

## Related

- Hub: [README.md](./README.md)  
- Inventory: [DOCUMENTATION-MAP.md](./DOCUMENTATION-MAP.md)  
- Vault center: `obsidian/Brain/Project Brain.md`  
- Plain-language backend story: [how-it-works.md](../apps/backend/docs/how-it-works.md) (extra credit after the hour)

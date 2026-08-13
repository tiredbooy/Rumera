# Rumera — Feature Roadmap

> **Working agreement**
> - Build each feature **end-to-end**: DB migration → repo → service → handler → routes → frontend lib/proxy → **polished UI/UX** (RTL, design tokens, a11y) → verify.
> - UI/UX is first-class — design with the `ui-ux-pro-max` guidance (premium dark+gold, editorial, 150–300ms transitions, 44px touch targets, focus states, `prefers-reduced-motion`, responsive 375/768/1024/1440).
> - When a feature is **fully done**, delete its checklist box **and** its spec section from this file.
> - Keep the existing design tokens: gold/wine, `font-serif`, `container-px`, `.cellar-glow`, `.text-foil`, `SmartImage`, `Reveal`.
> - Conventions: `/api/v1` prefix · `{data}` / `{error:{code,message}}` envelope · route groups public/customer(Auth)/admin · goose migrations in `apps/backend/migrations/main` · browser→API only through `/api/store` (auth) or `/api/public` (unauth) proxies.

## Build order / checklist

🎉 **All planned features shipped.** Add new ones below as they come up.

## Production-hardening program (2026-08)

Canonical backlog:
[`BACKLOG-PRODUCTION-HARDENING.md`](./BACKLOG-PRODUCTION-HARDENING.md) →
`refactor-workstreams/production-hardening-and-product/TASKS.md`.

Dual-doc closure map: [`PH-DUAL-DOC-MATRIX.md`](./PH-DUAL-DOC-MATRIX.md) (PH-050a).

| Phase | Status |
|-------|--------|
| 0 Docs OS (PH-000*) | **Done** |
| 1 Correctness (PH-010…013) | **Done** |
| 2 Operator trust (PH-020…021) | **Done** |
| 3 Search (PH-030*) | **Done** (Meili cutover still deferred) |
| 4 Growth (PH-040…043) | **Done** (PH-043c closed: **no** auto-charge — decision) |
| 5 Dual-doc gate (PH-050*) | **Done** (matrix + [READ-THE-SYSTEM.md](./READ-THE-SYSTEM.md)) |

### Shipped in this program (do not re-open)

- Idempotency platform (PH-011) · models/errors (PH-012) · async/metrics/tests (PH-013)
- Inventory weight + checkout truth (PH-020) · RBAC residual (PH-021)
- Persian ILIKE search + Meili readiness without cutover (PH-030)
- Loyalty rules/earn/UX/admin rates/analytics hooks (PH-040)
- Gateway wallet top-up (PH-041) · gift card purchase (PH-042)
- Cellar box product model + management UX + RTL due email (PH-043a–b)
- Box auto-charge **declined** for this program (PH-043c decision)

## Explicitly deferred (do not build without go-ahead)

| Item | Notes |
|------|--------|
| CI / GitHub Actions / CD | No server for founder right now |
| Multi-currency | Toman only |
| Multi-warehouse | Single stock pool |
| Crypto payment rails | Maybe later — not now |
| Netflix-style digital subscriptions | Box e-com only |
| Multi-tenant | Not a goal |
| Box **tokenized auto-charge** | Closed PH-043c — re-open only with criteria in `apps/backend/docs/architecture/box-auto-charge-decision.md` |
| Meili **storefront cutover** | Readiness done; cutover separate decision |

**Deferred ADR (vault):** Obsidian `11 Decisions/ADR Deferred product and platform.md`.

## Known residuals (small, intentional)

- Wallet / gift purchase: embed real **gateway redirect URL** in FE when provider returns it
- Gift cards: optional **email delivery** of code (mine list works today)
- Subscriptions: PATCH address on existing sub; `ListByUser` **LIMIT**; contents preference only if product asks
- Loyalty: DB-tunable rates / staff adjust API (env rates are live read-only)
- Recommendations: stronger taste-profile weighting into behavioural engine
- Ops: Prometheus/Grafana **scrape** profile (app metrics already instrumented)

---

## Related

- [DOCUMENTATION-DUAL-TRACK.md](./DOCUMENTATION-DUAL-TRACK.md)
- [DOCUMENTATION-MAP.md](./DOCUMENTATION-MAP.md)
- [IMPROVEMENT-OPPORTUNITIES.md](./IMPROVEMENT-OPPORTUNITIES.md) — historical audit; see status banner

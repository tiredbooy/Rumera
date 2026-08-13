---
tags: [decision, product, platform]
aliases:
  - Deferred decisions
  - Not now
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 11 Decisions]]


# ADR: Deferred product and platform

**Status:** accepted (explicit non-goals)  
**Date:** 2026-08-11  
**Program:** production-hardening-and-product

## Context

Founders and agents re-propose large platform features while core e-commerce
trust and loyalty growth still need work. This ADR records **not now** decisions
so they are not reinvented every session.

## Decision — out of scope for now

| Item | Decision | Revisit when |
|------|----------|--------------|
| **CI / deploy workflows** | Do not build or maintain GitHub Actions / server CD | A real deploy server exists |
| **Multi-currency** | Single currency ([[Term Toman]]) | Expansion requires FX + pricing design |
| **Multi-warehouse** | Single inventory pool | Ops needs multi-location stock |
| **Crypto payments** | Maybe later; do not implement rails | Explicit product go-ahead + compliance |
| **Netflix-style subscriptions** | Rejected product shape | Never as unlimited digital access; box model only |
| **Box tokenized auto-charge** | Declined (PH-043c) — email renewal only | Re-open criteria in project `box-auto-charge-decision.md` / [[ADR Box auto-charge declined]] |
| **Multi-tenant** | Not a product goal | — |

## Decision — in scope product shape

- **Subscriptions** = recurring **physical box** (pause/skip/cancel, renewal email). See [[Subscriptions]].
- **Loyalty triggers** = growth priority (review, birthday, paid order). See [[Loyalty Wallet Gift Cards]].
- **Idempotency platform** = production hardening priority (PH-011).
- **Dual-track docs** always — [[Playbook Document a change]].

## Consequences

- Roadmap and Known gaps must list these as deferred, not “missing bugs.”
- Agents must not open multi-currency / multi-warehouse / CI tasks in this program.
- Crypto may appear as a payment **method enum** historically — that is not a live rail.

## Related

[[Known gaps]] · [[Subscriptions]] · [[Money and stock rules]] · [[ADR Backend feature packages]] · repo `docs/FEATURE-ROADMAP.md` · `docs/BACKLOG-PRODUCTION-HARDENING.md`

#decision

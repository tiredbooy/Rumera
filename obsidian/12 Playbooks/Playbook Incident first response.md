---
tags: [playbook, ops]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 12 Playbooks]]


# Playbook: Incident first response

Lightweight on-call start (expand when you have real paging).

## When to use

Site down, checkout failing, payments stuck, media 500s, auth loop.

## Steps

1. **Scope:** storefront only / API only / admin only / payments?
2. **Health:** `GET /health` on API; frontend load; nginx gateway [[Gateway and nginx]]
3. **Dashboards:** [[Admin Analytics]] offline? [[Observability]] / Prometheus board
4. **Money path:** new orders creating? webhooks 401/503? → [[Playbook Debug Webhook]]
5. **Stock:** oversell reports? → [[Playbook Debug Oversell]]
6. **Auth:** login loop? → [[Playbook Debug Session loop]]
7. **Recent deploys / env:** [[Env and config]] secrets missing?
8. **Mitigate:** scale/restart worker if async notifications backlog; disable broken feature flag if any
9. **Record:** short note under session log or future incident folder; update playbook if new step found

## Related

[[Playbooks MOC]] · [[Docker and Local Dev]] · [[Testing]] · [[Runtime Topology]]

#playbook #ops

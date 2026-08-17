---
tags: [decision]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 11 Decisions]]


# ADR: Security posture baseline

**Status:** accepted (living baseline, not a full threat model)

## Context

Rumera handles auth, payments webhooks, PII, and alcohol retail UX.

## Decision (baseline rules)

1. Access tokens never in browser JS → [[ADR BFF never exposes access tokens]]
2. Customer resources always scoped by JWT `uid`
3. Staff [[RBAC]] enforced on backend; UI hide is not security
4. Payment webhooks HMAC + fail-closed without secret → [[Payments Backend]]
5. Media uploads size/pixel guards; unsafe external URL rejection
6. Production requires strong `JWT_SECRET`, webhook key, DB passwords
7. Production requires non-empty `TRUSTED_PROXIES` (compose: Docker/nginx CIDR `172.16.0.0/12`, never `0.0.0.0/0`). Prod nginx resets `X-Forwarded-For` to `$remote_addr` so login/OTP/global rate limits cannot be XFF-spoofed → [[Gateway and nginx]] · [[Env and config]]

## Consequences

- Agents must not “simplify” auth by putting bearers in localStorage
- Full STRIDE model still optional future work ([[Known gaps]])

## Related

[[Auth and Sessions]] · [[Env and config]] · [[Pitfalls and anti-patterns]] · [[Decisions MOC]]

#decision

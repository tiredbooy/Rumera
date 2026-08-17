---
tags: [surface]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 13 Surfaces]]


# Surface: Auth

`/login`, register, forgot/reset password, OTP flows — `(auth)` group, noindex.

## What it is

Public account entry: phone OTP (primary), email/password, register, forgot/reset.
Signed-in visitors hitting `/login` or `/register` bounce to a safe `callbackUrl`
(default `/account`). Dead refresh (`RefreshAccessTokenError`) is not bounced —
[[Term session]] guard signs out instead of looping.

## Login / OTP errors (PR-034a)

`authorize` maps Go envelopes to Auth.js codes (`signIn` result / `?code=`):

| Code | Meaning | UI |
|------|---------|----|
| `RateLimited` | 429 / `TOO_MANY_REQUESTS` | not “wrong password” |
| `Inactive` | `ACCOUNT_DISABLED` / 403 | banned or inactive |
| `CredentialsSignin` | `INVALID_CREDENTIALS` | wrong email/password or OTP |
| `AuthServiceError` | 5xx / network | server unavailable |

Forgot-password stays enumeration-safe (always 202). No fake change-password / 2FA.

## Reset token on load (PR-034b)

`/reset-password?token=` calls `GET /api/public/auth/password/validate` before
submit. Empty / `INVALID_TOKEN` / `EXPIRED_TOKEN` share one Persian line
(«لینک بازیابی نامعتبر یا منقضی شده است») and disable save. 5xx / network is
«ارتباط با سرور برقرار نشد» — not “invalid token”. Validate does not consume
the token.

Repo: [auth.md](../../apps/frontend/docs/features/auth.md) · [[BFF Proxies]]

## Related

[[Journey OTP login]] · [[Auth and Sessions]] · [[BFF Proxies]] · [[Error model]] · [[Surfaces MOC]]

#surface

---
tags: [journey, auth]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 09 Journeys]]


# Journey: OTP login

## Actor

Shopper

## Happy path

1. [[Surface Auth]] phone login → request OTP (`POST /api/public/auth/otp/request`)
2. [[Notifications]] SMS (inline or async outbox)
3. Verify via Auth.js `otp` provider → `POST /auth/otp/verify` → [[Term session]]
4. Redirect to account or safe return URL (`safeCallbackUrl`)

Already signed in on `/login` or `/register` → bounce to that same safe URL.

## Failure branches

- **429 / `TOO_MANY_REQUESTS`** (request or verify) → «تعداد درخواست‌ها زیاد است…» — never wrong-code copy
- **Wrong / expired code** (`INVALID_CREDENTIALS`) → «کد واردشده نادرست یا منقضی شده است.»
- **Banned / inactive** (`ACCOUNT_DISABLED`) → «این حساب غیرفعال است…»
- **Upstream / network** → «ارتباط با سرور برقرار نشد.»
- **Invalid phone** on request (4xx other than 429) → «شماره موبایل نامعتبر است.»

## Domains touched

- [[Account Domain]] · [[Notifications]] · [[Auth and Sessions]] · [[BFF Proxies]]

## Related

[[Surface Auth]] · [[Term BFF]] · [[Term session]] · [[Error model]] · [[Journeys MOC]]

#journey

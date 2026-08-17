# Auth (login, OTP, register)

**Who this is for:** engineers changing sign-in, OTP, register bounce, or the
Auth.js `authorize` path.

**Related:** [BFF & auth](../platform/bff-and-auth.md) ·
backend [authentication](../../../backend/docs/authentication.md) ·
[error messages](../../../backend/docs/architecture/error-messages.md)

---

## Surfaces

| Surface | Path |
|---------|------|
| Login (phone OTP + email) | `/login` → `app/(auth)/login/page.tsx` |
| Register | `/register` → `app/(auth)/register/page.tsx` |
| Forgot / reset password | `/forgot-password`, `/reset-password` |

`(auth)` adds **no** URL segment. Pages are `noindex`. Forgot-password stays
enumeration-safe (always the same 202 UI). Do not invent change-password / 2FA.

## Signed-in bounce

`/login` and `/register` call `getSession()`. If a user is present and the
session is not a dead refresh (`RefreshAccessTokenError`), they redirect to
`safeCallbackUrl(callbackUrl)` (default `/account`). Open redirects are rejected.

A `RefreshAccessTokenError` session is **not** bounced — `SessionGuard` signs
out; bouncing would loop with `requireUser`.

## Authorize failure codes (PR-034a)

`lib/auth/auth.ts` `authorize` does **not** swallow `AuthServerError` as `null`.
It throws Auth.js `CredentialsSignin` with a stable `code`. Client
`signIn(..., { redirect: false })` reads `result.code` (redirects get
`?error=CredentialsSignin&code=`).

| Backend | HTTP | Auth.js `code` | Persian (login / OTP verify) |
|---------|------|----------------|------------------------------|
| `TOO_MANY_REQUESTS` | 429 | `RateLimited` | تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید. |
| `ACCOUNT_DISABLED` / `FORBIDDEN` | 403 | `Inactive` | این حساب غیرفعال است. در صورت نیاز با پشتیبانی تماس بگیرید. |
| `INVALID_CREDENTIALS` | 401 | `CredentialsSignin` | ایمیل یا گذرواژه نادرست است. / کد واردشده نادرست یا منقضی شده است. |
| 5xx / network / missing token | — | `AuthServiceError` | ارتباط با سرور برقرار نشد. |

Never put backend messages, tokens, or which-field-was-wrong into the URL or
alert. 429 must not look like a wrong password.

OTP **request** still goes through `/api/public/auth/otp/request` and maps 429
vs invalid phone vs server locally; **verify** uses the `otp` Credentials
provider and the table above.

## Code map

| Concern | Location |
|---------|----------|
| Authorize + code mapping | `lib/auth/auth.ts` (`authorizeFailureCode`) |
| Email login UI | `features/auth/components/login-form.tsx` |
| Phone OTP UI | `features/auth/components/phone-login-form.tsx` |
| Callback sanitizer | `features/auth/redirects.ts` |
| Session helpers | `lib/auth/session.ts` |

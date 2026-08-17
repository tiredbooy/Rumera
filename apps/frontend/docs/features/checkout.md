# Checkout payment and confirmation copy

**Who this is for:** FE engineers changing `/checkout` payment-step or
confirmation wording.

**Broader journey:** [storefront-commerce.md](./storefront-commerce.md) ·
[wallet.md](./wallet.md)

Payment method picker is `features/checkout/components/checkout-payment-step.tsx`.
Confirmation is `features/orders/components/order-confirmation-view.tsx`.
Confirmation **reads** the server order; it does not complete payment.

---

## Bank transfer (PR-030d)

There is **no** IBAN / account-number / receipt API. Do not invent one.

| Method | What happens | Copy rule |
|--------|----------------|-----------|
| `wallet` | PR-020a can settle in the create TX (`paid` if funds suffice). | May describe a debit **on place-order**. Not operator-wait. |
| `bank_transfer` | Customer pays **offline**. Order stays `pending` until staff mark paid. | «واریز را بیرون از سایت انجام دهید… تا ثبت پرداخت توسط کارکنان در انتظار می‌ماند.» Never instant, never already confirmed, no شبا/حساب digits. |

The payment step only **picks** a method. Do not invent a gateway start URL
(PR-030c / PR-020f). Confirmation unpaid wording for this rail is PR-030a.

---

## Status hero (PR-030a)

Same **paid-like** set as loyalty: `paid`, `processing`, `ready_to_ship`,
`shipped`, `out_for_delivery`, `delivered`.

| Status | Eyebrow / heading | Must not say |
|--------|-------------------|--------------|
| Paid-like | «سفارش تأیید شد» / «سپاس از خرید شما» | — |
| `pending` | «سفارش ثبت شد» + «در انتظار پرداخت» | «سفارش تأیید شد», «سپاس از خرید شما», money taken |
| `payment_failed` | «سفارش ثبت شد» + «پرداخت ناموفق» | same as pending |
| Other unpaid | «سفارش ثبت شد» + `ORDER_STATUS_FA` | same as pending |

The status badge always uses `ORDER_STATUS_FA`.

---

## Wallet method (PR-030b)

Successful wallet checkout (PR-020a) settles in the create TX and returns
`paid`. Confirmation must follow **status**, not the mere presence of
`payment_method: "wallet"`.

| Status + wallet | Copy rule |
|-----------------|-----------|
| Paid-like | May say the wallet was charged («مبلغ از کیف پول برداشت شد»). |
| `pending` | Waiting / unpaid / insufficient-funds path. Never paid, charged, «تسویه», «برداشت شد». Choosing wallet is **not** a completed debit. |
| `payment_failed` | Failed. Not charged, or the charge was rolled back. No celebration. |

Bank transfer and other rails keep the generic unpaid / failed wording.
Do not invent a gateway start URL here (PR-030c / PR-020f).

---

## Testing

`features/checkout/components/checkout-payment-step.test.tsx`  
`features/orders/components/order-confirmation-view.test.tsx`

```
npx vitest run features/checkout --passWithNoTests
npx vitest run features/orders/components/order-confirmation-view --passWithNoTests
```

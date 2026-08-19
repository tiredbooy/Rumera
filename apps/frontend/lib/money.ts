/**
 * The one money formatter. Every Toman/currency amount in the app renders through
 * here.
 *
 * Money arrives from the API as an exact decimal **string** (`"125000.50"`).
 * Routing it through a JS number and an `Intl.NumberFormat` with
 * `maximumFractionDigits: 0` — which is what the storefront's `formatPrice` used
 * to do — rounds it: the admin saw «۱۲۵٬۰۰۰٫۵ تومان» for a gift card while the
 * customer who owned it saw «۱۲۵٬۰۰۱ تومان». Two screens, two numbers, one card.
 * So this parses the string and groups it by hand; no float is ever involved.
 *
 * Fractions are shown only when they are non-zero, trailing zeros trimmed, so
 * whole Toman amounts (nearly all of them) render exactly as before.
 */

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** Latin digits → Persian, leaving separators and letters alone. */
export function localizeDigits(value: string): string {
  return value.replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);
}

const DECIMAL = /^(-?)(\d+)(?:\.(\d+))?$/;

/**
 * Formats an exact decimal amount with Persian digits and «٬» group separators.
 * Returns null for anything that is not a plain decimal, so callers can decide
 * whether to fall back or hide the value.
 */
export function formatDecimal(value: string | number): string | null {
  const raw =
    typeof value === "number"
      ? Number.isFinite(value)
        ? String(value)
        : ""
      : value.trim();

  const match = DECIMAL.exec(raw);
  if (!match) return null;

  const [, sign, integer, fraction] = match;
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, "٬");
  const trimmed = fraction?.replace(/0+$/, "") ?? "";
  const decimals = trimmed ? `٫${trimmed}` : "";
  return localizeDigits(`${sign}${grouped}${decimals}`);
}

/**
 * «۱۸٬۹۰۰٬۰۰۰ تومان». Anything that is not a plain decimal comes back untouched
 * and *without* a unit — a value we could not parse is not an amount, and
 * labelling it «تومان» would present a parse failure as money.
 */
export function formatToman(value: string | number): string {
  const formatted = formatDecimal(value);
  return formatted === null ? String(value) : `${formatted} تومان`;
}

/** Same, for an amount that carries its own currency code. */
export function formatMoney(value: string | number, currency: string): string {
  const code = currency.toUpperCase();
  if (code === "IRT") return formatToman(value);
  const formatted = formatDecimal(value);
  return formatted === null ? String(value) : `${formatted} ${code}`;
}

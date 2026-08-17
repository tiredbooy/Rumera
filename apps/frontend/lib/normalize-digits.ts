const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/**
 * Map Persian (۰-۹) and Arabic-Indic (٠-٩) digits to ASCII.
 * Also folds the Unicode minus and fa-IR decimal/grouping marks so a value
 * copied from a Persian-formatted ledger pastes into a numeric field.
 */
export function toAsciiDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_INDIC_DIGITS.indexOf(digit)))
    .replaceAll("−", "-")
    .replaceAll("٫", ".")
    .replaceAll("٬", "");
}

/** `Number(...)` after Eastern-digit normalization. */
export function parseAsciiNumber(value: string): number {
  return Number(toAsciiDigits(value).trim());
}

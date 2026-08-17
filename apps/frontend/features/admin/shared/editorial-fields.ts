export const EXCERPT_LIMIT = 500;

/** Same slug rule both editors already accept: Unicode letters, digits, hyphens. */
export function normalizeEditorialSlug(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("fa")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
}

export function editorialSlugHint(mode: "create" | "edit"): string {
  return mode === "create"
    ? "خالی بگذارید تا از روی عنوان ساخته شود."
    : "تغییر نامک، نشانی عمومی این صفحه را تغییر می‌دهد.";
}

export function editorialExcerptHint(): string {
  return "در کارت‌ها و نتایج جستجو نمایش داده می‌شود.";
}

export type EditorialStatus = "draft" | "published" | "archived";
export type PublicationKind = EditorialStatus | "scheduled";
export type PublicationState = PublicationKind;

export const PUBLICATION_KIND_FA: Record<PublicationKind, string> = {
  draft: "پیش‌نویس",
  published: "منتشرشده",
  scheduled: "زمان‌بندی‌شده",
  archived: "بایگانی‌شده",
};

export const PUBLICATION_STATE_FA = PUBLICATION_KIND_FA;

export const PUBLICATION_KIND_HINT: Record<PublicationKind, string> = {
  draft: "به‌صورت پیش‌نویس ذخیره می‌شود و روی سایت دیده نمی‌شود.",
  published: "پس از ذخیره برای بازدیدکنندگان منتشر می‌شود.",
  scheduled: "تا زمان تعیین‌شده روی سایت دیده نمی‌شود.",
  archived: "بایگانی می‌شود و از سایت پنهان می‌ماند.",
};

/** published + a future published_at is a schedule, not live yet. */
export function publicationKind(
  status?: EditorialStatus | null,
  publishedAt: string | null | undefined = null,
  now: Date = new Date(),
): PublicationKind {
  if (status !== "published") return status ?? "draft";
  if (!publishedAt) return "published";
  const at = new Date(publishedAt);
  if (Number.isNaN(at.getTime())) return "published";
  return at.getTime() > now.getTime() ? "scheduled" : "published";
}

export const publicationState = publicationKind;

/** ISO → `datetime-local` for JalaliDateTimeInput. Empty when missing/invalid. */
export function isoToDatetimeLocal(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 19);
}

export const isoToLocalDateTime = isoToDatetimeLocal;

/** `datetime-local` → ISO for the API. Empty input is omitted, not "now". */
export function datetimeLocalToIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export const localDateTimeToIso = datetimeLocalToIso;

/** Confirm only when a saved live item is being taken off the site. */
export function shouldConfirmUnpublish(
  savedStatus: EditorialStatus | undefined,
  savedPublishedAt: string | null | undefined,
  nextStatus: EditorialStatus,
): boolean {
  return (
    publicationKind(savedStatus ?? "draft", savedPublishedAt) === "published" &&
    nextStatus !== "published"
  );
}

export function isUnpublish(
  from: EditorialStatus | undefined,
  to: EditorialStatus,
): boolean {
  return shouldConfirmUnpublish(from, null, to);
}

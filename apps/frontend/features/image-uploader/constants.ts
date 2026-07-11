export const MAX_MB = 15;
export const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export const RECOMMENDED_DIMENSIONS = "۱۰۰۰×۱۲۵۰ پیکسل پیشنهادی";

export function validateFile(file: File): string | null {
  if (!ACCEPT.includes(file.type as (typeof ACCEPT)[number]))
    return "فرمت پشتیبانی نمی‌شود (JPG/PNG/WebP/AVIF)";
  if (file.size > MAX_MB * 1024 * 1024)
    return `حجم باید کمتر از ${MAX_MB} مگابایت باشد`;
  return null;
}

/** Cheap heuristic to avoid re-adding the same file twice in one session. */
export function isSameFile(a: File, b: File) {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}
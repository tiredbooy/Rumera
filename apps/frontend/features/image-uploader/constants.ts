export const MAX_MB = 15;
export const ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;
export const RECOMMENDED_DIMENSIONS = "۱۰۰۰×۱۲۵۰ پیکسل پیشنهادی";

export const MAX_IMAGE_URL_LENGTH = 2048;
export const MAX_IMAGE_ALT_LENGTH = 255;

export function validateFile(file: File): string | null {
  if (!ACCEPT.includes(file.type as (typeof ACCEPT)[number]))
    return "فرمت پشتیبانی نمی‌شود (JPG/PNG/WebP/AVIF)";
  if (file.size > MAX_MB * 1024 * 1024)
    return `حجم باید کمتر از ${MAX_MB} مگابایت باشد`;
  return null;
}

export function validateImageURL(
  raw: string,
  options: { allowEmpty?: boolean; allowMediaPath?: boolean } = {},
): string | null {
  const value = raw.trim();
  if (!value) {
    return options.allowEmpty ? null : "نشانی تصویر را وارد کنید";
  }
  if (value.length > MAX_IMAGE_URL_LENGTH) {
    return "نشانی تصویر بسیار طولانی است";
  }
  if (value.includes("#")) return "نشانی تصویر نباید بخش fragment داشته باشد";
  if (value.includes("\\")) return "نشانی HTTPS معتبر وارد کنید";
  if (value.startsWith("/")) {
    if (value.startsWith("//")) {
      return "نشانی HTTPS معتبر وارد کنید";
    }
    if (value.startsWith("/media/") && !options.allowMediaPath) {
      return "برای فایل محلی از گزینه بارگذاری استفاده کنید";
    }
    return null;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      return "نشانی HTTPS معتبر وارد کنید";
    }
  } catch {
    return "نشانی HTTPS معتبر وارد کنید";
  }
  return null;
}

/** Cheap heuristic to avoid re-adding the same file twice in one session. */
export function isSameFile(a: File, b: File) {
  return (
    a.name === b.name && a.size === b.size && a.lastModified === b.lastModified
  );
}
